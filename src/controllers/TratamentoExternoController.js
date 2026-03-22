const TratamentoExternoModel = require('../models/TratamentoExternoModel');

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

const TratamentoExternoController = {
  async getSaldos(req, res) {
    try {
      const saldos = await TratamentoExternoModel.findSaldos({
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : ''
      });

      return res.status(200).json(saldos);
    } catch (error) {
      console.error('Erro ao listar itens de tratamento externo:', error);
      return res.status(500).json({ message: 'Erro ao listar itens de tratamento externo.' });
    }
  },

  async getMovimentacoes(req, res) {
    try {
      const idPeca = normalizeOptionalInteger(req.query.id_peca);
      const movimentacoes = await TratamentoExternoModel.findMovimentacoes({
        id_peca: Number.isInteger(idPeca) ? idPeca : null
      });

      return res.status(200).json(movimentacoes);
    } catch (error) {
      console.error('Erro ao listar movimentacoes de tratamento externo:', error);
      return res.status(500).json({ message: 'Erro ao listar movimentacoes de tratamento externo.' });
    }
  }
};

module.exports = TratamentoExternoController;
