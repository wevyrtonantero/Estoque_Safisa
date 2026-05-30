const SolicitacaoEstoqueModel = require('../models/SolicitacaoEstoqueModel');

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

function buildCreatePayload(body) {
  return {
    area_origem: body.area_origem ? String(body.area_origem).trim().toUpperCase() : '',
    id_peca: normalizeOptionalInteger(body.id_peca),
    quantidade_solicitada: normalizeDecimal(body.quantidade_solicitada),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function buildFulfillPayload(body) {
  return {
    quantidade_atendida: normalizeDecimal(body.quantidade_atendida),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function buildStatusPayload(body) {
  return {
    status: body.status ? String(body.status).trim().toUpperCase() : '',
    data_previsao: body.data_previsao ? String(body.data_previsao).trim() : null,
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

const SolicitacaoEstoqueController = {
  async getAll(req, res) {
    try {
      const result = await SolicitacaoEstoqueModel.findAll({
        area_origem: req.query.area_origem ? String(req.query.area_origem).trim().toUpperCase() : '',
        origem_atendimento: req.query.origem_atendimento ? String(req.query.origem_atendimento).trim().toUpperCase() : '',
        status: req.query.status ? String(req.query.status).trim().toUpperCase() : '',
        q: req.query.q ? String(req.query.q).trim() : '',
        abertas: String(req.query.abertas || '').trim() === '1'
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao listar solicitacoes de estoque:', error);
      return res.status(500).json({ message: 'Erro ao listar solicitacoes de estoque.' });
    }
  },

  async getById(req, res) {
    try {
      const result = await SolicitacaoEstoqueModel.findById(req.params.id);

      if (!result) {
        return res.status(404).json({ message: 'Solicitacao nao encontrada.' });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao buscar solicitacao de estoque:', error);
      return res.status(500).json({ message: 'Erro ao buscar solicitacao de estoque.' });
    }
  },

  async create(req, res) {
    try {
      const payload = buildCreatePayload(req.body);
      payload.origem_atendimento = req.body.origem_atendimento
        ? String(req.body.origem_atendimento).trim().toUpperCase()
        : 'ALMOXARIFADO';
      payload.solicitante_id = req.currentUser?.id || null;
      payload.notificar = req.body?.notificar !== false;

      if (!payload.area_origem) {
        return res.status(400).json({ message: 'A area de origem deve ser informada.' });
      }

      if (!Number.isInteger(payload.id_peca)) {
        return res.status(400).json({ message: 'O item solicitado deve ser valido.' });
      }

      if (!Number.isFinite(payload.quantidade_solicitada) || payload.quantidade_solicitada <= 0) {
        return res.status(400).json({ message: 'A quantidade solicitada deve ser maior que zero.' });
      }

      const result = await SolicitacaoEstoqueModel.create(payload);
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao criar solicitacao de estoque.');
      return res.status(response.status).json(response.body);
    }
  },

  async notifyResumo(req, res) {
    try {
      const result = await SolicitacaoEstoqueModel.notifyResumoSolicitacoes(
        req.body?.solicitacao_ids,
        req.currentUser?.id
      );

      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao notificar resumo das solicitacoes.');
      return res.status(response.status).json(response.body);
    }
  },

  async startSeparation(req, res) {
    try {
      const result = await SolicitacaoEstoqueModel.startSeparation(req.params.id);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao iniciar separacao da solicitacao.');
      return res.status(response.status).json(response.body);
    }
  },

  async fulfill(req, res) {
    try {
      const payload = buildFulfillPayload(req.body);

      if (!Number.isFinite(payload.quantidade_atendida) || payload.quantidade_atendida <= 0) {
        return res.status(400).json({ message: 'A quantidade atendida deve ser maior que zero.' });
      }

      const result = await SolicitacaoEstoqueModel.fulfill(req.params.id, payload);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao atender solicitacao de estoque.');
      return res.status(response.status).json(response.body);
    }
  },

  async cancel(req, res) {
    try {
      const result = await SolicitacaoEstoqueModel.cancel(req.params.id, {
        observacao: req.body.observacao ? String(req.body.observacao).trim() : null
      });
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao cancelar solicitacao de estoque.');
      return res.status(response.status).json(response.body);
    }
  },

  async updateStatus(req, res) {
    try {
      const payload = buildStatusPayload(req.body);

      if (!payload.status) {
        return res.status(400).json({ message: 'O status deve ser informado.' });
      }

      const result = await SolicitacaoEstoqueModel.updateStatus(req.params.id, payload);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao atualizar o status da solicitacao.');
      return res.status(response.status).json(response.body);
    }
  }
};

module.exports = SolicitacaoEstoqueController;
