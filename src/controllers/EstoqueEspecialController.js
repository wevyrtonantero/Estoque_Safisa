const EstoqueEspecialModel = require('../models/EstoqueEspecialModel');

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function normalizeDecimal(value) {
  if (value === undefined || value === null || value === '') {
    return Number.NaN;
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

const EstoqueEspecialController = {
  async getRegistros(req, res) {
    try {
      const registros = await EstoqueEspecialModel.findRegistros(req.params.tipo, {
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : '',
        detalhe: req.query.detalhe ? String(req.query.detalhe).trim() : '',
        origem: req.query.origem ? String(req.query.origem).trim() : ''
      });

      return res.status(200).json(registros);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao listar pecas do estoque especial.');
      return res.status(response.status).json(response.body);
    }
  },

  async registrarRefugo(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      const quantidade = normalizeDecimal(req.body.quantidade);

      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Registro invalido.' });
      }

      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return res.status(400).json({ message: 'A quantidade deve ser maior que zero.' });
      }

      const result = await EstoqueEspecialModel.registrarRefugo({
        tipo: req.params.tipo,
        id,
        quantidade,
        nome: req.body.nome ? String(req.body.nome).trim() : '',
        motivo: req.body.motivo ? String(req.body.motivo).trim() : ''
      });

      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao registrar refugo.');
      return res.status(response.status).json(response.body);
    }
  },

  async enviarParaEstoque(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      const idEstoqueDestino = normalizeOptionalInteger(req.body.id_estoque_destino);
      const quantidade = normalizeDecimal(req.body.quantidade);

      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Registro invalido.' });
      }

      if (!Number.isInteger(idEstoqueDestino)) {
        return res.status(400).json({ message: 'O estoque de destino deve ser valido.' });
      }

      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return res.status(400).json({ message: 'A quantidade deve ser maior que zero.' });
      }

      const result = await EstoqueEspecialModel.enviarParaEstoque({
        tipo: req.params.tipo,
        id,
        id_estoque_destino: idEstoqueDestino,
        quantidade,
        observacao: req.body.observacao ? String(req.body.observacao).trim() : null
      });

      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao encaminhar peca para estoque.');
      return res.status(response.status).json(response.body);
    }
  },

  async enviarParaTratamento(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      const quantidade = normalizeDecimal(req.body.quantidade);

      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Registro invalido.' });
      }

      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return res.status(400).json({ message: 'A quantidade deve ser maior que zero.' });
      }

      const result = await EstoqueEspecialModel.enviarParaTratamento({
        tipo: req.params.tipo,
        id,
        quantidade,
        observacao: req.body.observacao ? String(req.body.observacao).trim() : null
      });

      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao encaminhar peca para tratamento externo.');
      return res.status(response.status).json(response.body);
    }
  }
};

module.exports = EstoqueEspecialController;
