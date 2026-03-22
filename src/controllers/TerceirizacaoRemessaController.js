const TerceirizacaoRemessaModel = require('../models/TerceirizacaoRemessaModel');

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

function buildReturnPayload(body) {
  return {
    id_item: normalizeOptionalInteger(body.id_item ?? body.id),
    id_estoque_destino: normalizeOptionalInteger(body.id_estoque_destino),
    quantidade_retorno: normalizeDecimal(body.quantidade_retorno),
    observacao: body.observacao ? String(body.observacao).trim() : null
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

      if (!Number.isInteger(payload.id_fornecedor)) {
        return res.status(400).json({ message: 'A empresa de tratamento deve ser valida.' });
      }

      if (!Number.isFinite(payload.quantidade) || payload.quantidade <= 0) {
        return res.status(400).json({ message: 'A quantidade deve ser maior que zero.' });
      }

      if (!payload.tipo_tratamento) {
        return res.status(400).json({ message: 'Informe o tipo de tratamento.' });
      }

      const result = await TerceirizacaoRemessaModel.createOrAppendDispatch(payload);
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao encaminhar peca para terceiro.');
      return res.status(response.status).json(response.body);
    }
  },

  async updateNf(req, res) {
    try {
      const result = await TerceirizacaoRemessaModel.updateNf(req.params.id, buildUpdateNfPayload(req.body));
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

      if (!Number.isInteger(payload.id_estoque_destino)) {
        return res.status(400).json({ message: 'O estoque de destino deve ser valido.' });
      }

      if (!Number.isFinite(payload.quantidade_retorno) || payload.quantidade_retorno <= 0) {
        return res.status(400).json({ message: 'A quantidade de retorno deve ser maior que zero.' });
      }

      const result = await TerceirizacaoRemessaModel.registerReturn(payload);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao registrar o retorno da terceirizacao.');
      return res.status(response.status).json(response.body);
    }
  }
};

module.exports = TerceirizacaoRemessaController;
