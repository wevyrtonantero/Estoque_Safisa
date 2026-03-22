// Controller do cadastro de materia-prima com peso por metro em kg/m.
const MateriaPrimaModel = require('../models/MateriaPrimaModel');
const FornecedorModel = require('../models/FornecedorModel');
const MateriaPrimaFornecedorModel = require('../models/MateriaPrimaFornecedorModel');

function normalizeDecimal(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') {
    return Number.parseFloat(defaultValue);
  }

  return Number.parseFloat(value);
}

function normalizeOptionalDecimal(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return Number.parseFloat(value);
}

function buildPayload(body) {
  const geometria = String(body.geometria || '').trim().toUpperCase();

  return {
    codigo: String(body.codigo || '').trim(),
    nome: String(body.nome || '').trim(),
    material: body.material ? String(body.material).trim() : null,
    geometria,
    bitola: body.bitola ? String(body.bitola).trim() : null,
    bitola_mm: normalizeOptionalDecimal(body.bitola_mm),
    comprimento_padrao_mm: normalizeOptionalDecimal(body.comprimento_padrao_mm),
    peso_por_metro: normalizeOptionalDecimal(body.peso_por_metro),
    peso_unitario_kg: normalizeOptionalDecimal(body.peso_unitario_kg),
    densidade_g_cm3: normalizeOptionalDecimal(body.densidade_g_cm3),
    estoque_minimo: normalizeDecimal(body.estoque_minimo, 0),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function resolveDefaultSupplierTerms(payload) {
  const geometria = normalizeText(payload.geometria);
  const codigo = normalizeText(payload.codigo);
  const material = normalizeText(payload.material);

  if (
    geometria === 'FUNDIDO'
    || codigo.endsWith('FD')
    || material.includes('FERRO FUNDIDO')
  ) {
    return ['Fundicao Tiger'];
  }

  if (
    material.includes('ACO')
    || material.includes('SAE')
    || material.includes('INOX')
  ) {
    return ['Acovisa', 'Açovisa'];
  }

  return [];
}

async function applyDefaultSupplierLink(materiaPrima, payload) {
  const supplierTerms = resolveDefaultSupplierTerms(payload);
  if (supplierTerms.length === 0) {
    return;
  }

  const fornecedor = await FornecedorModel.findFirstByNameTerms(supplierTerms);
  if (!fornecedor) {
    return;
  }

  const duplicate = await MateriaPrimaFornecedorModel.findDuplicate(
    materiaPrima.id,
    fornecedor.id
  );

  if (duplicate) {
    return;
  }

  await MateriaPrimaFornecedorModel.create(materiaPrima.id, {
    id_fornecedor: fornecedor.id,
    observacao: 'Vinculo padrao criado automaticamente.'
  });
}

function validatePayload(payload) {
  const errors = [];

  if (!payload.codigo) {
    errors.push('O campo codigo e obrigatorio.');
  }

  if (!payload.nome) {
    errors.push('O campo nome e obrigatorio.');
  }

  if (!payload.material) {
    errors.push('O campo material tecnico e obrigatorio.');
  }

  if (!payload.geometria) {
    errors.push('O campo geometria e obrigatorio.');
  }

  if (payload.geometria !== 'FUNDIDO' && !payload.bitola) {
    errors.push('O campo bitola e obrigatorio para materiais que nao sao fundidos.');
  }

  if (payload.bitola_mm !== null && (!Number.isFinite(payload.bitola_mm) || payload.bitola_mm <= 0)) {
    errors.push('O campo bitola_mm deve ser maior que zero quando informado.');
  }

  if (
    payload.comprimento_padrao_mm !== null
    && (!Number.isFinite(payload.comprimento_padrao_mm) || payload.comprimento_padrao_mm <= 0)
  ) {
    errors.push('O campo comprimento_padrao_mm deve ser maior que zero quando informado.');
  }

  if (payload.peso_por_metro !== null && (!Number.isFinite(payload.peso_por_metro) || payload.peso_por_metro <= 0)) {
    errors.push('O campo peso_por_metro deve ser maior que zero quando informado.');
  }

  if (
    payload.peso_unitario_kg !== null
    && (!Number.isFinite(payload.peso_unitario_kg) || payload.peso_unitario_kg <= 0)
  ) {
    errors.push('O campo peso_unitario_kg deve ser maior que zero quando informado.');
  }

  if (
    payload.densidade_g_cm3 !== null
    && (!Number.isFinite(payload.densidade_g_cm3) || payload.densidade_g_cm3 <= 0)
  ) {
    errors.push('O campo densidade_g_cm3 deve ser maior que zero quando informado.');
  }

  if (!Number.isFinite(payload.estoque_minimo) || payload.estoque_minimo < 0) {
    errors.push('O campo estoque_minimo nao pode ser negativo.');
  }

  if (payload.observacao && payload.observacao.length > 255) {
    errors.push('O campo observacao deve ter no maximo 255 caracteres.');
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
        material: req.query.material ? String(req.query.material).trim() : '',
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
      try {
        await applyDefaultSupplierLink(materiaPrima, payload);
      } catch (linkError) {
        console.warn('Nao foi possivel aplicar o fornecedor padrao da materia-prima:', linkError.message);
      }
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
