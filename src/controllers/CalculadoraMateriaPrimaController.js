const CalculadoraMateriaPrimaModel = require('../models/CalculadoraMateriaPrimaModel');

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function normalizeDecimal(value, defaultValue = null) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '').trim().toUpperCase();
  return ['1', 'TRUE', 'SIM', 'S', 'ESTOQUE_TOTAL'].includes(normalized);
}

function extractErrorResponse(error, fallbackMessage) {
  if (error.statusCode) {
    return { status: error.statusCode, body: { message: error.message } };
  }

  console.error(fallbackMessage, error);
  return { status: 500, body: { message: fallbackMessage } };
}

const CalculadoraMateriaPrimaController = {
  async getPecas(req, res) {
    try {
      const pecas = await CalculadoraMateriaPrimaModel.findPecas({
        q: req.query.q ? String(req.query.q).trim() : ''
      });

      return res.status(200).json(pecas);
    } catch (error) {
      console.error('Erro ao listar pecas da calculadora de materia-prima:', error);
      return res.status(500).json({ message: 'Erro ao listar pecas da calculadora de materia-prima.' });
    }
  },

  async simulate(req, res) {
    try {
      const payload = {
        id_peca: normalizeOptionalInteger(req.body.id_peca),
        quantidade_pecas: normalizeDecimal(req.body.quantidade_pecas),
        comprimento_corte_mm: normalizeDecimal(req.body.comprimento_corte_mm),
        usar_todo_estoque: normalizeBoolean(req.body.usar_todo_estoque || req.body.modo)
      };

      if (!Number.isInteger(payload.id_peca)) {
        return res.status(400).json({ message: 'Selecione uma peca valida para calcular.' });
      }

      const result = await CalculadoraMateriaPrimaModel.simulate(payload);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao simular consumo de materia-prima.');
      return res.status(response.status).json(response.body);
    }
  }
};

module.exports = CalculadoraMateriaPrimaController;
