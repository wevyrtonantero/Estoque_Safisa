const EstoqueMateriaPrimaModel = require('../models/EstoqueMateriaPrimaModel');

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

function buildEntradaPayload(body) {
  return {
    id_materia_prima: normalizeOptionalInteger(body.id_materia_prima),
    quantidade: normalizeDecimal(body.quantidade),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function buildAjustePayload(body) {
  return {
    id_materia_prima: normalizeOptionalInteger(body.id_materia_prima),
    novo_saldo: normalizeDecimal(body.novo_saldo),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function validateEntradaPayload(payload) {
  const errors = [];

  if (!Number.isInteger(payload.id_materia_prima)) {
    errors.push('A materia-prima informada deve ser valida.');
  }

  if (!Number.isFinite(payload.quantidade) || payload.quantidade <= 0) {
    errors.push('A quantidade deve ser maior que zero.');
  }

  return errors;
}

function validateAjustePayload(payload) {
  const errors = [];

  if (!Number.isInteger(payload.id_materia_prima)) {
    errors.push('A materia-prima informada deve ser valida.');
  }

  if (!Number.isFinite(payload.novo_saldo) || payload.novo_saldo < 0) {
    errors.push('O novo saldo deve ser maior ou igual a zero.');
  }

  return errors;
}

function extractErrorResponse(error, fallbackMessage) {
  if (error.statusCode) {
    return { status: error.statusCode, body: { message: error.message } };
  }

  console.error(fallbackMessage, error);
  return { status: 500, body: { message: fallbackMessage } };
}

const EstoqueMateriaPrimaController = {
  async getSaldos(req, res) {
    try {
      const saldos = await EstoqueMateriaPrimaModel.findSaldos({
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        nome: req.query.nome ? String(req.query.nome).trim() : '',
        categoria: req.query.categoria ? String(req.query.categoria).trim().toUpperCase() : '',
        geometria: req.query.geometria ? String(req.query.geometria).trim().toUpperCase() : '',
        bitola: req.query.bitola ? String(req.query.bitola).trim() : ''
      });

      return res.status(200).json(saldos);
    } catch (error) {
      console.error('Erro ao listar saldos de materia-prima:', error);
      return res.status(500).json({ message: 'Erro ao listar saldos de materia-prima.' });
    }
  },

  async getMovimentacoes(req, res) {
    try {
      const idMateriaPrima = normalizeOptionalInteger(req.query.id_materia_prima);
      const movimentacoes = await EstoqueMateriaPrimaModel.findMovimentacoes({
        id_materia_prima: Number.isInteger(idMateriaPrima) ? idMateriaPrima : null
      });

      return res.status(200).json(movimentacoes);
    } catch (error) {
      console.error('Erro ao listar movimentacoes de materia-prima:', error);
      return res.status(500).json({ message: 'Erro ao listar movimentacoes de materia-prima.' });
    }
  },

  async createEntrada(req, res) {
    try {
      const payload = buildEntradaPayload(req.body);
      const errors = validateEntradaPayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const result = await EstoqueMateriaPrimaModel.processEntrada(payload);
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao registrar entrada de materia-prima.');
      return res.status(response.status).json(response.body);
    }
  },

  async createAjuste(req, res) {
    try {
      const payload = buildAjustePayload(req.body);
      const errors = validateAjustePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const result = await EstoqueMateriaPrimaModel.processAjuste(payload);
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao ajustar saldo da materia-prima.');
      return res.status(response.status).json(response.body);
    }
  }
};

module.exports = EstoqueMateriaPrimaController;
