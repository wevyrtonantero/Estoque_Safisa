const ConsultaEstoqueModel = require('../models/ConsultaEstoqueModel');

const CLASSIFICACOES_VALIDAS = ['ITEM', 'SUBMONTAGEM'];
const ESTADOS_VALIDOS = ['SEM_CONSUMO', 'ZERADO', 'ATE_7', 'ATE_15', 'ATE_30', 'OK'];

const ConsultaEstoqueController = {
  async getResumo(req, res) {
    try {
      const classificacao = req.query.classificacao
        ? String(req.query.classificacao).trim().toUpperCase()
        : '';
      const estado = req.query.estado
        ? String(req.query.estado).trim().toUpperCase()
        : '';

      const result = await ConsultaEstoqueModel.findResumo({
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : '',
        classificacao: CLASSIFICACOES_VALIDAS.includes(classificacao) ? classificacao : '',
        base_cobertura: req.query.base_cobertura ? String(req.query.base_cobertura).trim() : '',
        estado: ESTADOS_VALIDOS.includes(estado) ? estado : '',
        data_ate: req.query.data_ate ? String(req.query.data_ate).trim() : '',
        somente_com_saldo: req.query.somente_com_saldo,
        ordem: req.query.ordem ? String(req.query.ordem).trim() : ''
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao carregar consulta consolidada de estoques:', error);
      return res.status(500).json({ message: 'Erro ao carregar consulta consolidada de estoques.' });
    }
  }
};

module.exports = ConsultaEstoqueController;
