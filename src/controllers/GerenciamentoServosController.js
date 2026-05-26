const GerenciamentoServosModel = require('../models/GerenciamentoServosModel');

const GerenciamentoServosController = {
  async getMatrix(req, res) {
    try {
      const matrix = await GerenciamentoServosModel.getMatrix(req.query?.escopo || 'global');
      return res.status(200).json(matrix);
    } catch (error) {
      console.error('Erro ao montar a matriz de gerenciamento de servos:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message, details: error.details || null });
      }

      return res.status(500).json({ message: 'Erro ao carregar a planilha de gerenciamento de servos.' });
    }
  }
};

module.exports = GerenciamentoServosController;
