const ProducaoModel = require('../models/ProducaoModel');

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function normalizeOptionalDecimal(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return Number.parseFloat(String(value).replace(',', '.'));
}

function buildCreatePayload(body) {
  return {
    id_maquina: normalizeOptionalInteger(body.id_maquina),
    id_peca: normalizeOptionalInteger(body.id_peca),
    quantidade_planejada: normalizeOptionalInteger(body.quantidade_planejada),
    observacao_inicio: body.observacao_inicio ? String(body.observacao_inicio).trim() : null
  };
}

function buildFinishPayload(body) {
  return {
    quantidade_produzida: normalizeOptionalInteger(body.quantidade_produzida),
    quantidade_refugo: normalizeOptionalInteger(body.quantidade_refugo ?? 0),
    comprimento_corte_mm: normalizeOptionalDecimal(body.comprimento_corte_mm),
    observacao_fim: body.observacao_fim ? String(body.observacao_fim).trim() : null
  };
}

function validateCreatePayload(payload) {
  const errors = [];

  if (!Number.isInteger(payload.id_maquina)) {
    errors.push('A maquina informada deve ser valida.');
  }

  if (!Number.isInteger(payload.id_peca)) {
    errors.push('A peca informada deve ser valida.');
  }

  if (!Number.isInteger(payload.quantidade_planejada) || payload.quantidade_planejada <= 0) {
    errors.push('A quantidade planejada deve ser um numero inteiro maior que zero.');
  }

  return errors;
}

function validateFinishPayload(payload) {
  const errors = [];

  if (!Number.isInteger(payload.quantidade_produzida) || payload.quantidade_produzida < 0) {
    errors.push('A quantidade produzida deve ser um numero inteiro maior ou igual a zero.');
  }

  if (!Number.isInteger(payload.quantidade_refugo) || payload.quantidade_refugo < 0) {
    errors.push('A quantidade de refugo deve ser um numero inteiro maior ou igual a zero.');
  }

  if (
    payload.comprimento_corte_mm !== null
    && (!Number.isFinite(payload.comprimento_corte_mm) || payload.comprimento_corte_mm <= 0)
  ) {
    errors.push('O comprimento de corte em mm deve ser maior que zero.');
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

const ProducaoController = {
  async getAll(req, res) {
    try {
      const status = req.query.status ? String(req.query.status).trim().toUpperCase() : '';
      const producoes = await ProducaoModel.findAll({
        status: ['EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA'].includes(status) ? status : '',
        q: req.query.q ? String(req.query.q).trim() : ''
      });

      return res.status(200).json(producoes);
    } catch (error) {
      console.error('Erro ao listar producoes:', error);
      return res.status(500).json({ message: 'Erro ao listar producoes.' });
    }
  },

  async getById(req, res) {
    try {
      const producao = await ProducaoModel.findById(req.params.id);

      if (!producao) {
        return res.status(404).json({ message: 'Ordem de producao nao encontrada.' });
      }

      return res.status(200).json(producao);
    } catch (error) {
      console.error('Erro ao buscar producao:', error);
      return res.status(500).json({ message: 'Erro ao buscar producao.' });
    }
  },

  async create(req, res) {
    try {
      const payload = buildCreatePayload(req.body);
      const errors = validateCreatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const producao = await ProducaoModel.create(payload);
      return res.status(201).json(producao);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao iniciar producao.');
      return res.status(response.status).json(response.body);
    }
  },

  async finish(req, res) {
    try {
      const payload = buildFinishPayload(req.body);
      const errors = validateFinishPayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const producao = await ProducaoModel.finish(req.params.id, payload);
      return res.status(200).json(producao);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao finalizar producao.');
      return res.status(response.status).json(response.body);
    }
  }
};

module.exports = ProducaoController;
