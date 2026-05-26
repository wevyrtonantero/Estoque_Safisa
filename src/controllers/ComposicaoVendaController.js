const ComposicaoVendaModel = require('../models/ComposicaoVendaModel');

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) ? parsedValue : null;
}

function normalizeIntegerList(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry));
}

const ComposicaoVendaController = {
  async getAll(req, res) {
    try {
      const composicoes = await ComposicaoVendaModel.findAll({
        id_item_venda: normalizeOptionalInteger(req.query.id_item_venda),
        ids_item_venda: normalizeIntegerList(req.query.ids_item_venda),
        q: req.query.q ? String(req.query.q).trim() : ''
      });

      return res.status(200).json(composicoes);
    } catch (error) {
      console.error('Erro ao listar composicoes de venda:', error);
      return res.status(500).json({ message: 'Erro ao listar composicoes de venda.' });
    }
  },

  async getByItemVenda(req, res) {
    try {
      const idItemVenda = Number.parseInt(req.params.idItemVenda, 10);

      if (!Number.isInteger(idItemVenda)) {
        return res.status(400).json({ message: 'O item de venda informado deve ser valido.' });
      }

      const composicoes = await ComposicaoVendaModel.findByItemVenda(idItemVenda);
      return res.status(200).json(composicoes);
    } catch (error) {
      console.error('Erro ao listar composicao de venda do item:', error);
      return res.status(500).json({ message: 'Erro ao listar composicao de venda do item.' });
    }
  },

  async create(req, res) {
    try {
      const composicao = await ComposicaoVendaModel.create({
        id_item_venda: req.body?.id_item_venda,
        id_item_atende: req.body?.id_item_atende,
        quantidade: req.body?.quantidade,
        ordem: req.body?.ordem
      });

      return res.status(201).json(composicao);
    } catch (error) {
      console.error('Erro ao criar composicao de venda:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro ao criar composicao de venda.' });
    }
  },

  async update(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'A composicao informada deve ser valida.' });
      }

      const composicao = await ComposicaoVendaModel.update(id, {
        id_item_venda: req.body?.id_item_venda,
        id_item_atende: req.body?.id_item_atende,
        quantidade: req.body?.quantidade,
        ordem: req.body?.ordem
      });

      return res.status(200).json(composicao);
    } catch (error) {
      console.error('Erro ao atualizar composicao de venda:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro ao atualizar composicao de venda.' });
    }
  },

  async delete(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'A composicao informada deve ser valida.' });
      }

      const composicao = await ComposicaoVendaModel.delete(id);
      return res.status(200).json({
        message: 'Composicao de venda excluida com sucesso.',
        composicao
      });
    } catch (error) {
      console.error('Erro ao excluir composicao de venda:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro ao excluir composicao de venda.' });
    }
  }
};

module.exports = ComposicaoVendaController;
