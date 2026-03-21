// Controller do CRUD de submontagens.
const SubmontagemModel = require('../models/SubmontagemModel');

const TIPOS_VALIDOS = ['COMPRADA', 'PRODUZIDA'];

// Normaliza inteiros opcionais usados na mesma tabela pecas.
function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

// Normaliza campos decimais enviados pelo frontend.
function normalizeDecimal(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') {
    return Number.parseFloat(defaultValue);
  }

  return Number.parseFloat(value);
}

// Monta o payload da submontagem com campos tecnicos padronizados.
function buildPayload(body, currentData = {}) {
  return {
    codigo: String(body.codigo || '').trim(),
    descricao: String(body.descricao || '').trim(),
    comprimento_mm: normalizeDecimal(body.comprimento_mm, currentData.comprimento_mm ?? 1),
    tipo: String(body.tipo || currentData.tipo || 'PRODUZIDA').trim().toUpperCase(),
    classificacao: 'SUBMONTAGEM',
    id_materia_prima: normalizeOptionalInteger(body.id_materia_prima ?? currentData.id_materia_prima),
    id_fornecedor: normalizeOptionalInteger(body.id_fornecedor ?? currentData.id_fornecedor),
    id_maquina: normalizeOptionalInteger(body.id_maquina ?? currentData.id_maquina),
    estoque_minimo: Number.parseInt(body.estoque_minimo ?? currentData.estoque_minimo ?? 0, 10),
    estoque_seguranca: Number.parseInt(body.estoque_seguranca ?? currentData.estoque_seguranca ?? 0, 10),
    consumo_mensal: normalizeDecimal(body.consumo_mensal, currentData.consumo_mensal ?? 0),
    massa_kg: normalizeDecimal(body.massa_kg, currentData.massa_kg ?? 0)
  };
}

// Valida as regras principais da submontagem.
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

  if (payload.classificacao !== 'SUBMONTAGEM') {
    errors.push('A classificacao da tela de submontagens deve ser SUBMONTAGEM.');
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

const SubmontagemController = {
  // Rota para listar submontagens.
  async getAll(req, res) {
    try {
      const tipo = req.query.tipo ? String(req.query.tipo).trim().toUpperCase() : '';
      const itemComponenteId = req.query.id_item_componente
        ? Number.parseInt(req.query.id_item_componente, 10)
        : null;
      const filters = {
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : '',
        tipo: TIPOS_VALIDOS.includes(tipo) ? tipo : '',
        id_item_componente: Number.isInteger(itemComponenteId) ? itemComponenteId : null
      };

      const submontagens = await SubmontagemModel.findAll(filters);
      res.status(200).json(submontagens);
    } catch (error) {
      console.error('Erro ao listar submontagens:', error);
      res.status(500).json({ message: 'Erro ao listar submontagens.' });
    }
  },

  // Rota para buscar uma submontagem pelo ID.
  async getById(req, res) {
    try {
      const submontagem = await SubmontagemModel.findById(req.params.id);

      if (!submontagem) {
        return res.status(404).json({ message: 'Submontagem nao encontrada.' });
      }

      return res.status(200).json(submontagem);
    } catch (error) {
      console.error('Erro ao buscar submontagem:', error);
      return res.status(500).json({ message: 'Erro ao buscar submontagem.' });
    }
  },

  // Rota para cadastrar submontagens.
  async create(req, res) {
    try {
      const payload = buildPayload(req.body);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const createdSubmontagem = await SubmontagemModel.create(payload);
      return res.status(201).json(createdSubmontagem);
    } catch (error) {
      console.error('Erro ao criar submontagem:', error);
      return res.status(500).json({ message: 'Erro ao criar submontagem.' });
    }
  },

  // Rota para atualizar submontagens.
  async update(req, res) {
    try {
      const currentData = await SubmontagemModel.findById(req.params.id);

      if (!currentData) {
        return res.status(404).json({ message: 'Submontagem nao encontrada.' });
      }

      const payload = buildPayload(req.body, currentData);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const updatedSubmontagem = await SubmontagemModel.update(req.params.id, payload);

      return res.status(200).json(updatedSubmontagem);
    } catch (error) {
      console.error('Erro ao atualizar submontagem:', error);
      return res.status(500).json({ message: 'Erro ao atualizar submontagem.' });
    }
  },

  // Rota para excluir submontagens.
  async delete(req, res) {
    try {
      const deleted = await SubmontagemModel.delete(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: 'Submontagem nao encontrada.' });
      }

      return res.status(200).json({ message: 'Submontagem excluida com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir submontagem:', error);
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({
          message: 'Nao e possivel excluir a submontagem porque ela esta em uso em outros modulos do sistema, como estoque.'
        });
      }
      return res.status(500).json({ message: 'Erro ao excluir submontagem.' });
    }
  }
};

module.exports = SubmontagemController;
