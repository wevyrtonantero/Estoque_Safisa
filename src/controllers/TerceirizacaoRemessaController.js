const TerceirizacaoRemessaModel = require('../models/TerceirizacaoRemessaModel');
const { recordAuditLog } = require('../audit/auditLogger');
const DESTINO_ESTOQUE_MATERIA_PRIMA = 'ESTOQUE_MP';

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function normalizeDecimal(value, defaultValue = Number.NaN) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return Number.parseFloat(String(value).replace(',', '.'));
}

function normalizeTextArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry || '').trim().toUpperCase())
    .filter(Boolean);
}

function buildDispatchPayload(body) {
  return {
    id_peca: normalizeOptionalInteger(body.id_peca),
    id_fornecedor: normalizeOptionalInteger(body.id_fornecedor),
    empresa_destino: body.empresa_destino ? String(body.empresa_destino).trim() : '',
    quantidade: normalizeDecimal(body.quantidade),
    tipo_tratamento: body.tipo_tratamento ? String(body.tipo_tratamento).trim().toUpperCase() : '',
    servicos: normalizeTextArray(body.servicos).join(', '),
    dureza_hrc: body.dureza_hrc ? String(body.dureza_hrc).trim() : null,
    profundidade: body.profundidade ? String(body.profundidade).trim() : null,
    numero_nf: body.numero_nf ? String(body.numero_nf).trim() : null,
    data_nf: body.data_nf ? String(body.data_nf).trim() : null,
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function buildUpdateNfPayload(body) {
  return {
    numero_nf: body.numero_nf ? String(body.numero_nf).trim() : null,
    data_nf: body.data_nf ? String(body.data_nf).trim() : null,
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function normalizeReturnDestination(value) {
  const normalized = String(value || '').trim().toUpperCase();

  if (normalized === DESTINO_ESTOQUE_MATERIA_PRIMA) {
    return {
      destino_tipo: 'MATERIA_PRIMA',
      id_estoque_destino: null
    };
  }

  return {
    destino_tipo: 'ESTOQUE',
    id_estoque_destino: normalizeOptionalInteger(value)
  };
}

function buildReturnPayload(body) {
  const destino = normalizeReturnDestination(body.id_estoque_destino);

  return {
    id_item: normalizeOptionalInteger(body.id_item ?? body.id),
    destino_tipo: destino.destino_tipo,
    id_estoque_destino: destino.id_estoque_destino,
    quantidade_retorno: normalizeDecimal(body.quantidade_retorno),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function buildFinalizePendingPayload(body) {
  return {
    id_item: normalizeOptionalInteger(body.id_item ?? body.id),
    justificativa: body.justificativa ? String(body.justificativa).trim() : null
  };
}

function extractErrorResponse(error, fallbackMessage) {
  if (error.statusCode) {
    return { status: error.statusCode, body: { message: error.message } };
  }

  console.error(fallbackMessage, error);
  return { status: 500, body: { message: fallbackMessage } };
}

const TerceirizacaoRemessaController = {
  async getOptions(req, res) {
    try {
      const providers = await TerceirizacaoRemessaModel.getProviderOptions();
      return res.status(200).json(providers);
    } catch (error) {
      console.error('Erro ao listar opcoes de terceirizacao:', error);
      return res.status(500).json({ message: 'Erro ao listar opcoes de terceirizacao.' });
    }
  },

  async getAll(req, res) {
    try {
      const remessas = await TerceirizacaoRemessaModel.findAll({
        empresa: req.query.empresa ? String(req.query.empresa).trim() : '',
        status: req.query.status ? String(req.query.status).trim().toUpperCase() : '',
        nf: req.query.nf ? String(req.query.nf).trim() : ''
      });

      return res.status(200).json(remessas);
    } catch (error) {
      console.error('Erro ao listar remessas:', error);
      return res.status(500).json({ message: 'Erro ao listar remessas.' });
    }
  },

  async getPendingReturns(req, res) {
    try {
      const itens = await TerceirizacaoRemessaModel.findPendingReturnItems({
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : ''
      });

      return res.status(200).json(itens);
    } catch (error) {
      console.error('Erro ao listar retornos pendentes da terceirizacao:', error);
      return res.status(500).json({ message: 'Erro ao listar retornos pendentes da terceirizacao.' });
    }
  },

  async getById(req, res) {
    try {
      const remessa = await TerceirizacaoRemessaModel.findById(req.params.id);
      if (!remessa) {
        return res.status(404).json({ message: 'Remessa nao encontrada.' });
      }

      return res.status(200).json(remessa);
    } catch (error) {
      console.error('Erro ao buscar remessa:', error);
      return res.status(500).json({ message: 'Erro ao buscar remessa.' });
    }
  },

  async createDispatch(req, res) {
    try {
      const payload = buildDispatchPayload(req.body);

      if (!Number.isInteger(payload.id_peca)) {
        return res.status(400).json({ message: 'A peca informada deve ser valida.' });
      }

      if (!Number.isInteger(payload.id_fornecedor) && !payload.empresa_destino) {
        return res.status(400).json({ message: 'Informe uma empresa de tratamento valida.' });
      }

      if (payload.empresa_destino.length > 150) {
        return res.status(400).json({ message: 'A empresa de tratamento deve ter no maximo 150 caracteres.' });
      }

      if (!Number.isFinite(payload.quantidade) || payload.quantidade <= 0) {
        return res.status(400).json({ message: 'A quantidade deve ser maior que zero.' });
      }

      if (!payload.tipo_tratamento) {
        return res.status(400).json({ message: 'Informe o tipo de tratamento.' });
      }

      const result = await TerceirizacaoRemessaModel.createOrAppendDispatch(payload);
      await recordAuditLog(req, {
        modulo: 'TERCEIRIZACAO',
        acao: 'ENCAMINHAR',
        entidade_tipo: 'REMESSA',
        entidade_id: result?.remessa?.id ?? null,
        descricao: `Peca encaminhada para terceiro na remessa ${result?.remessa?.id ?? '-'}.`,
        depois: {
          payload,
          resultado: result
        }
      });
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao encaminhar peca para terceiro.');
      return res.status(response.status).json(response.body);
    }
  },

  async updateNf(req, res) {
    try {
      const remessaAnterior = await TerceirizacaoRemessaModel.findById(req.params.id);
      const result = await TerceirizacaoRemessaModel.updateNf(req.params.id, buildUpdateNfPayload(req.body));
      await recordAuditLog(req, {
        modulo: 'TERCEIRIZACAO',
        acao: 'ATUALIZAR_NF',
        entidade_tipo: 'REMESSA',
        entidade_id: req.params.id,
        descricao: `NF da remessa ${req.params.id} atualizada.`,
        antes: remessaAnterior,
        depois: result
      });
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao atualizar a NF da remessa.');
      return res.status(response.status).json(response.body);
    }
  },

  async registerReturn(req, res) {
    try {
      const payload = buildReturnPayload(req.body);

      if (!Number.isInteger(payload.id_item)) {
        return res.status(400).json({ message: 'O item da remessa deve ser valido.' });
      }

      if (payload.destino_tipo !== 'MATERIA_PRIMA' && !Number.isInteger(payload.id_estoque_destino)) {
        return res.status(400).json({ message: 'O estoque de destino deve ser valido.' });
      }

      if (!Number.isFinite(payload.quantidade_retorno) || payload.quantidade_retorno <= 0) {
        return res.status(400).json({ message: 'A quantidade de retorno deve ser maior que zero.' });
      }

      const result = await TerceirizacaoRemessaModel.registerReturn(payload);
      await recordAuditLog(req, {
        modulo: 'TERCEIRIZACAO',
        acao: 'RETORNO',
        entidade_tipo: 'REMESSA',
        entidade_id: payload.id_item,
        descricao: `Retorno de terceirizacao registrado para o item ${payload.id_item}.`,
        depois: {
          payload,
          resultado: result
        }
      });
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao registrar o retorno da terceirizacao.');
      return res.status(response.status).json(response.body);
    }
  },

  async finalizePendingItem(req, res) {
    try {
      const payload = buildFinalizePendingPayload(req.body);

      if (!Number.isInteger(payload.id_item)) {
        return res.status(400).json({ message: 'O item da remessa deve ser valido.' });
      }

      if (!payload.justificativa) {
        return res.status(400).json({ message: 'A justificativa deve ser informada.' });
      }

      const result = await TerceirizacaoRemessaModel.finalizePendingItem(payload);
      await recordAuditLog(req, {
        modulo: 'TERCEIRIZACAO',
        acao: 'FINALIZAR_PENDENCIA',
        entidade_tipo: 'REMESSA',
        entidade_id: payload.id_item,
        descricao: `Pendencia da remessa encerrada manualmente para o item ${payload.id_item}.`,
        depois: {
          payload,
          resultado: result
        }
      });
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao finalizar a pendencia da remessa.');
      return res.status(response.status).json(response.body);
    }
  }
};

module.exports = TerceirizacaoRemessaController;
