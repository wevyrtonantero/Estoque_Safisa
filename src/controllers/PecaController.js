// Controller do CRUD de pecas simples.
const PecaModel = require('../models/PecaModel');

const TIPOS_VALIDOS = ['COMPRADA', 'PRODUZIDA'];

// Normaliza campos inteiros opcionais sem perder null.
function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

// Normaliza campos decimais vindos do frontend.
function normalizeDecimal(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return Number.parseFloat(value);
}

// Monta o payload padronizado da entidade peca.
function buildPayload(body) {
  return {
    codigo: String(body.codigo || '').trim(),
    descricao: String(body.descricao || '').trim(),
    comprimento_mm: normalizeDecimal(body.comprimento_mm, Number.NaN),
    tipo: String(body.tipo || '').trim().toUpperCase(),
    classificacao: 'ITEM',
    id_materia_prima: normalizeOptionalInteger(body.id_materia_prima),
    id_fornecedor: normalizeOptionalInteger(body.id_fornecedor),
    id_maquina: normalizeOptionalInteger(body.id_maquina),
    estoque_minimo: Number.parseInt(body.estoque_minimo ?? 0, 10),
    estoque_seguranca: Number.parseInt(body.estoque_seguranca ?? 0, 10),
    consumo_mensal: normalizeDecimal(body.consumo_mensal, 0),
    massa_kg: normalizeDecimal(body.massa_kg, 0)
  };
}

// Valida as regras de negocio minimas de pecas.
function validatePayload(payload) {
  const errors = [];

  if (!payload.codigo) {
    errors.push('O campo codigo e obrigatorio.');
  }

  if (!payload.descricao) {
    errors.push('O campo descricao e obrigatorio.');
  }

  if (!Number.isFinite(payload.comprimento_mm) || payload.comprimento_mm <= 0) {
    errors.push('O campo comprimento_mm deve ser maior que zero.');
  }

  if (!TIPOS_VALIDOS.includes(payload.tipo)) {
    errors.push('O campo tipo deve ser COMPRADA ou PRODUZIDA.');
  }

  if (payload.classificacao !== 'ITEM') {
    errors.push('A classificacao da tela de pecas deve ser ITEM.');
  }

  if (!Number.isInteger(payload.estoque_minimo) || payload.estoque_minimo < 0) {
    errors.push('O campo estoque_minimo nao pode ser negativo.');
  }

  if (!Number.isInteger(payload.estoque_seguranca) || payload.estoque_seguranca < 0) {
    errors.push('O campo estoque_seguranca nao pode ser negativo.');
  }

  if (!Number.isFinite(payload.consumo_mensal) || payload.consumo_mensal < 0) {
    errors.push('O campo consumo_mensal nao pode ser negativo.');
  }

  if (!Number.isFinite(payload.massa_kg) || payload.massa_kg < 0) {
    errors.push('O campo massa_kg nao pode ser negativo.');
  }

  ['id_materia_prima', 'id_fornecedor', 'id_maquina'].forEach((fieldName) => {
    const fieldValue = payload[fieldName];

    if (fieldValue !== null && !Number.isInteger(fieldValue)) {
      errors.push(`O campo ${fieldName} deve ser um numero inteiro ou vazio.`);
    }
  });

  return errors;
}

const PecaController = {
  // Rota para listar pecas simples.
  async getAll(req, res) {
    try {
      const tipo = req.query.tipo ? String(req.query.tipo).trim().toUpperCase() : '';
      const filters = {
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : '',
        tipo: TIPOS_VALIDOS.includes(tipo) ? tipo : ''
      };

      const pecas = await PecaModel.findAll(filters);
      res.status(200).json(pecas);
    } catch (error) {
      console.error('Erro ao listar pecas:', error);
      res.status(500).json({ message: 'Erro ao listar pecas.' });
    }
  },

  // Rota para buscar uma peca especifica.
  async getById(req, res) {
    try {
      const peca = await PecaModel.findById(req.params.id);

      if (!peca) {
        return res.status(404).json({ message: 'Peca nao encontrada.' });
      }

      return res.status(200).json(peca);
    } catch (error) {
      console.error('Erro ao buscar peca:', error);
      return res.status(500).json({ message: 'Erro ao buscar peca.' });
    }
  },

  // Rota auxiliar para listar somente itens simples.
  async getSimpleItems(req, res) {
    try {
      const itens = await PecaModel.findSimpleItems();
      res.status(200).json(itens);
    } catch (error) {
      console.error('Erro ao listar itens simples:', error);
      res.status(500).json({ message: 'Erro ao listar itens simples.' });
    }
  },

  // Rota auxiliar para localizar em quais submontagens a peca esta vinculada.
  async getSubmontagemUsages(req, res) {
    try {
      const peca = await PecaModel.findById(req.params.id);

      if (!peca) {
        return res.status(404).json({ message: 'Peca nao encontrada.' });
      }

      const submontagens = await PecaModel.findSubmontagemUsages(req.params.id);
      return res.status(200).json(submontagens);
    } catch (error) {
      console.error('Erro ao localizar vinculos da peca:', error);
      return res.status(500).json({ message: 'Erro ao localizar vinculos da peca.' });
    }
  },

  // Rota para cadastrar pecas.
  async create(req, res) {
    try {
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const createdPeca = await PecaModel.create(payload);
      return res.status(201).json(createdPeca);
    } catch (error) {
      console.error('Erro ao criar peca:', error);
      return res.status(500).json({ message: 'Erro ao criar peca.' });
    }
  },

  // Rota para atualizar pecas.
  async update(req, res) {
    try {
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const updatedPeca = await PecaModel.update(req.params.id, payload);

      if (!updatedPeca) {
        return res.status(404).json({ message: 'Peca nao encontrada.' });
      }

      return res.status(200).json(updatedPeca);
    } catch (error) {
      console.error('Erro ao atualizar peca:', error);
      return res.status(500).json({ message: 'Erro ao atualizar peca.' });
    }
  },

  // Rota para excluir pecas.
  async delete(req, res) {
    try {
      const deleted = await PecaModel.delete(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: 'Peca nao encontrada.' });
      }

      return res.status(200).json({ message: 'Peca excluida com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir peca:', error);

      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        const submontagens = await PecaModel.findSubmontagemUsages(req.params.id).catch(() => []);
        return res.status(400).json({
          message: submontagens.length > 0
            ? 'Nao e possivel excluir a peca porque ela esta em uso na estrutura de uma ou mais submontagens.'
            : 'Nao e possivel excluir a peca porque ela esta em uso em outros modulos do sistema, como estoque ou estrutura.',
          submontagens
        });
      }

      return res.status(500).json({ message: 'Erro ao excluir peca.' });
    }
  }
};

module.exports = PecaController;
