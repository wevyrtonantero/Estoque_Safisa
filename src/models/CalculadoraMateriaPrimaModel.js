const { pool } = require('../../database/connection');
const EstoqueMateriaPrimaModel = require('./EstoqueMateriaPrimaModel');
const ProducaoModel = require('./ProducaoModel');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, decimals = 4) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Number(parsed.toFixed(decimals));
}

function normalizePositiveDecimal(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

class CalculadoraMateriaPrimaModel {
  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static async findPecas(filters = {}) {
    const conditions = [
      "p.classificacao = 'ITEM'",
      "p.tipo = 'PRODUZIDA'",
      'p.id_materia_prima IS NOT NULL'
    ];
    const values = [];

    if (filters.q) {
      conditions.push(`
        (
          p.codigo LIKE ?
          OR p.descricao LIKE ?
          OR mp.codigo LIKE ?
          OR mp.nome LIKE ?
        )
      `);
      values.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          p.id,
          p.codigo,
          p.descricao,
          p.comprimento_mm,
          p.id_materia_prima,
          mp.codigo AS materia_prima_codigo,
          mp.nome AS materia_prima_nome,
          ${EstoqueMateriaPrimaModel.categorySelectExpression()} AS materia_prima_categoria,
          mp.material AS materia_prima_material,
          mp.geometria AS materia_prima_geometria,
          mp.bitola AS materia_prima_bitola,
          mp.bitola_mm AS materia_prima_bitola_mm,
          mp.comprimento_padrao_mm AS materia_prima_comprimento_padrao_mm,
          mp.peso_por_metro,
          mp.peso_unitario_kg,
          mp.unidade_estoque AS materia_prima_unidade_estoque,
          COALESCE(s.quantidade, 0) AS estoque_quantidade
        FROM pecas p
        INNER JOIN materias_primas mp ON mp.id = p.id_materia_prima
        LEFT JOIN estoque_materias_primas_saldos s ON s.id_materia_prima = mp.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.codigo ASC
        LIMIT 80
      `,
      values
    );

    return rows.map((row) => this.formatListItem(row));
  }

  static async findPecaWithMateriaPrima(id) {
    const [rows] = await pool.query(
      `
        SELECT
          p.id,
          p.codigo,
          p.descricao,
          p.comprimento_mm,
          p.id_materia_prima,
          mp.codigo AS materia_prima_codigo,
          mp.nome AS materia_prima_nome,
          ${EstoqueMateriaPrimaModel.categorySelectExpression()} AS materia_prima_categoria,
          mp.material AS materia_prima_material,
          mp.geometria AS materia_prima_geometria,
          mp.bitola AS materia_prima_bitola,
          mp.bitola_mm AS materia_prima_bitola_mm,
          mp.comprimento_padrao_mm AS materia_prima_comprimento_padrao_mm,
          mp.peso_por_metro,
          mp.peso_unitario_kg,
          mp.unidade_estoque AS materia_prima_unidade_estoque,
          COALESCE(s.quantidade, 0) AS estoque_quantidade
        FROM pecas p
        INNER JOIN materias_primas mp ON mp.id = p.id_materia_prima
        LEFT JOIN estoque_materias_primas_saldos s ON s.id_materia_prima = mp.id
        WHERE p.id = ?
          AND p.classificacao = 'ITEM'
          AND p.tipo = 'PRODUZIDA'
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async simulate(data) {
    const peca = await this.findPecaWithMateriaPrima(data.id_peca);

    if (!peca) {
      throw this.createBusinessError('Selecione uma peca produzida com materia-prima vinculada.');
    }

    const materiaPrima = this.buildMateriaPrima(peca);
    const estoque = this.buildEstoqueSnapshot(peca, materiaPrima);
    const comprimentoCorteMm = normalizePositiveDecimal(data.comprimento_corte_mm);
    const capacidade = this.calculateCapacity({ peca, materiaPrima, estoque, comprimentoCorteMm });
    const usarTodoEstoque = Boolean(data.usar_todo_estoque);
    const quantidadePecas = usarTodoEstoque
      ? capacidade.pecas_possiveis
      : toNumber(data.quantidade_pecas);

    if (!usarTodoEstoque && (!Number.isFinite(quantidadePecas) || quantidadePecas <= 0)) {
      throw this.createBusinessError('Informe uma quantidade de pecas maior que zero.');
    }

    const consumo = quantidadePecas > 0
      ? ProducaoModel.calculateMateriaPrimaConsumption({
          materiaPrima,
          peca,
          quantidadeTotal: quantidadePecas,
          comprimentoCorteMm
        })
      : this.buildEmptyConsumption(materiaPrima);

    return {
      peca: this.formatPeca(peca),
      materia_prima: this.formatMateriaPrima(materiaPrima),
      estoque,
      capacidade,
      simulacao: this.buildSimulationSummary({
        quantidadePecas,
        usarTodoEstoque,
        consumo,
        estoque,
        materiaPrima
      })
    };
  }

  static formatListItem(row) {
    const materiaPrima = this.buildMateriaPrima(row);
    const estoque = this.buildEstoqueSnapshot(row, materiaPrima);

    return {
      ...this.formatPeca(row),
      materia_prima: this.formatMateriaPrima(materiaPrima),
      estoque
    };
  }

  static buildMateriaPrima(row) {
    return {
      id: row.id_materia_prima,
      codigo: row.materia_prima_codigo,
      nome: row.materia_prima_nome,
      categoria: row.materia_prima_categoria,
      material: row.materia_prima_material,
      geometria: row.materia_prima_geometria,
      bitola: row.materia_prima_bitola,
      bitola_mm: row.materia_prima_bitola_mm,
      comprimento_padrao_mm: row.materia_prima_comprimento_padrao_mm,
      peso_por_metro: row.peso_por_metro,
      peso_unitario_kg: row.peso_unitario_kg,
      unidade_estoque: row.materia_prima_unidade_estoque
    };
  }

  static formatPeca(row) {
    return {
      id: row.id,
      codigo: row.codigo,
      descricao: row.descricao,
      comprimento_mm: row.comprimento_mm,
      id_materia_prima: row.id_materia_prima
    };
  }

  static formatMateriaPrima(materiaPrima) {
    return {
      id: materiaPrima.id,
      codigo: materiaPrima.codigo,
      nome: materiaPrima.nome,
      categoria: materiaPrima.categoria,
      material: materiaPrima.material,
      geometria: materiaPrima.geometria,
      bitola: materiaPrima.bitola,
      bitola_mm: materiaPrima.bitola_mm,
      comprimento_padrao_mm: round(materiaPrima.comprimento_padrao_mm, 2),
      peso_por_metro: round(materiaPrima.peso_por_metro, 4),
      peso_unitario_kg: round(materiaPrima.peso_unitario_kg, 4),
      unidade_estoque: materiaPrima.unidade_estoque || ProducaoModel.getStockConsumptionUnit(materiaPrima)
    };
  }

  static buildEstoqueSnapshot(row, materiaPrima) {
    const quantidade = round(toNumber(row.estoque_quantidade), 4) || 0;
    const unidade = materiaPrima.unidade_estoque || ProducaoModel.getStockConsumptionUnit(materiaPrima);
    const pesoPorMetro = toNumber(materiaPrima.peso_por_metro);
    const comprimentoPadraoMm = toNumber(materiaPrima.comprimento_padrao_mm);
    const fundido = ProducaoModel.isFundido(materiaPrima);
    const pesoBarraKg = !fundido && pesoPorMetro > 0 && comprimentoPadraoMm > 0
      ? round((comprimentoPadraoMm / 1000) * pesoPorMetro, 4)
      : null;

    return {
      quantidade,
      unidade,
      metros_estimados: !fundido && pesoPorMetro > 0 ? round(quantidade / pesoPorMetro, 4) : null,
      barras_estimadas: pesoBarraKg ? round(quantidade / pesoBarraKg, 2) : null,
      peso_barra_kg: pesoBarraKg,
      comprimento_padrao_mm: comprimentoPadraoMm > 0 ? round(comprimentoPadraoMm, 2) : null
    };
  }

  static calculateCapacity({ peca, materiaPrima, estoque, comprimentoCorteMm }) {
    if (ProducaoModel.isFundido(materiaPrima)) {
      return {
        pecas_possiveis: Math.floor(toNumber(estoque.quantidade)),
        consumo_por_peca: {
          quantidade_baixada: 1,
          unidade_baixa: 'UN',
          peso_kg: round(materiaPrima.peso_unitario_kg, 4)
        },
        pecas_por_barra: null,
        sobra_por_barra_mm: null
      };
    }

    const consumoUnitario = ProducaoModel.calculateMateriaPrimaConsumption({
      materiaPrima,
      peca,
      quantidadeTotal: 1,
      comprimentoCorteMm
    });
    const kgPorPeca = toNumber(consumoUnitario.quantidadeBaixadaEstoque);
    const comprimentoCorteUsado = toNumber(consumoUnitario.comprimentoCorteUsado);
    const comprimentoPadrao = toNumber(estoque.comprimento_padrao_mm);
    const pecasPorBarra = comprimentoPadrao > 0 && comprimentoCorteUsado > 0
      ? Math.floor(comprimentoPadrao / comprimentoCorteUsado)
      : null;

    return {
      pecas_possiveis: kgPorPeca > 0 ? Math.floor(toNumber(estoque.quantidade) / kgPorPeca) : 0,
      consumo_por_peca: {
        quantidade_baixada: round(consumoUnitario.quantidadeBaixadaEstoque, 4),
        unidade_baixa: consumoUnitario.unidadeBaixaEstoque,
        metros: round(consumoUnitario.quantidadeConsumida, 4),
        peso_kg: round(consumoUnitario.pesoConsumido, 4),
        comprimento_corte_mm: round(consumoUnitario.comprimentoCorteUsado, 2)
      },
      pecas_por_barra: pecasPorBarra,
      sobra_por_barra_mm: pecasPorBarra && comprimentoPadrao > 0
        ? round(comprimentoPadrao - (pecasPorBarra * comprimentoCorteUsado), 2)
        : null
    };
  }

  static buildEmptyConsumption(materiaPrima) {
    return {
      quantidadeConsumida: 0,
      unidadeConsumo: ProducaoModel.isFundido(materiaPrima) ? 'UN' : 'M',
      pesoConsumido: ProducaoModel.isFundido(materiaPrima) ? null : 0,
      comprimentoCorteUsado: null,
      quantidadeBaixadaEstoque: 0,
      unidadeBaixaEstoque: ProducaoModel.getStockConsumptionUnit(materiaPrima)
    };
  }

  static buildSimulationSummary({ quantidadePecas, usarTodoEstoque, consumo, estoque, materiaPrima }) {
    const quantidadeBaixada = round(consumo.quantidadeBaixadaEstoque, 4) || 0;
    const saldoRestante = round(toNumber(estoque.quantidade) - quantidadeBaixada, 4) || 0;
    const pesoConsumido = consumo.pesoConsumido === null || consumo.pesoConsumido === undefined
      ? null
      : round(consumo.pesoConsumido, 4);
    const barrasConsumidas = estoque.peso_barra_kg && pesoConsumido !== null
      ? round(pesoConsumido / estoque.peso_barra_kg, 2)
      : null;

    return {
      modo: usarTodoEstoque ? 'ESTOQUE_TOTAL' : 'QUANTIDADE',
      quantidade_pecas: Math.floor(toNumber(quantidadePecas)),
      saldo_suficiente: quantidadeBaixada <= toNumber(estoque.quantidade),
      saldo_restante: saldoRestante,
      unidade_saldo: estoque.unidade,
      consumo: {
        quantidade_baixada: quantidadeBaixada,
        unidade_baixa: consumo.unidadeBaixaEstoque,
        metros: consumo.unidadeConsumo === 'M' ? round(consumo.quantidadeConsumida, 4) : null,
        unidades: consumo.unidadeConsumo === 'UN' ? round(consumo.quantidadeConsumida, 4) : null,
        peso_kg: pesoConsumido,
        barras: barrasConsumidas,
        comprimento_corte_mm: round(consumo.comprimentoCorteUsado, 2)
      },
      alerta: quantidadeBaixada > toNumber(estoque.quantidade)
        ? `Faltam ${round(quantidadeBaixada - toNumber(estoque.quantidade), 4)} ${estoque.unidade} para essa quantidade.`
        : ProducaoModel.isFundido(materiaPrima)
          ? 'Saldo suficiente para a quantidade informada.'
          : 'Saldo suficiente considerando a baixa em KG da materia-prima.'
    };
  }
}

module.exports = CalculadoraMateriaPrimaModel;
