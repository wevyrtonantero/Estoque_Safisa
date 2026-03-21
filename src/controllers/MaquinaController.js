// Controller de cadastro de maquinas.
const MaquinaModel = require('../models/MaquinaModel');

function buildPayload(body) {
  return {
    nome: String(body.nome || '').trim(),
    tipo: String(body.tipo || '').trim()
  };
}

function validatePayload(payload) {
  const errors = [];

  if (!payload.nome) {
    errors.push('O campo nome e obrigatorio.');
  }

  if (!payload.tipo) {
    errors.push('O campo tipo e obrigatorio.');
  }

  return errors;
}

const MaquinaController = {
  // Rota para listar maquinas.
  async getAll(req, res) {
    try {
      const maquinas = await MaquinaModel.findAll({
        nome: req.query.nome ? String(req.query.nome).trim() : '',
        tipo: req.query.tipo ? String(req.query.tipo).trim() : ''
      });

      res.status(200).json(maquinas);
    } catch (error) {
      console.error('Erro ao listar maquinas:', error);
      res.status(500).json({ message: 'Erro ao listar maquinas.' });
    }
  },

  // Rota para autocomplete de maquinas.
  async getAutocomplete(req, res) {
    try {
      const maquinas = await MaquinaModel.findAutocompleteList();
      res.status(200).json(maquinas);
    } catch (error) {
      console.error('Erro ao listar maquinas para autocomplete:', error);
      res.status(500).json({ message: 'Erro ao listar maquinas para autocomplete.' });
    }
  },

  // Rota para buscar maquina por ID.
  async getById(req, res) {
    try {
      const maquina = await MaquinaModel.findById(req.params.id);

      if (!maquina) {
        return res.status(404).json({ message: 'Maquina nao encontrada.' });
      }

      return res.status(200).json(maquina);
    } catch (error) {
      console.error('Erro ao buscar maquina:', error);
      return res.status(500).json({ message: 'Erro ao buscar maquina.' });
    }
  },

  // Rota para cadastrar maquina.
  async create(req, res) {
    try {
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const maquina = await MaquinaModel.create(payload);
      return res.status(201).json(maquina);
    } catch (error) {
      console.error('Erro ao criar maquina:', error);
      return res.status(500).json({ message: 'Erro ao criar maquina.' });
    }
  },

  // Rota para atualizar maquina.
  async update(req, res) {
    try {
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const maquina = await MaquinaModel.update(req.params.id, payload);

      if (!maquina) {
        return res.status(404).json({ message: 'Maquina nao encontrada.' });
      }

      return res.status(200).json(maquina);
    } catch (error) {
      console.error('Erro ao atualizar maquina:', error);
      return res.status(500).json({ message: 'Erro ao atualizar maquina.' });
    }
  },

  // Rota para excluir maquina.
  async delete(req, res) {
    try {
      const deleted = await MaquinaModel.delete(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: 'Maquina nao encontrada.' });
      }

      return res.status(200).json({ message: 'Maquina excluida com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir maquina:', error);
      return res.status(500).json({ message: 'Erro ao excluir maquina.' });
    }
  }
};

module.exports = MaquinaController;
