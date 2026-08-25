const { pool } = require('../../database/connection');
const PedidoExpedicaoModel = require('./PedidoExpedicaoModel');
const ComposicaoVendaModel = require('./ComposicaoVendaModel');
const EstoqueModel = require('./EstoqueModel');

const SERVO_MODELOS = Object.freeze([
  { key: 'VF040_NORMAL', label: 'VF-040 NORMAL', estoqueCodigo: 'VF040', corpoCodigo: '400' },
  { key: 'MC040_NORMAL', label: 'MC-040 NORMAL', estoqueCodigo: 'MC040', corpoCodigo: '401' },
  { key: 'MC040_REBAIXADO', label: 'MC-040 REBAIXADO', estoqueCodigo: 'MC040RB', corpoCodigo: '401RB' },
  { key: 'MBF015_NORMAL', label: 'MBF-015 NORMAL', estoqueCodigo: 'MBF015', corpoCodigo: '001' },
  { key: 'MBF015_DESLOCADO', label: 'MBF-015 DESLOCADO', estoqueCodigo: 'MBF015DESL', corpoCodigo: '001' },
  { key: 'MBF015_INV_028', label: 'MBF-015 INVERTIDO 028', estoqueCodigo: 'MBF015INV', corpoCodigo: '001' },
  { key: 'BR015_NORMAL', label: 'BR-015 NORMAL', estoqueCodigo: 'BR015', corpoCodigo: '100' },
  { key: 'BR040_NORMAL', label: 'BR-040 NORMAL', estoqueCodigo: 'BR040', corpoCodigo: '350' },
  { key: 'BR040_INV_015VF', label: 'BR-040 INVERTIDO 015/VF', estoqueCodigo: 'BR040INV', corpoCodigo: '350' },
  { key: 'BR040_INV_028', label: 'BR-040 INVERTIDO 028', estoqueCodigo: 'BR040INV028', corpoCodigo: '350' },
  { key: 'MBF025_NORMAL', label: 'MBF-025 NORMAL', estoqueCodigo: 'MBF025', estoqueCodigos: ['MBF025', 'MBF028'], corpoCodigo: '300' },
  { key: 'MBF025_INV_015VF', label: 'MBF-025 INVERTIDO 015/VF', estoqueCodigo: 'MBF025INV015', estoqueCodigos: ['MBF025INV015', 'MBF028INV015'], corpoCodigo: '300' },
  { key: 'MBF032_NORMAL', label: 'MBF-032 NORMAL', estoqueCodigo: 'MBF032', corpoCodigo: '450' },
  { key: 'MBF032_INV_028', label: 'MBF-032 INVERTIDO 028', estoqueCodigo: 'MBF032INV', corpoCodigo: '450' },
  { key: 'CJ015_NORMAL', label: 'CJ-015 NORMAL', estoqueCodigo: 'CJ015', corpoCodigo: '250' },
  { key: 'MBF040_NORMAL', label: 'MBF-040 NORMAL', estoqueCodigo: 'MBF040', corpoCodigo: '300' },
  { key: 'MBF040_INV_028', label: 'MBF-040 INVERTIDO 028', estoqueCodigo: 'MBF040INV028', corpoCodigo: '300' },
  { key: 'AL10_NORMAL', label: 'AL-10 NORMAL', estoqueCodigo: 'AL10', corpoCodigo: '550' },
  { key: 'AL10_INV_028', label: 'AL-10 INVERTIDO 028', estoqueCodigo: 'AL10INV', corpoCodigo: '550' },
  { key: 'SAF040_NORMAL', label: 'SAF-040 NORMAL', estoqueCodigo: 'SAF040', corpoCodigo: '600' }
]);

const BUSINESS_TIME_ZONE = process.env.APP_TIME_ZONE || 'America/Sao_Paulo';

function normalizeScope(value) {
  return String(value || 'global').trim().toLowerCase() === 'dia' ? 'dia' : 'global';
}

function normalizeDateOnly(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDateOnly() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    if (values.year && values.month && values.day) {
      return `${values.year}-${values.month}-${values.day}`;
    }
  } catch (_) {
    // Mantem fallback local do servidor se o timezone configurado nao estiver disponivel.
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundDisplay(value) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized)) {
    return 0;
  }

  return Number(normalized.toFixed(2));
}

function formatTitleDate() {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: BUSINESS_TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date());
  } catch (_) {
    // Mantem fallback local do servidor se o timezone configurado nao estiver disponivel.
  }

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

function classifyModelRow(context) {
  const saleCode = String(context.saleCode || '').trim().toUpperCase();
  const saleDescription = String(context.saleDescription || '').trim().toUpperCase();
  const servoCode = String(context.servoCode || '').trim().toUpperCase();

  if (saleCode === '1H' || saleDescription.includes('DESLOCAD')) {
    return 'MBF015_DESLOCADO';
  }

  if (servoCode === 'MBF015INV' || saleCode === '1F') {
    return 'MBF015_INV_028';
  }

  if (servoCode === 'MBF015') {
    return 'MBF015_NORMAL';
  }

  if (servoCode === 'VF040') {
    return 'VF040_NORMAL';
  }

  if (servoCode === 'MC040RB') {
    return 'MC040_REBAIXADO';
  }

  if (servoCode === 'MC040') {
    return 'MC040_NORMAL';
  }

  if (servoCode === 'BR015') {
    return 'BR015_NORMAL';
  }

  if (servoCode === 'BR040INV') {
    return 'BR040_INV_015VF';
  }

  if (servoCode === 'BR040INV028') {
    return 'BR040_INV_028';
  }

  if (servoCode === 'BR040') {
    return 'BR040_NORMAL';
  }

  if (servoCode === 'MBF025INV015' || servoCode === 'MBF028INV015') {
    return 'MBF025_INV_015VF';
  }

  if (servoCode === 'MBF025' || servoCode === 'MBF028') {
    if (['2F', '2H'].includes(saleCode) || saleDescription.includes('INVERTIDO')) {
      return 'MBF025_INV_015VF';
    }
    return 'MBF025_NORMAL';
  }

  if (servoCode === 'MBF032INV' || ['9C', '9D'].includes(saleCode)) {
    return 'MBF032_INV_028';
  }

  if (servoCode === 'MBF032') {
    return 'MBF032_NORMAL';
  }

  if (servoCode === 'CJ015') {
    return 'CJ015_NORMAL';
  }

  if (servoCode === 'MBF040INV028') {
    return 'MBF040_INV_028';
  }

  if (servoCode === 'MBF040') {
    return 'MBF040_NORMAL';
  }

  if (servoCode === 'AL10INV' || saleCode === '11A') {
    return 'AL10_INV_028';
  }

  if (servoCode === 'AL10') {
    return 'AL10_NORMAL';
  }

  if (servoCode === 'SAF040') {
    return 'SAF040_NORMAL';
  }

  return null;
}

class GerenciamentoServosModel {
  static MODEL_DEFINITIONS = SERVO_MODELOS;

  static buildEmptyOrderMap(orderIds) {
    return Object.fromEntries(orderIds.map((id) => [String(id), 0]));
  }

  static async findRelevantOrders(scope = 'global', connection = pool) {
    const today = getTodayDateOnly();
    const pedidos = await PedidoExpedicaoModel.fetchPedidos({ ativos: true }, connection);

    return pedidos.filter((pedido) => {
      if (scope !== 'dia') {
        return true;
      }

      return normalizeDateOnly(pedido.data_programacao_saida) === today;
    });
  }

  static async buildCompositionMap(idsItemVenda, connection = pool) {
    if (!idsItemVenda.length) {
      return new Map();
    }

    const rows = await ComposicaoVendaModel.findAll({ ids_item_venda: idsItemVenda }, connection);
    const map = new Map();

    rows.forEach((row) => {
      const id = Number(row.id_item_venda);
      if (!map.has(id)) {
        map.set(id, []);
      }
      map.get(id).push(row);
    });

    return map;
  }

  static async getStockIds(connection = pool) {
    const stocks = await EstoqueModel.findStocks();
    const getByKeyword = (keyword) => stocks.find((stock) => String(stock.nome || '').toUpperCase().includes(keyword));

    return {
      todos: stocks
        .map((stock) => Number(stock.id))
        .filter((id) => Number.isInteger(id) && id > 0),
      montagem: Number(getByKeyword('MONT')?.id || 0),
      almoxarifado: Number(getByKeyword('ALMOX')?.id || 0),
      expedicao: Number(getByKeyword('EXPED')?.id || 0)
    };
  }

  static async queryPieceStockByCodes(codes, stockIds, connection = pool) {
    if (!codes.length || !stockIds.length) {
      return new Map();
    }

    const uniqueCodes = [...new Set(codes.filter(Boolean))];
    const uniqueStocks = [...new Set(stockIds.filter((id) => Number.isInteger(id) && id > 0))];

    if (!uniqueCodes.length || !uniqueStocks.length) {
      return new Map();
    }

    const [rows] = await connection.query(
      `
        SELECT
          p.codigo,
          SUM(COALESCE(s.quantidade, 0)) AS quantidade
        FROM estoque_saldos s
        INNER JOIN pecas p ON p.id = s.id_peca
        WHERE p.codigo IN (${uniqueCodes.map(() => '?').join(', ')})
          AND s.id_estoque IN (${uniqueStocks.map(() => '?').join(', ')})
        GROUP BY p.codigo
      `,
      [...uniqueCodes, ...uniqueStocks]
    );

    return new Map(rows.map((row) => [String(row.codigo), roundDisplay(row.quantidade)]));
  }

  static async queryZincoByBodyCodes(bodyCodes, connection = pool) {
    if (!bodyCodes.length) {
      return new Map();
    }

    const uniqueCodes = [...new Set(bodyCodes.filter(Boolean))];
    const [rows] = await connection.query(
      `
        SELECT
          p.codigo,
          SUM(GREATEST(COALESCE(ri.quantidade_enviada, 0) - COALESCE(ri.quantidade_retorno, 0), 0)) AS quantidade
        FROM terceirizacao_remessa_itens ri
        INNER JOIN terceirizacao_remessas r ON r.id = ri.id_remessa
        INNER JOIN pecas p ON p.id = ri.id_peca
        WHERE p.codigo IN (${uniqueCodes.map(() => '?').join(', ')})
          AND r.status IN ('ENVIADA', 'RETORNO_PARCIAL')
          AND ri.status IN ('ENVIADO', 'RETORNO_PARCIAL')
          AND COALESCE(ri.encerrado_manualmente, 0) = 0
          AND COALESCE(ri.quantidade_enviada, 0) > COALESCE(ri.quantidade_retorno, 0)
        GROUP BY p.codigo
      `,
      uniqueCodes
    );

    return new Map(rows.map((row) => [String(row.codigo), roundDisplay(row.quantidade)]));
  }

  static async queryUsinagemByBodyCodes(bodyCodes, connection = pool) {
    if (!bodyCodes.length) {
      return new Map();
    }

    const uniqueCodes = [...new Set(bodyCodes.filter(Boolean))];
    const [rows] = await connection.query(
      `
        SELECT
          saldos.codigo,
          SUM(saldos.quantidade) AS quantidade
        FROM (
          SELECT
            p.codigo,
            SUM(COALESCE(po.quantidade_planejada, 0)) AS quantidade
          FROM producao_ordens po
          INNER JOIN pecas p ON p.id = po.id_peca
          WHERE po.status = 'EM_ANDAMENTO'
            AND p.codigo IN (${uniqueCodes.map(() => '?').join(', ')})
          GROUP BY p.codigo

          UNION ALL

          SELECT
            p.codigo,
            SUM(COALESCE(t.quantidade, 0)) AS quantidade
          FROM tratamento_externo_saldos t
          INNER JOIN pecas p ON p.id = t.id_peca
          WHERE t.quantidade > 0
            AND p.codigo IN (${uniqueCodes.map(() => '?').join(', ')})
          GROUP BY p.codigo
        ) saldos
        GROUP BY saldos.codigo
      `,
      [...uniqueCodes, ...uniqueCodes]
    );

    return new Map(rows.map((row) => [String(row.codigo), roundDisplay(row.quantidade)]));
  }

  static classifyItemDemand(item, composicao) {
    if (Array.isArray(composicao) && composicao.length > 0) {
      const servoLine = composicao.find((linha) => classifyModelRow({
        saleCode: item.codigo,
        saleDescription: item.descricao,
        servoCode: linha.item_atende_codigo
      }));

      if (servoLine) {
        return {
          modelKey: classifyModelRow({
            saleCode: item.codigo,
            saleDescription: item.descricao,
            servoCode: servoLine.item_atende_codigo
          }),
          quantidade: Number(item.quantidade || 0) * Number(servoLine.quantidade || 1),
          servoCode: servoLine.item_atende_codigo
        };
      }
    }

    const directKey = classifyModelRow({
      saleCode: item.codigo,
      saleDescription: item.descricao,
      servoCode: item.codigo
    });

    if (!directKey) {
      return null;
    }

    return {
      modelKey: directKey,
      quantidade: Number(item.quantidade || 0),
      servoCode: item.codigo
    };
  }

  static buildSharedBodyStats() {
    const counts = new Map();
    const primaryModelByCodigo = new Map();
    this.MODEL_DEFINITIONS.forEach((model) => {
      counts.set(model.corpoCodigo, (counts.get(model.corpoCodigo) || 0) + 1);
      if (!primaryModelByCodigo.has(model.corpoCodigo)) {
        primaryModelByCodigo.set(model.corpoCodigo, model.key);
      }
    });
    return { counts, primaryModelByCodigo };
  }

  static buildSharedServoStats() {
    const counts = new Map();
    this.MODEL_DEFINITIONS.forEach((model) => {
      counts.set(model.estoqueCodigo, (counts.get(model.estoqueCodigo) || 0) + 1);
    });
    return counts;
  }

  static getModelStockCodes(model) {
    const aliases = Array.isArray(model?.estoqueCodigos) && model.estoqueCodigos.length > 0
      ? model.estoqueCodigos
      : [model?.estoqueCodigo];

    return [...new Set(
      aliases
        .map((code) => String(code || '').trim().toUpperCase())
        .filter(Boolean)
    )];
  }

  static getStockQuantityForModel(stockMap, model) {
    return this.getModelStockCodes(model).reduce(
      (sum, code) => sum + toNumber(stockMap.get(code)),
      0
    );
  }

  static isPrimarySharedRow(sharedKey, model, sharedMap) {
    const sharedCount = Number(sharedMap.get(sharedKey) || 0);
    if (sharedCount <= 1) {
      return true;
    }

    return String(model.key || '').endsWith('_NORMAL');
  }

  static isPrimaryBodyRow(model, bodyShareStats) {
    return bodyShareStats.primaryModelByCodigo.get(model.corpoCodigo) === model.key;
  }

  static async getMatrix(scope = 'global', connection = pool) {
    const normalizedScope = normalizeScope(scope);
    const pedidosBase = await this.findRelevantOrders(normalizedScope, connection);
    const pedidoIdsBase = pedidosBase.map((pedido) => Number(pedido.id));
    const itensBase = await PedidoExpedicaoModel.fetchItensByPedidoIds(pedidoIdsBase, connection);
    const composicaoMap = await this.buildCompositionMap([...new Set(itensBase.map((item) => Number(item.id_peca)))], connection);
    const stockIds = await this.getStockIds(connection);
    const modelKeys = new Set(this.MODEL_DEFINITIONS.map((model) => model.key));
    const demandasPorItem = new Map();
    const pedidosComServoIds = new Set();

    itensBase.forEach((item) => {
      const classificacao = this.classifyItemDemand(item, composicaoMap.get(Number(item.id_peca)) || []);
      if (!classificacao || !modelKeys.has(classificacao.modelKey) || toNumber(classificacao.quantidade) <= 0) {
        return;
      }

      const quantidadePendente = Math.max(
        0,
        toNumber(classificacao.quantidade) - toNumber(item.quantidade_seriais_vinculados)
      );

      if (quantidadePendente <= 0) {
        return;
      }

      demandasPorItem.set(Number(item.id), {
        ...classificacao,
        quantidade: quantidadePendente,
        quantidade_total: toNumber(classificacao.quantidade),
        quantidade_seriais_vinculados: toNumber(item.quantidade_seriais_vinculados)
      });
      pedidosComServoIds.add(Number(item.id_pedido));
    });

    const pedidos = pedidosBase.filter((pedido) => pedidosComServoIds.has(Number(pedido.id)));
    const pedidoIds = pedidos.map((pedido) => Number(pedido.id));
    const itens = itensBase.filter((item) => pedidosComServoIds.has(Number(item.id_pedido)));

    const pedidosColumns = pedidos.map((pedido) => ({
      id: Number(pedido.id),
      cliente_nome: pedido.cliente_nome,
      codigo_pedido: pedido.codigo_pedido || `PED-${String(pedido.id).padStart(6, '0')}`,
      cidade: pedido.cidade || '-',
      prioridade_ordem: Number(pedido.prioridade_ordem || 0)
    }));

    const orderIds = pedidosColumns.map((pedido) => pedido.id);
    const rowMap = new Map(
      this.MODEL_DEFINITIONS.map((model) => [
        model.key,
        {
          key: model.key,
          label: model.label,
          estoque_codigo: model.estoqueCodigo,
          corpo_codigo: model.corpoCodigo,
          pedidos: this.buildEmptyOrderMap(orderIds),
          total: 0
        }
      ])
    );

    itens.forEach((item) => {
      const classificacao = demandasPorItem.get(Number(item.id));
      if (!classificacao || !rowMap.has(classificacao.modelKey)) {
        return;
      }

      const row = rowMap.get(classificacao.modelKey);
      const pedidoKey = String(item.id_pedido);
      row.pedidos[pedidoKey] = roundDisplay(toNumber(row.pedidos[pedidoKey]) + toNumber(classificacao.quantidade));
      row.total = roundDisplay(row.total + toNumber(classificacao.quantidade));
    });

    const servoStockMap = await this.queryPieceStockByCodes(
      this.MODEL_DEFINITIONS.flatMap((model) => this.getModelStockCodes(model)),
      stockIds.todos,
      connection
    );
    const bodyCodes = this.MODEL_DEFINITIONS.map((model) => model.corpoCodigo);
    const [corpoStockMap, zincoMap, usinagemMap] = await Promise.all([
      this.queryPieceStockByCodes(bodyCodes, stockIds.todos, connection),
      this.queryZincoByBodyCodes(bodyCodes, connection),
      this.queryUsinagemByBodyCodes(bodyCodes, connection)
    ]);

    const bodyShareStats = this.buildSharedBodyStats();
    const servoShareMap = this.buildSharedServoStats();
    const rows = this.MODEL_DEFINITIONS.map((model) => {
      const current = rowMap.get(model.key);
      const isPrimaryStockRow = this.isPrimarySharedRow(model.estoqueCodigo, model, servoShareMap);
      const isPrimaryBodyRow = this.isPrimaryBodyRow(model, bodyShareStats);
      const estoque = isPrimaryStockRow ? roundDisplay(this.getStockQuantityForModel(servoStockMap, model)) : null;
      const corpos = isPrimaryBodyRow ? roundDisplay(corpoStockMap.get(model.corpoCodigo) || 0) : null;
      const zinco = isPrimaryBodyRow ? roundDisplay(zincoMap.get(model.corpoCodigo) || 0) : null;
      const usinagem = isPrimaryBodyRow ? roundDisplay(usinagemMap.get(model.corpoCodigo) || 0) : null;
      const saldoFinal = isPrimaryStockRow && isPrimaryBodyRow
        ? roundDisplay(
          (toNumber(estoque) + toNumber(corpos) + toNumber(zinco) + toNumber(usinagem)) - current.total
        )
        : null;

      return {
        ...current,
        estoque,
        corpos,
        zinco,
        usinagem,
        saldo_final: saldoFinal,
        estoque_compartilhado: Number(servoShareMap.get(model.estoqueCodigo) || 0) > 1,
        corpo_compartilhado: Number(bodyShareStats.counts.get(model.corpoCodigo) || 0) > 1,
        exibe_estoque_compartilhado: isPrimaryStockRow,
        exibe_recursos_corpo: isPrimaryBodyRow
      };
    });

    const resumo = {
      escopo: normalizedScope,
      data_referencia: formatTitleDate(),
      pedidos: pedidosColumns.length,
      modelos: rows.length,
      demanda_total: roundDisplay(rows.reduce((sum, row) => sum + toNumber(row.total), 0)),
      estoque_total: roundDisplay(rows.reduce((sum, row) => sum + toNumber(row.estoque), 0)),
      corpos_total: roundDisplay(rows.reduce((sum, row) => sum + toNumber(row.corpos), 0)),
      zinco_total: roundDisplay(rows.reduce((sum, row) => sum + toNumber(row.zinco), 0)),
      usinagem_total: roundDisplay(rows.reduce((sum, row) => sum + toNumber(row.usinagem), 0)),
      saldo_total: roundDisplay(rows.reduce((sum, row) => sum + toNumber(row.saldo_final), 0))
    };

    return {
      escopo: normalizedScope,
      data_referencia: resumo.data_referencia,
      pedidos: pedidosColumns,
      rows,
      resumo
    };
  }
}

module.exports = GerenciamentoServosModel;
