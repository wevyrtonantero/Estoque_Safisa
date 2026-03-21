// Controller das opcoes auxiliares carregadas nos selects do frontend.
const CadastroApoioModel = require('../models/CadastroApoioModel');

const CadastroApoioController = {
  // Rota para carregar materias-primas, fornecedores e maquinas em uma unica chamada.
  async getFormOptions(req, res) {
    try {
      const [materiasPrimas, fornecedores, maquinas] = await Promise.all([
        CadastroApoioModel.findMateriasPrimas(),
        CadastroApoioModel.findFornecedores(),
        CadastroApoioModel.findMaquinas()
      ]);

      res.status(200).json({
        materias_primas: materiasPrimas,
        fornecedores,
        maquinas
      });
    } catch (error) {
      console.error('Erro ao carregar as opcoes auxiliares do cadastro:', error);
      res.status(500).json({ message: 'Erro ao carregar as opcoes auxiliares do cadastro.' });
    }
  }
};

module.exports = CadastroApoioController;
