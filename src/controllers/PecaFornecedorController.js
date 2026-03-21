// Controller preparado para vinculo de varios fornecedores por peca.
const PecaFornecedorModel = require('../models/PecaFornecedorModel');

function buildPayload(body) {
  return {
    id_fornecedor: Number.parseInt(body.id_fornecedor, 10),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function validatePayload(payload) {
  const errors = [];

  if (!Number.isInteger(payload.id_fornecedor)) {
    errors.push('O fornecedor informado deve ser valido.');
  }

  if (payload.observacao && payload.observacao.length > 255) {
    errors.push('A observacao deve ter no maximo 255 caracteres.');
  }

  return errors;
}

const PecaFornecedorController = {
  // Rota para listar fornecedores da peca.
  async getAll(req, res) {
    try {
      const peca = await PecaFornecedorModel.pecaExists(req.params.id);

      if (!peca) {
        return res.status(404).json({ message: 'Peca nao encontrada.' });
      }

      const vinculos = await PecaFornecedorModel.findByPecaId(req.params.id);
      return res.status(200).json(vinculos);
    } catch (error) {
      console.error('Erro ao listar fornecedores da peca:', error);
      return res.status(500).json({ message: 'Erro ao listar fornecedores da peca.' });
    }
  },

  // Rota para criar vinculo de fornecedor na peca.
  async create(req, res) {
    try {
      const pecaId = Number.parseInt(req.params.id, 10);
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const peca = await PecaFornecedorModel.pecaExists(pecaId);

      if (!peca) {
        return res.status(404).json({ message: 'Peca nao encontrada.' });
      }

      const fornecedor = await PecaFornecedorModel.fornecedorExists(payload.id_fornecedor);

      if (!fornecedor) {
        return res.status(400).json({ message: 'Fornecedor nao encontrado.' });
      }

      const duplicate = await PecaFornecedorModel.findDuplicate(pecaId, payload.id_fornecedor);

      if (duplicate) {
        return res.status(400).json({ message: 'Este fornecedor ja esta vinculado a peca.' });
      }

      const vinculo = await PecaFornecedorModel.create(pecaId, payload);
      return res.status(201).json(vinculo);
    } catch (error) {
      console.error('Erro ao criar vinculo da peca:', error);
      return res.status(500).json({ message: 'Erro ao criar vinculo da peca.' });
    }
  },

  // Rota para atualizar vinculo de fornecedor da peca.
  async update(req, res) {
    try {
      const pecaId = Number.parseInt(req.params.id, 10);
      const vinculoId = Number.parseInt(req.params.vinculoId, 10);
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const vinculoAtual = await PecaFornecedorModel.findById(vinculoId);

      if (!vinculoAtual || Number(vinculoAtual.id_peca) !== pecaId) {
        return res.status(404).json({ message: 'Vinculo nao encontrado para esta peca.' });
      }

      const fornecedor = await PecaFornecedorModel.fornecedorExists(payload.id_fornecedor);

      if (!fornecedor) {
        return res.status(400).json({ message: 'Fornecedor nao encontrado.' });
      }

      if (payload.id_fornecedor !== Number(vinculoAtual.id_fornecedor)) {
        const duplicate = await PecaFornecedorModel.findDuplicate(pecaId, payload.id_fornecedor);

        if (duplicate) {
          return res.status(400).json({ message: 'Este fornecedor ja esta vinculado a peca.' });
        }
      }

      const vinculo = await PecaFornecedorModel.update(vinculoId, payload);
      return res.status(200).json(vinculo);
    } catch (error) {
      console.error('Erro ao atualizar vinculo da peca:', error);
      return res.status(500).json({ message: 'Erro ao atualizar vinculo da peca.' });
    }
  },

  // Rota para excluir vinculo da peca.
  async delete(req, res) {
    try {
      const vinculoAtual = await PecaFornecedorModel.findById(req.params.vinculoId);

      if (!vinculoAtual || Number(vinculoAtual.id_peca) !== Number(req.params.id)) {
        return res.status(404).json({ message: 'Vinculo nao encontrado para esta peca.' });
      }

      await PecaFornecedorModel.delete(req.params.vinculoId);
      return res.status(200).json({ message: 'Vinculo excluido com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir vinculo da peca:', error);
      return res.status(500).json({ message: 'Erro ao excluir vinculo da peca.' });
    }
  }
};

module.exports = PecaFornecedorController;
