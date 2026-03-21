// Controller do cadastro de materia-prima com peso por metro em kg/m.
const MateriaPrimaModel = require('../models/MateriaPrimaModel');

function normalizeDecimal(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') {
    return Number.parseFloat(defaultValue);
  }

  return Number.parseFloat(value);
}

function buildPayload(body) {
  return {
    codigo: String(body.codigo || '').trim(),
    nome: String(body.nome || '').trim(),
    geometria: String(body.geometria || '').trim(),
    bitola: String(body.bitola || '').trim(),
    peso_por_metro: normalizeDecimal(body.peso_por_metro, Number.NaN),
    estoque_minimo: normalizeDecimal(body.estoque_minimo, 0)
  };
}

function validatePayload(payload) {
  const errors = [];

  if (!payload.codigo) {
    errors.push('O campo codigo e obrigatorio.');
  }

  if (!payload.nome) {
    errors.push('O campo nome e obrigatorio.');
  }

  if (!payload.geometria) {
    errors.push('O campo geometria e obrigatorio.');
  }

  if (!payload.bitola) {
    errors.push('O campo bitola e obrigatorio.');
  }

  if (!Number.isFinite(payload.peso_por_metro) || payload.peso_por_metro <= 0) {
    errors.push('O campo peso_por_metro deve ser maior que zero.');
  }

  if (!Number.isFinite(payload.estoque_minimo) || payload.estoque_minimo < 0) {
    errors.push('O campo estoque_minimo nao pode ser negativo.');
  }

  return errors;
}

const MateriaPrimaController = {
  // Rota para listar materias-primas.
  async getAll(req, res) {
    try {
      const materiasPrimas = await MateriaPrimaModel.findAll({
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        nome: req.query.nome ? String(req.query.nome).trim() : '',
        geometria: req.query.geometria ? String(req.query.geometria).trim() : '',
        bitola: req.query.bitola ? String(req.query.bitola).trim() : ''
      });

      res.status(200).json(materiasPrimas);
    } catch (error) {
      console.error('Erro ao listar materias-primas:', error);
      res.status(500).json({ message: 'Erro ao listar materias-primas.' });
    }
  },

  // Rota para autocomplete de materias-primas.
  async getAutocomplete(req, res) {
    try {
      const materiasPrimas = await MateriaPrimaModel.findAutocompleteList();
      res.status(200).json(materiasPrimas);
    } catch (error) {
      console.error('Erro ao listar materias-primas para autocomplete:', error);
      res.status(500).json({ message: 'Erro ao listar materias-primas para autocomplete.' });
    }
  },

  // Rota para buscar materia-prima por ID.
  async getById(req, res) {
    try {
      const materiaPrima = await MateriaPrimaModel.findById(req.params.id);

      if (!materiaPrima) {
        return res.status(404).json({ message: 'Materia-prima nao encontrada.' });
      }

      return res.status(200).json(materiaPrima);
    } catch (error) {
      console.error('Erro ao buscar materia-prima:', error);
      return res.status(500).json({ message: 'Erro ao buscar materia-prima.' });
    }
  },

  // Rota para cadastrar materia-prima.
  async create(req, res) {
    try {
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const materiaPrima = await MateriaPrimaModel.create(payload);
      return res.status(201).json(materiaPrima);
    } catch (error) {
      console.error('Erro ao criar materia-prima:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Ja existe uma materia-prima com este codigo.' });
      }
      return res.status(500).json({ message: 'Erro ao criar materia-prima.' });
    }
  },

  // Rota para atualizar materia-prima.
  async update(req, res) {
    try {
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const materiaPrima = await MateriaPrimaModel.update(req.params.id, payload);

      if (!materiaPrima) {
        return res.status(404).json({ message: 'Materia-prima nao encontrada.' });
      }

      return res.status(200).json(materiaPrima);
    } catch (error) {
      console.error('Erro ao atualizar materia-prima:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Ja existe uma materia-prima com este codigo.' });
      }
      return res.status(500).json({ message: 'Erro ao atualizar materia-prima.' });
    }
  },

  // Rota para excluir materia-prima.
  async delete(req, res) {
    try {
      const deleted = await MateriaPrimaModel.delete(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: 'Materia-prima nao encontrada.' });
      }

      return res.status(200).json({ message: 'Materia-prima excluida com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir materia-prima:', error);
      return res.status(500).json({ message: 'Erro ao excluir materia-prima.' });
    }
  }
};

module.exports = MateriaPrimaController;
