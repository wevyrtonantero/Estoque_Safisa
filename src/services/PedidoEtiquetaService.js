const PedidoExpedicaoModel = require('../models/PedidoExpedicaoModel');
const EtiquetaModel = require('../models/EtiquetaModel');
const EtiquetaHistoricoModel = require('../models/EtiquetaHistoricoModel');
const {
  ETIQUETA_CATEGORIAS,
  getDefaultAvulsaLayoutJson,
  getDefaultCaixaLayoutJson,
  gerarZplEtiqueta
} = require('./EtiquetaZplService');

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizePrinterName(value) {
  const normalized = String(value || '').trim();
  return normalized || 'IMPRESSORA PADRAO';
}

function buildPedidoSnapshot(pedido) {
  return {
    id: pedido.id,
    codigo_pedido: pedido.codigo_pedido,
    cliente_nome: pedido.cliente_nome,
    cidade: pedido.cidade,
    data_pedido: pedido.data_pedido,
    numero_nota_fiscal: pedido.numero_nota_fiscal || null,
    transportadora: pedido.transportadora || null,
    quantidade_volumes: pedido.quantidade_volumes ?? null,
    status: pedido.status
  };
}

function buildVirtualEtiqueta(categoria, layoutJson) {
  return {
    id: null,
    id_peca: null,
    codigo_item: categoria,
    categoria,
    titulo: '',
    aplicacao_linha_1: '',
    aplicacao_linha_2: '',
    aplicacao_linha_3: '',
    codigo_barras: '',
    ativo: true,
    layout_json: layoutJson
  };
}

class PedidoEtiquetaService {
  static createBusinessError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  }

  static getHydratedItemOrThrow(pedido, itemId) {
    const item = (pedido?.itens || []).find((entry) => Number(entry.id) === Number(itemId));
    if (!pedido || !item) {
      throw this.createBusinessError('Item do pedido nao encontrado.');
    }

    return item;
  }

  static buildHistoryEntry(base = {}, overrides = {}) {
    return {
      id_etiqueta: base.id_etiqueta ?? null,
      id_peca: base.id_peca ?? null,
      codigo_item: base.codigo_item || null,
      codigo_pedido: base.codigo_pedido || null,
      numero_serie: base.numero_serie ?? null,
      impressora_nome: null,
      id_usuario: null,
      usuario_nome: null,
      dados_pedido_json: base.dados_pedido_json || null,
      zpl_gerado: base.zpl_gerado || '',
      ...overrides
    };
  }

  static async buildItemPrintJob(idPedidoItem) {
    const itemId = normalizeOptionalInteger(idPedidoItem);
    if (!Number.isInteger(itemId)) {
      throw this.createBusinessError('O item do pedido informado e invalido.');
    }

    const itemBase = await PedidoExpedicaoModel.getItemById(itemId);
    if (!itemBase) {
      throw this.createBusinessError('Item do pedido nao encontrado.', 404);
    }

    const pedido = await PedidoExpedicaoModel.findById(Number(itemBase.id_pedido));
    if (!pedido) {
      throw this.createBusinessError('Pedido nao encontrado.', 404);
    }

    const item = this.getHydratedItemOrThrow(pedido, itemId);
    const pedidoSnapshot = buildPedidoSnapshot(pedido);

    if (item.exige_numero_serie) {
      const etiqueta = await EtiquetaModel.findActiveByCodigo(item.codigo);
      if (!etiqueta) {
        throw this.createBusinessError(`Nao existe etiqueta ativa cadastrada para o codigo ${item.codigo}.`);
      }

      const seriais = Array.isArray(item.seriais_vinculados) ? item.seriais_vinculados : [];
      if (!seriais.length) {
        throw this.createBusinessError('Vincule ao menos um numero de serie antes de imprimir a etiqueta deste item.');
      }

      const labels = seriais.map((serial, index) => {
        const numeroSerie = String(serial.numero_serie || '').trim();
        const zpl = gerarZplEtiqueta(etiqueta, {
          numeroSerie,
          pedido: pedidoSnapshot
        });

        return {
          ordem: index + 1,
          tipo: 'ITEM_SERIADO',
          codigo_item: item.codigo,
          descricao: item.descricao,
          numero_serie: numeroSerie,
          zpl,
          history: this.buildHistoryEntry({
            id_etiqueta: etiqueta.id,
            id_peca: etiqueta.id_peca,
            codigo_item: item.codigo,
            codigo_pedido: pedido.codigo_pedido,
            numero_serie: numeroSerie,
            dados_pedido_json: {
              ...pedidoSnapshot,
              item_id: item.id,
              item_codigo: item.codigo,
              item_descricao: item.descricao,
              quantidade_item: item.quantidade
            },
            zpl_gerado: zpl
          })
        };
      });

      return {
        tipo_job: 'ITEM_SERIADO',
        pedido_id: pedido.id,
        item_id: item.id,
        codigo_pedido: pedido.codigo_pedido,
        cliente_nome: pedido.cliente_nome,
        codigo_item: item.codigo,
        descricao: item.descricao,
        quantidade_etiquetas: labels.length,
        labels
      };
    }

    const etiquetaAvulsa = buildVirtualEtiqueta(
      ETIQUETA_CATEGORIAS.ITEM_AVULSO,
      getDefaultAvulsaLayoutJson()
    );
    const zpl = gerarZplEtiqueta(etiquetaAvulsa, {
      codigoItem: item.codigo,
      descricao: item.descricao,
      quantidade: item.quantidade,
      pedido: pedidoSnapshot
    });

    return {
      tipo_job: 'ITEM_AVULSO',
      pedido_id: pedido.id,
      item_id: item.id,
      codigo_pedido: pedido.codigo_pedido,
      cliente_nome: pedido.cliente_nome,
      codigo_item: item.codigo,
      descricao: item.descricao,
      quantidade_etiquetas: 1,
      labels: [
        {
          ordem: 1,
          tipo: 'ITEM_AVULSO',
          codigo_item: item.codigo,
          descricao: item.descricao,
          quantidade: Number(item.quantidade || 0),
          zpl,
          history: this.buildHistoryEntry({
            id_etiqueta: null,
            id_peca: Number(item.id_peca),
            codigo_item: item.codigo,
            codigo_pedido: pedido.codigo_pedido,
            numero_serie: null,
            dados_pedido_json: {
              ...pedidoSnapshot,
              item_id: item.id,
              item_codigo: item.codigo,
              item_descricao: item.descricao,
              quantidade_item: item.quantidade
            },
            zpl_gerado: zpl
          })
        }
      ]
    };
  }

  static async buildCaixaPrintJob(idPedido) {
    const pedidoId = normalizeOptionalInteger(idPedido);
    if (!Number.isInteger(pedidoId)) {
      throw this.createBusinessError('O pedido informado e invalido.');
    }

    const pedido = await PedidoExpedicaoModel.findById(pedidoId);
    if (!pedido) {
      throw this.createBusinessError('Pedido nao encontrado.', 404);
    }

    const quantidadeVolumes = normalizeOptionalInteger(pedido.quantidade_volumes);
    if (!Number.isInteger(quantidadeVolumes) || quantidadeVolumes <= 0) {
      throw this.createBusinessError('Informe a quantidade de volumes antes de imprimir as etiquetas da caixa.');
    }

    const etiquetaCaixa = buildVirtualEtiqueta(
      ETIQUETA_CATEGORIAS.CAIXA,
      getDefaultCaixaLayoutJson()
    );
    const pedidoSnapshot = buildPedidoSnapshot(pedido);
    const labels = [];

    for (let index = 1; index <= quantidadeVolumes; index += 1) {
      const zpl = gerarZplEtiqueta(etiquetaCaixa, {
        clienteNome: pedido.cliente_nome,
        numeroNotaFiscal: pedido.numero_nota_fiscal || '',
        transportadora: pedido.transportadora || '',
        volumeAtual: index,
        volumeTotal: quantidadeVolumes,
        pedido: pedidoSnapshot
      });

      labels.push({
        ordem: index,
        tipo: 'CAIXA',
        volume_atual: index,
        volume_total: quantidadeVolumes,
        volume_label: `${index}/${quantidadeVolumes}`,
        zpl,
        history: this.buildHistoryEntry({
          id_etiqueta: null,
          id_peca: null,
          codigo_item: 'CAIXA',
          codigo_pedido: pedido.codigo_pedido,
          numero_serie: null,
          dados_pedido_json: {
            ...pedidoSnapshot,
            volume_atual: index,
            volume_total: quantidadeVolumes
          },
          zpl_gerado: zpl
        })
      });
    }

    return {
      tipo_job: 'CAIXA',
      pedido_id: pedido.id,
      codigo_pedido: pedido.codigo_pedido,
      cliente_nome: pedido.cliente_nome,
      quantidade_etiquetas: labels.length,
      labels
    };
  }

  static async registerPrintHistory(entries = [], context = {}) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    if (!safeEntries.length) {
      return [];
    }

    const impressoraNome = normalizePrinterName(context.impressora_nome);
    const idUsuario = context.id_usuario || null;
    const usuarioNome = String(context.usuario_nome || '').trim() || null;
    const created = [];

    for (const entry of safeEntries) {
      const history = await EtiquetaHistoricoModel.create({
        ...entry,
        impressora_nome: impressoraNome,
        id_usuario: idUsuario,
        usuario_nome: usuarioNome
      });

      created.push(history);
    }

    return created;
  }
}

module.exports = PedidoEtiquetaService;
