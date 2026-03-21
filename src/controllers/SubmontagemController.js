// Controller do CRUD de submontagens.
const SubmontagemModel = require('../models/SubmontagemModel');
const EstruturaSubmontagemModel = require('../models/EstruturaSubmontagemModel');

// Normaliza inteiros opcionais usados na mesma tabela pecas.
function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

// Normaliza campos decimais opcionais enviados pelo frontend.
function normalizeOptionalDecimal(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return Number.parseFloat(value);
}

// Normaliza inteiros opcionais nao negativos.
function normalizeOptionalNonNegativeInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

// Monta o payload da submontagem com campos tecnicos padronizados.
function buildPayload(body, currentData = {}) {
  return {
    codigo: String(body.codigo || '').trim(),
    descricao: String(body.descricao || '').trim(),
    comprimento_mm: null,
    tipo: 'PRODUZIDA',
    classificacao: 'SUBMONTAGEM',
    id_materia_prima: null,
    id_fornecedor: null,
    id_maquina: null,
    estoque_minimo: normalizeOptionalNonNegativeInteger(body.estoque_minimo ?? currentData.estoque_minimo),
    estoque_seguranca: normalizeOptionalNonNegativeInteger(body.estoque_seguranca ?? currentData.estoque_seguranca),
    consumo_mensal: normalizeOptionalDecimal(body.consumo_mensal ?? currentData.consumo_mensal),
    massa_kg: null
  };
}

// Monta os componentes enviados junto com o cadastro da submontagem.
function buildComponentsPayload(body) {
  if (!Array.isArray(body.componentes)) {
    return null;
  }

  return body.componentes.map((component) => ({
    id_item_componente: normalizeOptionalInteger(component.id_item_componente),
    quantidade: Number.parseInt(component.quantidade, 10),
    observacao: component.observacao ? String(component.observacao).trim() : null
  }));
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

  if (payload.classificacao !== 'SUBMONTAGEM') {
    errors.push('A classificacao da tela de submontagens deve ser SUBMONTAGEM.');
  }

  if (payload.estoque_minimo !== null && (!Number.isInteger(payload.estoque_minimo) || payload.estoque_minimo < 0)) {
    errors.push('O campo estoque_minimo nao pode ser negativo.');
  }

  if (payload.estoque_seguranca !== null && (!Number.isInteger(payload.estoque_seguranca) || payload.estoque_seguranca < 0)) {
    errors.push('O campo estoque_seguranca nao pode ser negativo.');
  }

  if (payload.consumo_mensal !== null && (!Number.isFinite(payload.consumo_mensal) || payload.consumo_mensal < 0)) {
    errors.push('O campo consumo_mensal nao pode ser negativo.');
  }

  return errors;
}

function validateComponentsPayload(componentes, { requireAtLeastOne = false } = {}) {
  const errors = [];

  if (!Array.isArray(componentes)) {
    if (requireAtLeastOne) {
      errors.push('Adicione ao menos uma peca na estrutura da submontagem.');
    }

    return errors;
  }

  if (requireAtLeastOne && componentes.length === 0) {
    errors.push('Adicione ao menos uma peca na estrutura da submontagem.');
  }

  const componentIds = new Set();

  componentes.forEach((component, index) => {
    if (!Number.isInteger(component.id_item_componente)) {
      errors.push(`O componente da linha ${index + 1} deve ser um item valido.`);
    }

    if (!Number.isInteger(component.quantidade) || component.quantidade <= 0) {
      errors.push(`A quantidade da linha ${index + 1} deve ser um numero inteiro maior que zero.`);
    }

    if (component.observacao && component.observacao.length > 255) {
      errors.push(`A observacao da linha ${index + 1} deve ter no maximo 255 caracteres.`);
    }

    if (Number.isInteger(component.id_item_componente)) {
      if (componentIds.has(component.id_item_componente)) {
        errors.push(`O componente da linha ${index + 1} esta duplicado na estrutura.`);
      }

      componentIds.add(component.id_item_componente);
    }
  });

  return errors;
}

const SubmontagemController = {
  // Rota para listar submontagens.
  async getAll(req, res) {
    try {
      const itemComponenteId = req.query.id_item_componente
        ? Number.parseInt(req.query.id_item_componente, 10)
        : null;
      const filters = {
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : '',
        tipo: 'PRODUZIDA',
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
      const componentes = buildComponentsPayload(req.body);
      const errors = [
        ...validatePayload(payload),
        ...validateComponentsPayload(componentes, { requireAtLeastOne: true })
      ];

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const componentValidation = await Promise.all(
        componentes.map((component) => EstruturaSubmontagemModel.simpleItemExists(component.id_item_componente))
      );

      componentValidation.forEach((simpleItem, index) => {
        if (!simpleItem) {
          errors.push(`O componente da linha ${index + 1} deve ser um item com classificacao ITEM.`);
        }
      });

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const createdSubmontagem = await SubmontagemModel.create(payload, componentes);
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
      const componentes = buildComponentsPayload(req.body);
      const errors = [
        ...validatePayload(payload),
        ...validateComponentsPayload(componentes)
      ];

      if (Array.isArray(componentes)) {
        componentes.forEach((component, index) => {
          if (Number(component.id_item_componente) === Number(req.params.id)) {
            errors.push(`A linha ${index + 1} nao pode usar a propria submontagem como componente.`);
          }
        });
      }

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      if (Array.isArray(componentes)) {
        const componentValidation = await Promise.all(
          componentes.map((component) => EstruturaSubmontagemModel.simpleItemExists(component.id_item_componente))
        );

        componentValidation.forEach((simpleItem, index) => {
          if (!simpleItem) {
            errors.push(`O componente da linha ${index + 1} deve ser um item com classificacao ITEM.`);
          }
        });
      }

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const updatedSubmontagem = await SubmontagemModel.update(req.params.id, payload, componentes);

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
