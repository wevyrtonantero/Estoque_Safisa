// Model responsavel pelas operacoes de pecas classificadas como SUBMONTAGEM.
const { pool } = require('../../database/connection');
const EstruturaSubmontagemModel = require('./EstruturaSubmontagemModel');

class SubmontagemModel {
  static buildStockMetricParams(idEstoqueReferencia) {
    if (!Number.isInteger(idEstoqueReferencia)) {
      return [];
    }

    return new Array(7).fill(idEstoqueReferencia);
  }

  static buildStockMetricsSelect(idEstoqueReferencia) {
    if (!Number.isInteger(idEstoqueReferencia)) {
      return `
        0 AS saldo_pronto_estoque,
        0 AS capacidade_estoque,
        NULL AS componente_limitante_codigo,
        NULL AS componente_limitante_descricao,
        0 AS componente_limitante_saldo,
        NULL AS componente_limitante_quantidade_estrutura,
        0 AS componente_limitante_capacidade
      `;
    }

    return `
      COALESCE((
        SELECT ss.quantidade
        FROM estoque_saldos ss
        WHERE ss.id_estoque = ? AND ss.id_peca = p.id
        LIMIT 1
      ), 0) AS saldo_pronto_estoque,
      COALESCE((
        SELECT MIN(
          FLOOR(
            CASE
              WHEN es2.quantidade > 0 THEN COALESCE(ssc.quantidade, 0) / es2.quantidade
              ELSE 0
            END
          )
        )
        FROM estrutura_submontagem es2
        LEFT JOIN estoque_saldos ssc
          ON ssc.id_peca = es2.id_item_componente
          AND ssc.id_estoque = ?
        WHERE es2.id_submontagem = p.id
      ), 0) AS capacidade_estoque,
      (
        SELECT pc2.codigo
        FROM estrutura_submontagem es3
        INNER JOIN pecas pc2 ON pc2.id = es3.id_item_componente
        LEFT JOIN estoque_saldos sl
          ON sl.id_peca = es3.id_item_componente
          AND sl.id_estoque = ?
        WHERE es3.id_submontagem = p.id
        ORDER BY
          CASE
            WHEN es3.quantidade > 0 THEN COALESCE(sl.quantidade, 0) / es3.quantidade
            ELSE 0
          END ASC,
          pc2.codigo ASC
        LIMIT 1
      ) AS componente_limitante_codigo,
      (
        SELECT pc2.descricao
        FROM estrutura_submontagem es3
        INNER JOIN pecas pc2 ON pc2.id = es3.id_item_componente
        LEFT JOIN estoque_saldos sl
          ON sl.id_peca = es3.id_item_componente
          AND sl.id_estoque = ?
        WHERE es3.id_submontagem = p.id
        ORDER BY
          CASE
            WHEN es3.quantidade > 0 THEN COALESCE(sl.quantidade, 0) / es3.quantidade
            ELSE 0
          END ASC,
          pc2.codigo ASC
        LIMIT 1
      ) AS componente_limitante_descricao,
      COALESCE((
        SELECT COALESCE(sl.quantidade, 0)
        FROM estrutura_submontagem es3
        LEFT JOIN estoque_saldos sl
          ON sl.id_peca = es3.id_item_componente
          AND sl.id_estoque = ?
        WHERE es3.id_submontagem = p.id
        ORDER BY
          CASE
            WHEN es3.quantidade > 0 THEN COALESCE(sl.quantidade, 0) / es3.quantidade
            ELSE 0
          END ASC,
          es3.id_item_componente ASC
        LIMIT 1
      ), 0) AS componente_limitante_saldo,
      (
        SELECT es3.quantidade
        FROM estrutura_submontagem es3
        LEFT JOIN estoque_saldos sl
          ON sl.id_peca = es3.id_item_componente
          AND sl.id_estoque = ?
        WHERE es3.id_submontagem = p.id
        ORDER BY
          CASE
            WHEN es3.quantidade > 0 THEN COALESCE(sl.quantidade, 0) / es3.quantidade
            ELSE 0
          END ASC,
          es3.id_item_componente ASC
        LIMIT 1
      ) AS componente_limitante_quantidade_estrutura,
      COALESCE((
        SELECT FLOOR(
          CASE
            WHEN es3.quantidade > 0 THEN COALESCE(sl.quantidade, 0) / es3.quantidade
            ELSE 0
          END
        )
        FROM estrutura_submontagem es3
        LEFT JOIN estoque_saldos sl
          ON sl.id_peca = es3.id_item_componente
          AND sl.id_estoque = ?
        WHERE es3.id_submontagem = p.id
        ORDER BY
          CASE
            WHEN es3.quantidade > 0 THEN COALESCE(sl.quantidade, 0) / es3.quantidade
            ELSE 0
          END ASC,
          es3.id_item_componente ASC
        LIMIT 1
      ), 0) AS componente_limitante_capacidade
    `;
  }

  static async replaceComponents(connection, submontagemId, componentes = []) {
    await connection.query(
      `
        DELETE FROM estrutura_submontagem
        WHERE id_submontagem = ?
      `,
      [submontagemId]
    );

    if (componentes.length === 0) {
      return;
    }

    await connection.query(
      `
        INSERT INTO estrutura_submontagem (
          id_submontagem,
          id_item_componente,
          quantidade,
          observacao
        ) VALUES ?
      `,
      [
        componentes.map((componente) => ([
          submontagemId,
          componente.id_item_componente,
          componente.quantidade,
          componente.observacao
        ]))
      ]
    );
  }

  // Lista as submontagens com contagem de componentes para a grade principal.
  static async findAll(filters = {}) {
    const conditions = ["p.classificacao = 'SUBMONTAGEM'"];
    const values = [];
    let filterJoin = '';

    if (filters.ativo !== null && filters.ativo !== undefined) {
      conditions.push('p.ativo = ?');
      values.push(filters.ativo ? 1 : 0);
    }

    if (filters.codigo) {
      conditions.push('p.codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.descricao) {
      conditions.push('p.descricao LIKE ?');
      values.push(`%${filters.descricao}%`);
    }

    if (filters.tipo) {
      conditions.push('p.tipo = ?');
      values.push(filters.tipo);
    }

    if (filters.id_item_componente) {
      filterJoin = 'INNER JOIN estrutura_submontagem esf ON esf.id_submontagem = p.id';
      conditions.push('esf.id_item_componente = ?');
      values.push(filters.id_item_componente);
    }

    const [rows] = await pool.query(
      `
        SELECT
          p.id,
          p.codigo,
          p.descricao,
          p.comprimento_mm,
          p.tipo,
          p.classificacao,
          p.id_materia_prima,
          p.id_fornecedor,
          p.id_maquina,
          p.estoque_minimo,
          p.estoque_seguranca,
          p.consumo_mensal,
          p.ativo,
          COALESCE(SUM(es.quantidade * COALESCE(pc.massa_kg, 0)), 0) AS massa_kg,
          ${this.buildStockMetricsSelect(filters.id_estoque_referencia)},
          p.created_at,
          p.updated_at,
          COUNT(DISTINCT es.id) AS total_componentes,
          COUNT(DISTINCT CASE WHEN pc.ativo = 0 THEN es.id END) AS total_componentes_inativos,
          GROUP_CONCAT(DISTINCT CONCAT(pc.codigo, ' - ', pc.descricao) ORDER BY pc.codigo SEPARATOR ' || ') AS componentes_resumo
        FROM pecas p
        ${filterJoin}
        LEFT JOIN estrutura_submontagem es ON es.id_submontagem = p.id
        LEFT JOIN pecas pc ON pc.id = es.id_item_componente
        WHERE ${conditions.join(' AND ')}
        GROUP BY p.id
        ORDER BY p.id DESC
      `,
      [...this.buildStockMetricParams(filters.id_estoque_referencia), ...values]
    );

    return rows;
  }

  // Busca uma submontagem pelo ID, com total de componentes agregados.
  static async findById(id, idEstoqueReferencia = null) {
    const [rows] = await pool.query(
      `
        SELECT
          p.id,
          p.codigo,
          p.descricao,
          p.comprimento_mm,
          p.tipo,
          p.classificacao,
          p.id_materia_prima,
          p.id_fornecedor,
          p.id_maquina,
          p.estoque_minimo,
          p.estoque_seguranca,
          p.consumo_mensal,
          p.ativo,
          COALESCE(SUM(es.quantidade * COALESCE(pc.massa_kg, 0)), 0) AS massa_kg,
          ${this.buildStockMetricsSelect(idEstoqueReferencia)},
          p.created_at,
          p.updated_at,
          COUNT(es.id) AS total_componentes
          ,COUNT(CASE WHEN pc.ativo = 0 THEN es.id END) AS total_componentes_inativos
        FROM pecas p
        LEFT JOIN estrutura_submontagem es ON es.id_submontagem = p.id
        LEFT JOIN pecas pc ON pc.id = es.id_item_componente
        WHERE p.id = ? AND p.classificacao = 'SUBMONTAGEM'
        GROUP BY p.id
      `,
      [...this.buildStockMetricParams(idEstoqueReferencia), id]
    );

    return rows[0] || null;
  }

  static async simulateAcrossStocks(id, quantidadeDesejada = 1) {
    const submontagem = await this.findById(id);
    if (!submontagem) {
      return null;
    }

    const componentes = await EstruturaSubmontagemModel.findBySubmontagemId(id);
    const quantidadePlanejada = Math.max(1, Number.parseInt(quantidadeDesejada, 10) || 1);

    const [stocks] = await pool.query(
      `
        SELECT
          id,
          nome
        FROM estoques
        WHERE ativo = 1
        ORDER BY
          CASE
            WHEN nome = 'Almoxarifado' THEN 1
            WHEN nome = 'Montagem' THEN 2
            WHEN nome = 'ExpediÃ§Ã£o' THEN 3
            ELSE 99
          END,
          nome ASC
      `
    );

    const [submontagemReadyRows] = await pool.query(
      `
        SELECT
          s.id_estoque,
          e.nome AS estoque_nome,
          s.quantidade
        FROM estoque_saldos s
        INNER JOIN estoques e ON e.id = s.id_estoque
        WHERE s.id_peca = ? AND s.quantidade > 0
        ORDER BY e.nome ASC
      `,
      [id]
    );

    if (componentes.length === 0) {
      return {
        submontagem,
        quantidade_desejada: quantidadePlanejada,
        capacidade_total: 0,
        pode_montar_quantidade_desejada: false,
        saldo_pronto_total: submontagemReadyRows.reduce((sum, row) => sum + Number(row.quantidade || 0), 0),
        saldos_prontos: submontagemReadyRows,
        componente_limitante: null,
        componentes: [],
        estoques: stocks
      };
    }

    const itemIds = componentes.map((item) => item.id_item_componente);
    const [saldoRows] = await pool.query(
      `
        SELECT
          s.id_peca,
          s.id_estoque,
          s.quantidade,
          e.nome AS estoque_nome
        FROM estoque_saldos s
        INNER JOIN estoques e ON e.id = s.id_estoque
        WHERE s.id_peca IN (?) AND e.ativo = 1
      `,
      [itemIds]
    );

    const saldosPorItem = new Map();

    saldoRows.forEach((saldo) => {
      const itemMap = saldosPorItem.get(saldo.id_peca) || new Map();
      itemMap.set(Number(saldo.id_estoque), {
        id_estoque: Number(saldo.id_estoque),
        estoque_nome: saldo.estoque_nome,
        quantidade: Number(saldo.quantidade || 0)
      });
      saldosPorItem.set(saldo.id_peca, itemMap);
    });

    const componentesSimulados = componentes.map((componente) => {
      const saldosItem = saldosPorItem.get(componente.id_item_componente) || new Map();
      const saldosPorEstoque = stocks.map((stock) => {
        const saldo = saldosItem.get(Number(stock.id));
        return {
          id_estoque: Number(stock.id),
          estoque_nome: stock.nome,
          quantidade: Number(saldo ? saldo.quantidade : 0)
        };
      });

      const totalDisponivel = saldosPorEstoque.reduce((sum, stock) => sum + Number(stock.quantidade || 0), 0);
      const capacidadeTotal = Number(componente.quantidade) > 0
        ? Math.floor(totalDisponivel / Number(componente.quantidade))
        : 0;
      const quantidadeNecessaria = Number(componente.quantidade) * quantidadePlanejada;
      const quantidadeFaltante = Math.max(0, quantidadeNecessaria - totalDisponivel);

      return {
        id_item_componente: componente.id_item_componente,
        codigo: componente.codigo_componente,
        descricao: componente.descricao_componente,
        tipo: componente.tipo_componente,
        massa_kg: Number(componente.massa_kg || 0),
        quantidade_estrutura: Number(componente.quantidade || 0),
        quantidade_necessaria: quantidadeNecessaria,
        total_disponivel: totalDisponivel,
        quantidade_faltante: quantidadeFaltante,
        capacidade_total: capacidadeTotal,
        pode_atender_quantidade_desejada: quantidadeFaltante <= 0,
        saldos_por_estoque: saldosPorEstoque
      };
    });

    const componenteLimitante = [...componentesSimulados].sort((a, b) => {
      if (a.capacidade_total !== b.capacidade_total) {
        return a.capacidade_total - b.capacidade_total;
      }

      return String(a.codigo).localeCompare(String(b.codigo));
    })[0] || null;

    return {
      submontagem,
      quantidade_desejada: quantidadePlanejada,
      capacidade_total: componenteLimitante ? componenteLimitante.capacidade_total : 0,
      pode_montar_quantidade_desejada: componentesSimulados.every((item) => item.pode_atender_quantidade_desejada),
      saldo_pronto_total: submontagemReadyRows.reduce((sum, row) => sum + Number(row.quantidade || 0), 0),
      saldos_prontos: submontagemReadyRows,
      componente_limitante: componenteLimitante
        ? {
            codigo: componenteLimitante.codigo,
            descricao: componenteLimitante.descricao,
            capacidade_total: componenteLimitante.capacidade_total,
            total_disponivel: componenteLimitante.total_disponivel,
            quantidade_estrutura: componenteLimitante.quantidade_estrutura
          }
        : null,
      componentes: componentesSimulados,
      estoques: stocks
    };
  }

  // Insere uma nova submontagem na mesma tabela de pecas.
  static async create(submontagemData, componentes = []) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `
          INSERT INTO pecas (
            codigo,
            descricao,
            comprimento_mm,
            tipo,
            classificacao,
            id_materia_prima,
            id_fornecedor,
            id_maquina,
            estoque_minimo,
            estoque_seguranca,
            consumo_mensal,
            massa_kg
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          submontagemData.codigo,
          submontagemData.descricao,
          submontagemData.comprimento_mm,
          'PRODUZIDA',
          'SUBMONTAGEM',
          submontagemData.id_materia_prima,
          submontagemData.id_fornecedor,
          submontagemData.id_maquina,
          submontagemData.estoque_minimo,
          submontagemData.estoque_seguranca,
          submontagemData.consumo_mensal,
          0
        ]
      );

      await this.replaceComponents(connection, result.insertId, componentes);
      await EstruturaSubmontagemModel.recalculateSubmontagemMass(result.insertId, connection);
      await connection.commit();

      return this.findById(result.insertId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Atualiza uma submontagem mantendo a classificacao fixa.
  static async update(id, submontagemData, componentes = null) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `
          UPDATE pecas
          SET
            codigo = ?,
            descricao = ?,
            comprimento_mm = ?,
            tipo = 'PRODUZIDA',
            classificacao = 'SUBMONTAGEM',
            id_materia_prima = ?,
            id_fornecedor = ?,
            id_maquina = ?,
            estoque_minimo = ?,
            estoque_seguranca = ?,
            consumo_mensal = ?
          WHERE id = ? AND classificacao = 'SUBMONTAGEM'
        `,
        [
          submontagemData.codigo,
          submontagemData.descricao,
          submontagemData.comprimento_mm,
          submontagemData.id_materia_prima,
          submontagemData.id_fornecedor,
          submontagemData.id_maquina,
          submontagemData.estoque_minimo,
          submontagemData.estoque_seguranca,
          submontagemData.consumo_mensal,
          id
        ]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return null;
      }

      if (Array.isArray(componentes)) {
        await this.replaceComponents(connection, id, componentes);
      }

      await EstruturaSubmontagemModel.recalculateSubmontagemMass(id, connection);
      await connection.commit();

      return this.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Remove uma submontagem; a estrutura sai junto pela FK com cascade.
  static async delete(id) {
    const [result] = await pool.query(
      "DELETE FROM pecas WHERE id = ? AND classificacao = 'SUBMONTAGEM'",
      [id]
    );

    return result.affectedRows > 0;
  }

  static async setActive(id, ativo) {
    const [result] = await pool.query(
      "UPDATE pecas SET ativo = ? WHERE id = ? AND classificacao = 'SUBMONTAGEM'",
      [ativo ? 1 : 0, id]
    );

    return result.affectedRows > 0 ? this.findById(id) : null;
  }
}

module.exports = SubmontagemModel;
