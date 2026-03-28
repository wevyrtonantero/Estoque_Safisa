const SolicitacaoProducaoModel = require('../models/SolicitacaoProducaoModel');

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

function extractErrorResponse(error, fallbackMessage) {
  if (error.statusCode) {
    return { status: error.statusCode, body: { message: error.message } };
  }

  console.error(fallbackMessage, error);
  return { status: 500, body: { message: fallbackMessage } };
}

const SolicitacaoProducaoController = {
  async getAll(req, res) {
    try {
      const result = await SolicitacaoProducaoModel.findAll({
        area_origem: req.query.area_origem ? String(req.query.area_origem).trim().toUpperCase() : '',
        status: req.query.status ? String(req.query.status).trim().toUpperCase() : '',
        q: req.query.q ? String(req.query.q).trim() : '',
        abertas: String(req.query.abertas || '').trim() === '1'
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao listar solicitacoes de producao:', error);
      return res.status(500).json({ message: 'Erro ao listar solicitacoes de producao.' });
    }
  },

  async getById(req, res) {
    try {
      const result = await SolicitacaoProducaoModel.findById(req.params.id);

      if (!result) {
        return res.status(404).json({ message: 'Solicitacao de producao nao encontrada.' });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao buscar solicitacao de producao:', error);
      return res.status(500).json({ message: 'Erro ao buscar solicitacao de producao.' });
    }
  },

  async create(req, res) {
    try {
      const payload = {
        area_origem: req.body.area_origem ? String(req.body.area_origem).trim().toUpperCase() : '',
        id_peca: normalizeOptionalInteger(req.body.id_peca),
        quantidade_solicitada: normalizeDecimal(req.body.quantidade_solicitada),
        observacao: req.body.observacao ? String(req.body.observacao).trim() : null
      };

      if (!payload.area_origem) {
        return res.status(400).json({ message: 'A area de origem deve ser informada.' });
      }

      if (!Number.isInteger(payload.id_peca)) {
        return res.status(400).json({ message: 'A peca solicitada deve ser valida.' });
      }

      if (!Number.isFinite(payload.quantidade_solicitada) || payload.quantidade_solicitada <= 0) {
        return res.status(400).json({ message: 'A quantidade solicitada deve ser maior que zero.' });
      }

      const result = await SolicitacaoProducaoModel.create(payload);
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao criar solicitacao de producao.');
      return res.status(response.status).json(response.body);
    }
  },

  async updateStatus(req, res) {
    try {
      const payload = {
        status: req.body.status ? String(req.body.status).trim().toUpperCase() : '',
        observacao: req.body.observacao ? String(req.body.observacao).trim() : null
      };

      if (!payload.status) {
        return res.status(400).json({ message: 'O status deve ser informado.' });
      }

      const result = await SolicitacaoProducaoModel.updateStatus(req.params.id, payload);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao atualizar solicitacao de producao.');
      return res.status(response.status).json(response.body);
    }
  }
};

module.exports = SolicitacaoProducaoController;
