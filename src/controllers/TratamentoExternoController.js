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
  },

  async sendToStock(req, res) {
    try {
      const idPeca = normalizeOptionalInteger(req.body.id_peca);
      const idEstoqueDestino = normalizeOptionalInteger(req.body.id_estoque_destino);
      const quantidade = Number.parseFloat(String(req.body.quantidade || '').replace(',', '.'));

      if (!Number.isInteger(idPeca)) {
        return res.status(400).json({ message: 'A peca informada deve ser valida.' });
      }

      if (!Number.isInteger(idEstoqueDestino)) {
        return res.status(400).json({ message: 'O estoque de destino deve ser valido.' });
      }

      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return res.status(400).json({ message: 'A quantidade deve ser maior que zero.' });
      }

      const result = await TratamentoExternoModel.sendToStock({
        id_peca: idPeca,
        id_estoque_destino: idEstoqueDestino,
        quantidade,
        observacao: req.body.observacao ? String(req.body.observacao).trim() : null
      });

      return res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      console.error('Erro ao enviar item do tratamento externo para o estoque:', error);
      return res.status(500).json({ message: 'Erro ao enviar item do tratamento externo para o estoque.' });
    }
  }
};

module.exports = TratamentoExternoController;
