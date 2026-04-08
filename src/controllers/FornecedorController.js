// Controller do cadastro de fornecedores.
const FornecedorModel = require('../models/FornecedorModel');

function buildPayload(body) {
  return {
    nome: String(body.nome || '').trim(),
    telefone: body.telefone ? String(body.telefone).trim() : null,
    contato: body.contato ? String(body.contato).trim() : null,
    email: body.email ? String(body.email).trim() : null,
    cep: body.cep ? String(body.cep).trim() : null,
    endereco: body.endereco ? String(body.endereco).trim() : null,
    cidade: body.cidade ? String(body.cidade).trim() : null,
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function validatePayload(payload) {
  const errors = [];

  if (!payload.nome) {
    errors.push('O campo nome e obrigatorio.');
  }

  if (payload.email && !payload.email.includes('@')) {
    errors.push('O campo email precisa ter um formato valido.');
  }

  return errors;
}

const FornecedorController = {
  // Rota para listar fornecedores.
  async getAll(req, res) {
    try {
      const fornecedores = await FornecedorModel.findAll({
        nome: req.query.nome ? String(req.query.nome).trim() : '',
        contato: req.query.contato ? String(req.query.contato).trim() : '',
        cidade: req.query.cidade ? String(req.query.cidade).trim() : '',
        peca: req.query.peca ? String(req.query.peca).trim() : ''
      });

      res.status(200).json(fornecedores);
    } catch (error) {
      console.error('Erro ao listar fornecedores:', error);
      res.status(500).json({ message: 'Erro ao listar fornecedores.' });
    }
  },

  // Rota para autocomplete dos fornecedores.
  async getAutocomplete(req, res) {
    try {
      const fornecedores = await FornecedorModel.findAutocompleteList();
      res.status(200).json(fornecedores);
    } catch (error) {
      console.error('Erro ao listar fornecedores para autocomplete:', error);
      res.status(500).json({ message: 'Erro ao listar fornecedores para autocomplete.' });
    }
  },

  // Rota para buscar um fornecedor por ID.
  async getById(req, res) {
    try {
      const fornecedor = await FornecedorModel.findById(req.params.id);

      if (!fornecedor) {
        return res.status(404).json({ message: 'Fornecedor nao encontrado.' });
      }

      return res.status(200).json(fornecedor);
    } catch (error) {
      console.error('Erro ao buscar fornecedor:', error);
      return res.status(500).json({ message: 'Erro ao buscar fornecedor.' });
    }
  },

  // Rota para cadastrar fornecedor.
  async create(req, res) {
    try {
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const fornecedor = await FornecedorModel.create(payload);
      return res.status(201).json(fornecedor);
    } catch (error) {
      console.error('Erro ao criar fornecedor:', error);
      return res.status(500).json({ message: 'Erro ao criar fornecedor.' });
    }
  },

  // Rota para atualizar fornecedor.
  async update(req, res) {
    try {
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const fornecedor = await FornecedorModel.update(req.params.id, payload);

      if (!fornecedor) {
        return res.status(404).json({ message: 'Fornecedor nao encontrado.' });
      }

      return res.status(200).json(fornecedor);
    } catch (error) {
      console.error('Erro ao atualizar fornecedor:', error);
      return res.status(500).json({ message: 'Erro ao atualizar fornecedor.' });
    }
  },

  // Rota para excluir fornecedor.
  async delete(req, res) {
    try {
      const deleted = await FornecedorModel.delete(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: 'Fornecedor nao encontrado.' });
      }

      return res.status(200).json({ message: 'Fornecedor excluido com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir fornecedor:', error);
      return res.status(500).json({ message: 'Erro ao excluir fornecedor.' });
    }
  }
};

module.exports = FornecedorController;
