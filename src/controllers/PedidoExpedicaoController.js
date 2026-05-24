const PedidoExpedicaoModel = require('../models/PedidoExpedicaoModel');
const PedidoEtiquetaService = require('../services/PedidoEtiquetaService');
const { recordAuditLog } = require('../audit/auditLogger');

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeOptionalBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'sim', 'yes'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'nao', 'não', 'no'].includes(normalized)) {
    return false;
  }

  return null;
}

const PedidoExpedicaoController = {
  async list(req, res) {
    try {
      const pedidos = await PedidoExpedicaoModel.findAll({
        ativos: normalizeOptionalBoolean(req.query.ativos),
        q: req.query.q ? String(req.query.q).trim() : '',
        status: req.query.status ? String(req.query.status).trim() : ''
      });

      return res.status(200).json(pedidos);
    } catch (error) {
      console.error('Erro ao listar pedidos da Expedicao:', error);
      return res.status(500).json({ message: 'Erro ao listar os pedidos da Expedicao.' });
    }
  },

  async getById(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'O pedido informado e invalido.' });
      }

      const pedido = await PedidoExpedicaoModel.findById(id);
      if (!pedido) {
        return res.status(404).json({ message: 'Pedido nao encontrado.' });
      }

      return res.status(200).json(pedido);
    } catch (error) {
      console.error('Erro ao buscar pedido da Expedicao:', error);
      return res.status(500).json({ message: 'Erro ao buscar o pedido da Expedicao.' });
    }
  },

  async create(req, res) {
    try {
      const pedido = await PedidoExpedicaoModel.create({
        codigo_pedido: req.body?.codigo_pedido,
        cliente_nome: req.body?.cliente_nome,
        cidade: req.body?.cidade,
        data_pedido: req.body?.data_pedido,
        observacao: req.body?.observacao,
        possui_nota_fiscal: req.body?.possui_nota_fiscal,
        transportadora: req.body?.transportadora,
        vendedora: req.body?.vendedora,
        peso_total_override_kg: req.body?.peso_total_override_kg,
        quantidade_volumes: req.body?.quantidade_volumes,
        itens: Array.isArray(req.body?.itens) ? req.body.itens : [],
        usuario_id: req.currentUser?.id || null
      });

      await recordAuditLog(req, {
        modulo: 'PEDIDOS_EXPEDICAO',
        acao: 'CREATE',
        entidade_tipo: 'PEDIDO_EXPEDICAO',
        entidade_id: pedido.id,
        descricao: `Pedido ${pedido.codigo_pedido} criado para ${pedido.cliente_nome}.`,
        depois: pedido
      });

      return res.status(201).json(pedido);
    } catch (error) {
      console.error('Erro ao criar pedido da Expedicao:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao criar o pedido da Expedicao.' });
    }
  },

  async update(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'O pedido informado e invalido.' });
      }

      const pedido = await PedidoExpedicaoModel.update(id, {
        codigo_pedido: req.body?.codigo_pedido,
        cliente_nome: req.body?.cliente_nome,
        cidade: req.body?.cidade,
        data_pedido: req.body?.data_pedido,
        observacao: req.body?.observacao,
        possui_nota_fiscal: req.body?.possui_nota_fiscal,
        transportadora: req.body?.transportadora,
        vendedora: req.body?.vendedora,
        peso_total_override_kg: req.body?.peso_total_override_kg,
        quantidade_volumes: req.body?.quantidade_volumes,
        itens: Array.isArray(req.body?.itens) ? req.body.itens : [],
        usuario_id: req.currentUser?.id || null
      });

      await recordAuditLog(req, {
        modulo: 'PEDIDOS_EXPEDICAO',
        acao: 'UPDATE',
        entidade_tipo: 'PEDIDO_EXPEDICAO',
        entidade_id: pedido.id,
        descricao: `Pedido ${pedido.codigo_pedido} atualizado.`,
        depois: pedido
      });

      return res.status(200).json(pedido);
    } catch (error) {
      console.error('Erro ao atualizar pedido da Expedicao:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao atualizar o pedido da Expedicao.' });
    }
  },

  async listClientes(req, res) {
    try {
      const clientes = await PedidoExpedicaoModel.findResumoClientes({
        q: req.query.q ? String(req.query.q).trim() : '',
        limit: normalizeOptionalInteger(req.query.limit)
      });

      return res.status(200).json(clientes);
    } catch (error) {
      console.error('Erro ao listar clientes recorrentes dos pedidos:', error);
      return res.status(500).json({ message: 'Erro ao listar os clientes recorrentes.' });
    }
  },

  async reorder(req, res) {
    try {
      const orderIds = Array.isArray(req.body?.order_ids) ? req.body.order_ids : [];
      const pedidos = await PedidoExpedicaoModel.updatePrioridades(
        orderIds,
        req.currentUser?.id || null
      );

      await recordAuditLog(req, {
        modulo: 'PEDIDOS_EXPEDICAO',
        acao: 'REORDER',
        entidade_tipo: 'PEDIDO_EXPEDICAO',
        entidade_id: null,
        descricao: 'Prioridades dos pedidos da Expedicao atualizadas.',
        depois: { order_ids: orderIds }
      });

      return res.status(200).json(pedidos);
    } catch (error) {
      console.error('Erro ao atualizar prioridades dos pedidos da Expedicao:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao atualizar as prioridades dos pedidos.' });
    }
  },

  async getItemSeriais(req, res) {
    try {
      const itemId = normalizeOptionalInteger(req.params.itemId);
      if (!Number.isInteger(itemId)) {
        return res.status(400).json({ message: 'O item do pedido informado e invalido.' });
      }

      const result = await PedidoExpedicaoModel.getAvailableSeriaisForItem(itemId);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao listar numeros de serie disponiveis para o item do pedido:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao listar os numeros de serie disponiveis.' });
    }
  },

  async bindSeriais(req, res) {
    try {
      const itemId = normalizeOptionalInteger(req.params.itemId);
      if (!Number.isInteger(itemId)) {
        return res.status(400).json({ message: 'O item do pedido informado e invalido.' });
      }

      const pedido = await PedidoExpedicaoModel.vincularSeriais(
        itemId,
        Array.isArray(req.body?.serial_ids) ? req.body.serial_ids : [],
        req.currentUser?.id || null
      );

      await recordAuditLog(req, {
        modulo: 'PEDIDOS_EXPEDICAO',
        acao: 'BIND_SERIALS',
        entidade_tipo: 'PEDIDO_EXPEDICAO',
        entidade_id: pedido.id,
        descricao: `Numeros de serie vinculados ao pedido ${pedido.codigo_pedido}.`,
        depois: {
          pedido_id: pedido.id,
          item_id: itemId,
          serial_ids: req.body?.serial_ids || []
        }
      });

      return res.status(200).json(pedido);
    } catch (error) {
      console.error('Erro ao vincular numeros de serie ao pedido:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao vincular os numeros de serie ao pedido.' });
    }
  },

  async gerarEtiquetasItem(req, res) {
    try {
      const itemId = normalizeOptionalInteger(req.params.itemId);
      if (!Number.isInteger(itemId)) {
        return res.status(400).json({ message: 'O item do pedido informado e invalido.' });
      }

      const job = await PedidoEtiquetaService.buildItemPrintJob(itemId);
      return res.status(200).json(job);
    } catch (error) {
      console.error('Erro ao gerar etiquetas do item do pedido:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: error.message || 'Erro ao gerar as etiquetas do item.' });
    }
  },

  async gerarEtiquetasCaixa(req, res) {
    try {
      const pedidoId = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(pedidoId)) {
        return res.status(400).json({ message: 'O pedido informado e invalido.' });
      }

      const job = await PedidoEtiquetaService.buildCaixaPrintJob(pedidoId);
      return res.status(200).json(job);
    } catch (error) {
      console.error('Erro ao gerar etiquetas de caixa do pedido:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: error.message || 'Erro ao gerar as etiquetas da caixa.' });
    }
  },

  async registrarHistoricoImpressao(req, res) {
    try {
      const historico = await PedidoEtiquetaService.registerPrintHistory(
        Array.isArray(req.body?.entries) ? req.body.entries : [],
        {
          impressora_nome: req.body?.impressora_nome,
          id_usuario: req.currentUser?.id || null,
          usuario_nome: req.currentUser?.nome || null
        }
      );

      return res.status(201).json({
        message: 'Historico de impressao registrado com sucesso.',
        total: historico.length
      });
    } catch (error) {
      console.error('Erro ao registrar historico de impressao das etiquetas:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: error.message || 'Erro ao registrar o historico de impressao.' });
    }
  },

  async unbindSerial(req, res) {
    try {
      const bindingId = normalizeOptionalInteger(req.params.bindingId);
      if (!Number.isInteger(bindingId)) {
        return res.status(400).json({ message: 'O vinculo informado e invalido.' });
      }

      const pedido = await PedidoExpedicaoModel.desvincularSerial(
        bindingId,
        req.currentUser?.id || null
      );

      await recordAuditLog(req, {
        modulo: 'PEDIDOS_EXPEDICAO',
        acao: 'UNBIND_SERIAL',
        entidade_tipo: 'PEDIDO_EXPEDICAO',
        entidade_id: pedido.id,
        descricao: `Numero de serie desvinculado do pedido ${pedido.codigo_pedido}.`,
        depois: {
          pedido_id: pedido.id,
          binding_id: bindingId
        }
      });

      return res.status(200).json(pedido);
    } catch (error) {
      console.error('Erro ao desvincular numero de serie do pedido:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao desvincular o numero de serie do pedido.' });
    }
  },

  async toggleItemSeparado(req, res) {
    try {
      const itemId = normalizeOptionalInteger(req.params.itemId);
      if (!Number.isInteger(itemId)) {
        return res.status(400).json({ message: 'O item do pedido informado e invalido.' });
      }

      const separado = normalizeOptionalBoolean(req.body?.separado) === true;
      const pedido = await PedidoExpedicaoModel.updateItemSeparado(
        itemId,
        separado,
        req.currentUser?.id || null
      );

      await recordAuditLog(req, {
        modulo: 'PEDIDOS_EXPEDICAO',
        acao: 'TOGGLE_ITEM',
        entidade_tipo: 'PEDIDO_EXPEDICAO',
        entidade_id: pedido.id,
        descricao: `Checklist do item do pedido ${pedido.codigo_pedido} atualizado.`,
        depois: {
          pedido_id: pedido.id,
          item_id: itemId,
          separado
        }
      });

      return res.status(200).json(pedido);
    } catch (error) {
      console.error('Erro ao atualizar checklist do item do pedido:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao atualizar o checklist do item.' });
    }
  },

  async updateNotaFiscal(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'O pedido informado e invalido.' });
      }

      const pedido = await PedidoExpedicaoModel.updateNotaFiscal(
        id,
        req.body?.numero_nota_fiscal,
        req.currentUser?.id || null
      );

      await recordAuditLog(req, {
        modulo: 'PEDIDOS_EXPEDICAO',
        acao: 'UPDATE_NF',
        entidade_tipo: 'PEDIDO_EXPEDICAO',
        entidade_id: pedido.id,
        descricao: `Nota fiscal informada para o pedido ${pedido.codigo_pedido}.`,
        depois: {
          pedido_id: pedido.id,
          numero_nota_fiscal: pedido.numero_nota_fiscal
        }
      });

      return res.status(200).json(pedido);
    } catch (error) {
      console.error('Erro ao informar nota fiscal do pedido:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao informar a nota fiscal do pedido.' });
    }
  },

  async updateDadosFinais(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'O pedido informado e invalido.' });
      }

      const pedido = await PedidoExpedicaoModel.updateDadosFinais(
        id,
        {
          numero_nota_fiscal: req.body?.numero_nota_fiscal,
          peso_total_override_kg: req.body?.peso_total_override_kg,
          quantidade_volumes: req.body?.quantidade_volumes
        },
        req.currentUser?.id || null
      );

      await recordAuditLog(req, {
        modulo: 'PEDIDOS_EXPEDICAO',
        acao: 'UPDATE_DADOS_FINAIS',
        entidade_tipo: 'PEDIDO_EXPEDICAO',
        entidade_id: pedido.id,
        descricao: `Dados finais do pedido ${pedido.codigo_pedido} atualizados.`,
        depois: {
          pedido_id: pedido.id,
          numero_nota_fiscal: pedido.numero_nota_fiscal,
          peso_total_override_kg: pedido.peso_total_override_kg,
          quantidade_volumes: pedido.quantidade_volumes
        }
      });

      return res.status(200).json(pedido);
    } catch (error) {
      console.error('Erro ao atualizar os dados finais do pedido:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao atualizar os dados finais do pedido.' });
    }
  },

  async updateProgramacaoHoje(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'O pedido informado e invalido.' });
      }

      const programadoHoje = normalizeOptionalBoolean(req.body?.programado_hoje) === true;
      const pedido = await PedidoExpedicaoModel.updateProgramacaoHoje(
        id,
        programadoHoje,
        req.currentUser?.id || null
      );

      await recordAuditLog(req, {
        modulo: 'PEDIDOS_EXPEDICAO',
        acao: 'UPDATE_PROGRAMACAO_DIA',
        entidade_tipo: 'PEDIDO_EXPEDICAO',
        entidade_id: pedido.id,
        descricao: `${programadoHoje ? 'Pedido incluido' : 'Pedido removido'} da programacao do dia: ${pedido.codigo_pedido}.`,
        depois: {
          pedido_id: pedido.id,
          programado_hoje: programadoHoje,
          data_programacao_saida: pedido.data_programacao_saida
        }
      });

      return res.status(200).json(pedido);
    } catch (error) {
      console.error('Erro ao atualizar a programacao do dia do pedido:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao atualizar a programacao do dia.' });
    }
  },

  async coletar(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'O pedido informado e invalido.' });
      }

      const pedido = await PedidoExpedicaoModel.marcarColetado(
        id,
        req.currentUser
          ? {
            id: req.currentUser.id,
            login: req.currentUser.login,
            nome: req.currentUser.nome
          }
          : null
      );

      await recordAuditLog(req, {
        modulo: 'PEDIDOS_EXPEDICAO',
        acao: 'COLETAR',
        entidade_tipo: 'PEDIDO_EXPEDICAO',
        entidade_id: pedido.id,
        descricao: `Pedido ${pedido.codigo_pedido} coletado pela transportadora.`,
        depois: pedido
      });

      return res.status(200).json(pedido);
    } catch (error) {
      console.error('Erro ao coletar pedido da Expedicao:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao finalizar a coleta do pedido.' });
    }
  }
};

module.exports = PedidoExpedicaoController;
