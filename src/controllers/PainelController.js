const PainelModel = require('../models/PainelModel');

const PainelController = {
  async getSummary(req, res) {
    try {
      const result = await PainelModel.getSummary();
      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao carregar resumo do painel:', error);
      return res.status(500).json({ message: 'Erro ao carregar resumo do painel.' });
    }
  }
};

module.exports = PainelController;
