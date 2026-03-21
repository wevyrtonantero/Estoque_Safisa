// Controller dos fornecedores vinculados a materia-prima.
const MateriaPrimaFornecedorModel = require('../models/MateriaPrimaFornecedorModel');

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

const MateriaPrimaFornecedorController = {
  // Rota para listar os fornecedores vinculados a materia-prima.
  async getAll(req, res) {
    try {
      const materiaPrima = await MateriaPrimaFornecedorModel.materiaPrimaExists(req.params.id);

      if (!materiaPrima) {
        return res.status(404).json({ message: 'Materia-prima nao encontrada.' });
      }

      const vinculos = await MateriaPrimaFornecedorModel.findByMateriaPrimaId(req.params.id);
      return res.status(200).json(vinculos);
    } catch (error) {
      console.error('Erro ao listar fornecedores da materia-prima:', error);
      return res.status(500).json({ message: 'Erro ao listar fornecedores da materia-prima.' });
    }
  },

  // Rota para criar vinculo de fornecedor na materia-prima.
  async create(req, res) {
    try {
      const materiaPrimaId = Number.parseInt(req.params.id, 10);
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const materiaPrima = await MateriaPrimaFornecedorModel.materiaPrimaExists(materiaPrimaId);

      if (!materiaPrima) {
        return res.status(404).json({ message: 'Materia-prima nao encontrada.' });
      }

      const fornecedor = await MateriaPrimaFornecedorModel.fornecedorExists(payload.id_fornecedor);

      if (!fornecedor) {
        return res.status(400).json({ message: 'Fornecedor nao encontrado.' });
      }

      const duplicate = await MateriaPrimaFornecedorModel.findDuplicate(
        materiaPrimaId,
        payload.id_fornecedor
      );

      if (duplicate) {
        return res.status(400).json({ message: 'Este fornecedor ja esta vinculado a materia-prima.' });
      }

      const vinculo = await MateriaPrimaFornecedorModel.create(materiaPrimaId, payload);
      return res.status(201).json(vinculo);
    } catch (error) {
      console.error('Erro ao criar vinculo da materia-prima:', error);
      return res.status(500).json({ message: 'Erro ao criar vinculo da materia-prima.' });
    }
  },

  // Rota para atualizar um vinculo da materia-prima.
  async update(req, res) {
    try {
      const materiaPrimaId = Number.parseInt(req.params.id, 10);
      const vinculoId = Number.parseInt(req.params.vinculoId, 10);
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const materiaPrima = await MateriaPrimaFornecedorModel.materiaPrimaExists(materiaPrimaId);

      if (!materiaPrima) {
        return res.status(404).json({ message: 'Materia-prima nao encontrada.' });
      }

      const vinculoAtual = await MateriaPrimaFornecedorModel.findById(vinculoId);

      if (!vinculoAtual || Number(vinculoAtual.id_materia_prima) !== materiaPrimaId) {
        return res.status(404).json({ message: 'Vinculo nao encontrado para esta materia-prima.' });
      }

      const fornecedor = await MateriaPrimaFornecedorModel.fornecedorExists(payload.id_fornecedor);

      if (!fornecedor) {
        return res.status(400).json({ message: 'Fornecedor nao encontrado.' });
      }

      if (payload.id_fornecedor !== Number(vinculoAtual.id_fornecedor)) {
        const duplicate = await MateriaPrimaFornecedorModel.findDuplicate(
          materiaPrimaId,
          payload.id_fornecedor
        );

        if (duplicate) {
          return res.status(400).json({ message: 'Este fornecedor ja esta vinculado a materia-prima.' });
        }
      }

      const vinculo = await MateriaPrimaFornecedorModel.update(vinculoId, payload);
      return res.status(200).json(vinculo);
    } catch (error) {
      console.error('Erro ao atualizar vinculo da materia-prima:', error);
      return res.status(500).json({ message: 'Erro ao atualizar vinculo da materia-prima.' });
    }
  },

  // Rota para excluir um vinculo da materia-prima.
  async delete(req, res) {
    try {
      const vinculoId = Number.parseInt(req.params.vinculoId, 10);
      const vinculoAtual = await MateriaPrimaFornecedorModel.findById(vinculoId);

      if (!vinculoAtual || Number(vinculoAtual.id_materia_prima) !== Number(req.params.id)) {
        return res.status(404).json({ message: 'Vinculo nao encontrado para esta materia-prima.' });
      }

      await MateriaPrimaFornecedorModel.delete(vinculoId);
      return res.status(200).json({ message: 'Vinculo excluido com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir vinculo da materia-prima:', error);
      return res.status(500).json({ message: 'Erro ao excluir vinculo da materia-prima.' });
    }
  }
};

module.exports = MateriaPrimaFornecedorController;
