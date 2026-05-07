const { pool } = require('../../database/connection');

class ConsultaEstoqueModel {
  static BASES_COBERTURA = Object.freeze({
    TOTAL: 'total',
    OPERACIONAL: 'operacional',
    ALMOXARIFADO: 'almoxarifado',
    PRODUCAO: 'producao',
    MONTAGEM: 'montagem',
    EXPEDICAO: 'expedicao',
    TRATAMENTO_EXTERNO: 'tratamento_externo',
    PECAS_INACABADAS: 'pecas_inacabadas',
    RETRABALHO: 'retrabalho'
  });

  static ESTADOS = Object.freeze({
    SEM_CONSUMO: 'SEM_CONSUMO',
    ZERADO: 'ZERADO',
    ATE_7: 'ATE_7',
    ATE_15: 'ATE_15',
    ATE_30: 'ATE_30',
    OK: 'OK'
  });

  static normalizeBase(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return Object.values(this.BASES_COBERTURA).includes(normalized)
      ? normalized
      : this.BASES_COBERTURA.TOTAL;
  }

  static normalizeBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    return ['1', 'true', 'sim', 's'].includes(String(value).trim().toLowerCase());
  }

  static normalizeDateOnly(value) {
    const normalized = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
  }

  static formatDateOnly(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static addDays(baseDate, days) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + days);
    return date;
  }

  static getBaseQuantity(row, base) {
    const byBase = {
      [this.BASES_COBERTURA.TOTAL]: row.somatorio_total,
      [this.BASES_COBERTURA.OPERACIONAL]: row.somatorio_operacional,
      [this.BASES_COBERTURA.ALMOXARIFADO]: row.estoque_almoxarifado,
      [this.BASES_COBERTURA.PRODUCAO]: row.estoque_producao,
      [this.BASES_COBERTURA.MONTAGEM]: row.estoque_montagem,
      [this.BASES_COBERTURA.EXPEDICAO]: row.estoque_expedicao,
      [this.BASES_COBERTURA.TRATAMENTO_EXTERNO]: row.tratamento_externo,
      [this.BASES_COBERTURA.PECAS_INACABADAS]: row.pecas_inacabadas,
      [this.BASES_COBERTURA.RETRABALHO]: row.retrabalho
    };

    return Number(byBase[base] || 0);
  }

  static buildCoverage(row, base, today) {
    const consumoMensal = Number(row.quantidade_saida_mes || 0);
    const quantidadeBase = this.getBaseQuantity(row, base);

    if (consumoMensal <= 0) {
      return {
        base_cobertura: base,
        quantidade_base_cobertura: quantidadeBase,
        dias_cobertura: null,
        data_cobertura: null,
        estado_cobertura: this.ESTADOS.SEM_CONSUMO
      };
    }

    if (quantidadeBase <= 0) {
      return {
        base_cobertura: base,
        quantidade_base_cobertura: quantidadeBase,
        dias_cobertura: 0,
        data_cobertura: this.formatDateOnly(today),
        estado_cobertura: this.ESTADOS.ZERADO
      };
    }

    const diasCobertura = Number((quantidadeBase / (consumoMensal / 30)).toFixed(1));
    const dataCobertura = this.formatDateOnly(this.addDays(today, Math.ceil(diasCobertura)));
    let estado = this.ESTADOS.OK;

    if (diasCobertura <= 7) {
      estado = this.ESTADOS.ATE_7;
    } else if (diasCobertura <= 15) {
      estado = this.ESTADOS.ATE_15;
    } else if (diasCobertura <= 30) {
      estado = this.ESTADOS.ATE_30;
    }

    return {
      base_cobertura: base,
      quantidade_base_cobertura: quantidadeBase,
      dias_cobertura: diasCobertura,
      data_cobertura: dataCobertura,
      estado_cobertura: estado
    };
  }

  static applyPostFilters(rows, filters) {
    const estado = String(filters.estado || '').trim().toUpperCase();
    const dataAte = this.normalizeDateOnly(filters.data_ate);
    const somenteComSaldo = this.normalizeBoolean(filters.somente_com_saldo, true);

    return rows.filter((row) => {
      if (somenteComSaldo && Number(row.somatorio_total || 0) <= 0) {
        return false;
      }

      if (estado && row.estado_cobertura !== estado) {
        return false;
      }

      if (dataAte && (!row.data_cobertura || row.data_cobertura > dataAte)) {
        return false;
      }

      return true;
    });
  }

  static sortRows(rows, ordem) {
    const normalized = String(ordem || 'cobertura').trim().toLowerCase();
    const byCode = (left, right) => String(left.codigo || '').localeCompare(String(right.codigo || ''), 'pt-BR');

    if (normalized === 'codigo') {
      return rows.sort(byCode);
    }

    if (normalized === 'total_desc') {
      return rows.sort((left, right) => Number(right.somatorio_total || 0) - Number(left.somatorio_total || 0) || byCode(left, right));
    }

    if (normalized === 'total_asc') {
      return rows.sort((left, right) => Number(left.somatorio_total || 0) - Number(right.somatorio_total || 0) || byCode(left, right));
    }

    return rows.sort((left, right) => {
      const leftDias = left.dias_cobertura === null ? Number.POSITIVE_INFINITY : Number(left.dias_cobertura);
      const rightDias = right.dias_cobertura === null ? Number.POSITIVE_INFINITY : Number(right.dias_cobertura);
      return leftDias - rightDias || Number(left.somatorio_total || 0) - Number(right.somatorio_total || 0) || byCode(left, right);
    });
  }

  static buildIndicators(rows) {
    return rows.reduce((acc, row) => {
      acc.registros += 1;
      acc.saldo_total += Number(row.somatorio_total || 0);
      acc.ate_7 += ['ZERADO', 'ATE_7'].includes(row.estado_cobertura) ? 1 : 0;
      acc.sem_consumo += row.estado_cobertura === this.ESTADOS.SEM_CONSUMO ? 1 : 0;
      return acc;
    }, {
      registros: 0,
      saldo_total: 0,
      ate_7: 0,
      sem_consumo: 0
    });
  }

  static async findResumo(filters = {}) {
    const conditions = ["p.classificacao IN ('ITEM', 'SUBMONTAGEM')"];
    const values = [];

    if (filters.codigo) {
      conditions.push('p.codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.descricao) {
      conditions.push('p.descricao LIKE ?');
      values.push(`%${filters.descricao}%`);
    }

    if (filters.classificacao) {
      conditions.push('p.classificacao = ?');
      values.push(filters.classificacao);
    }

    const [rows] = await pool.query(
      `
        SELECT
          p.id AS id_peca,
          p.codigo,
          p.descricao,
          p.tipo,
          p.classificacao,
          COALESCE(p.consumo_mensal, 0) AS quantidade_saida_mes,
          COALESCE(est.almoxarifado, 0) AS estoque_almoxarifado,
          COALESCE(prod.quantidade, 0) AS estoque_producao,
          COALESCE(est.montagem, 0) AS estoque_montagem,
          COALESCE(est.expedicao, 0) AS estoque_expedicao,
          COALESCE(trat.quantidade, 0) AS tratamento_externo,
          COALESCE(esp.pecas_inacabadas, 0) AS pecas_inacabadas,
          COALESCE(esp.retrabalho, 0) AS retrabalho
        FROM pecas p
        LEFT JOIN (
          SELECT
            s.id_peca,
            SUM(CASE WHEN e.nome = 'Almoxarifado' THEN s.quantidade ELSE 0 END) AS almoxarifado,
            SUM(CASE WHEN e.nome = 'Montagem' THEN s.quantidade ELSE 0 END) AS montagem,
            SUM(CASE WHEN e.nome = 'Expedi\u00e7\u00e3o' THEN s.quantidade ELSE 0 END) AS expedicao
          FROM estoque_saldos s
          INNER JOIN estoques e ON e.id = s.id_estoque
          WHERE s.quantidade > 0
          GROUP BY s.id_peca
        ) est ON est.id_peca = p.id
        LEFT JOIN (
          SELECT
            s.id_peca,
            SUM(s.quantidade) AS quantidade
          FROM tratamento_externo_saldos s
          WHERE s.quantidade > 0
          GROUP BY s.id_peca
        ) trat ON trat.id_peca = p.id
        LEFT JOIN (
          SELECT
            r.id_peca,
            SUM(CASE WHEN r.tipo = 'PECAS_INACABADAS' THEN r.quantidade ELSE 0 END) AS pecas_inacabadas,
            SUM(CASE WHEN r.tipo = 'RETRABALHO' THEN r.quantidade ELSE 0 END) AS retrabalho
          FROM estoque_especial_registros r
          WHERE r.quantidade > 0
          GROUP BY r.id_peca
        ) esp ON esp.id_peca = p.id
        LEFT JOIN (
          SELECT
            po.id_peca,
            SUM(GREATEST(
              0,
              (
                CASE
                  WHEN po.quantidade_produzida IS NULL THEN po.quantidade_planejada
                  ELSE po.quantidade_produzida
                END
              ) - COALESCE(pd.quantidade_destinada, 0)
            )) AS quantidade
          FROM producao_ordens po
          LEFT JOIN (
            SELECT
              id_producao_ordem,
              SUM(quantidade) AS quantidade_destinada
            FROM producao_destinos
            GROUP BY id_producao_ordem
          ) pd ON pd.id_producao_ordem = po.id
          WHERE po.status = 'EM_ANDAMENTO'
          GROUP BY po.id_peca
        ) prod ON prod.id_peca = p.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.codigo ASC
      `,
      values
    );

    const base = this.normalizeBase(filters.base_cobertura);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enrichedRows = rows.map((row) => {
      const estoqueAlmoxarifado = Number(row.estoque_almoxarifado || 0);
      const estoqueProducao = Number(row.estoque_producao || 0);
      const estoqueMontagem = Number(row.estoque_montagem || 0);
      const estoqueExpedicao = Number(row.estoque_expedicao || 0);
      const tratamentoExterno = Number(row.tratamento_externo || 0);
      const pecasInacabadas = Number(row.pecas_inacabadas || 0);
      const retrabalho = Number(row.retrabalho || 0);
      const somatorioOperacional = Number((estoqueAlmoxarifado + estoqueProducao + estoqueMontagem + estoqueExpedicao).toFixed(2));
      const somatorioTotal = Number((somatorioOperacional + tratamentoExterno + pecasInacabadas + retrabalho).toFixed(2));
      const normalizedRow = {
        ...row,
        quantidade_saida_mes: Number(row.quantidade_saida_mes || 0),
        estoque_almoxarifado: estoqueAlmoxarifado,
        estoque_producao: estoqueProducao,
        estoque_montagem: estoqueMontagem,
        estoque_expedicao: estoqueExpedicao,
        somatorio_operacional: somatorioOperacional,
        tratamento_externo: tratamentoExterno,
        pecas_inacabadas: pecasInacabadas,
        retrabalho,
        somatorio_total: somatorioTotal
      };

      return {
        ...normalizedRow,
        ...this.buildCoverage(normalizedRow, base, today)
      };
    });

    const filteredRows = this.applyPostFilters(enrichedRows, filters);
    const sortedRows = this.sortRows(filteredRows, filters.ordem);

    return {
      filtros: {
        base_cobertura: base
      },
      indicadores: this.buildIndicators(sortedRows),
      itens: sortedRows
    };
  }
}

module.exports = ConsultaEstoqueModel;
