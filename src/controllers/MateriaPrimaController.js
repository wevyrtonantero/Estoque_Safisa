// Controller do cadastro de materia-prima com peso por metro em kg/m.
const MateriaPrimaModel = require('../models/MateriaPrimaModel');
const FornecedorModel = require('../models/FornecedorModel');
const MateriaPrimaFornecedorModel = require('../models/MateriaPrimaFornecedorModel');

const CATEGORIAS_VALIDAS = ['LAMINADO', 'FUNDIDO'];
const GEOMETRIAS_LAMINADO = ['REDONDO', 'QUADRADO', 'SEXTAVADO'];
const UNIDADES_LAMINADO = ['KG', 'BARRAS', 'M'];
const UNIDADES_FUNDIDO = ['UN', 'KG'];

function normalizeDecimal(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') {
    return Number.parseFloat(defaultValue);
  }

  return parseLocaleDecimal(value);
}

function normalizeOptionalDecimal(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parseLocaleDecimal(value);
}

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function parseLocaleDecimal(value) {
  const text = String(value || '').trim();

  if (!text) {
    return Number.NaN;
  }

  const compact = text.replace(/\s+/g, '');
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');

  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = compact.replaceAll('.', '').replace(',', '.');
    } else {
      normalized = compact.replaceAll(',', '');
    }
  } else if (lastComma >= 0) {
    normalized = compact.replace(',', '.');
  }

  return Number.parseFloat(normalized);
}

function buildPayload(body) {
  const categoria = String(body.categoria || '').trim().toUpperCase() || 'LAMINADO';
  const isFundido = categoria === 'FUNDIDO';
  const geometria = isFundido
    ? 'FUNDIDO'
    : String(body.geometria || '').trim().toUpperCase();
  const comprimentoPadraoMetros = normalizeOptionalDecimal(body.comprimento_padrao_m);
  const comprimentoPadraoMm = comprimentoPadraoMetros === null
    ? normalizeOptionalDecimal(body.comprimento_padrao_mm)
    : Number((comprimentoPadraoMetros * 1000).toFixed(2));

  return {
    codigo: String(body.codigo || '').trim(),
    nome: String(body.nome || '').trim(),
    categoria,
    material: body.material ? String(body.material).trim() : null,
    geometria,
    bitola: isFundido ? null : (body.bitola ? String(body.bitola).trim() : null),
    bitola_mm: isFundido ? null : normalizeOptionalDecimal(body.bitola_mm),
    comprimento_padrao_mm: isFundido ? null : comprimentoPadraoMm,
    peso_por_metro: isFundido ? null : normalizeOptionalDecimal(body.peso_por_metro),
    peso_unitario_kg: isFundido ? normalizeOptionalDecimal(body.peso_unitario_kg) : null,
    densidade_g_cm3: isFundido ? null : normalizeOptionalDecimal(body.densidade_g_cm3),
    estoque_minimo: normalizeDecimal(body.estoque_minimo, 0),
    unidade_estoque: String(body.unidade_estoque || '').trim().toUpperCase() || (isFundido ? 'UN' : 'KG'),
    id_fornecedor_principal: normalizeOptionalInteger(body.id_fornecedor_principal),
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
  if (!Number.isInteger(payload.id_fornecedor_principal)) {
    return;
  }

  const duplicate = await MateriaPrimaFornecedorModel.findDuplicate(
    materiaPrima.id,
    payload.id_fornecedor_principal
  );

  if (duplicate) {
    return;
  }

  await MateriaPrimaFornecedorModel.create(materiaPrima.id, {
    id_fornecedor: payload.id_fornecedor_principal,
    observacao: 'Vinculo padrao criado automaticamente.'
  });
}

async function resolvePrincipalSupplierId(payload) {
  if (Number.isInteger(payload.id_fornecedor_principal)) {
    return payload.id_fornecedor_principal;
  }

  const supplierTerms = resolveDefaultSupplierTerms(payload);
  if (supplierTerms.length === 0) {
    return null;
  }

  const fornecedor = await FornecedorModel.findFirstByNameTerms(supplierTerms);
  return fornecedor ? fornecedor.id : null;
}

function validatePayload(payload) {
  const errors = [];

  if (!payload.codigo) {
    errors.push('O campo codigo e obrigatorio.');
  }

  if (!payload.nome) {
    errors.push('O campo nome e obrigatorio.');
  }

  if (!CATEGORIAS_VALIDAS.includes(payload.categoria)) {
    errors.push('O campo categoria deve ser LAMINADO ou FUNDIDO.');
  }

  if (!payload.material) {
    errors.push('O campo material tecnico e obrigatorio.');
  }

  if (payload.categoria === 'LAMINADO' && !GEOMETRIAS_LAMINADO.includes(payload.geometria)) {
    errors.push('Selecione uma geometria valida para material laminado.');
  }

  if (payload.categoria === 'LAMINADO' && !payload.bitola && payload.bitola_mm === null) {
    errors.push('Informe a bitola em polegada ou em mm para o laminado.');
  }

  if (payload.bitola_mm !== null && (!Number.isFinite(payload.bitola_mm) || payload.bitola_mm <= 0)) {
    errors.push('O campo bitola_mm deve ser maior que zero quando informado.');
  }

  if (
    payload.categoria === 'LAMINADO'
    && payload.comprimento_padrao_mm !== null
    && (!Number.isFinite(payload.comprimento_padrao_mm) || payload.comprimento_padrao_mm <= 0)
  ) {
    errors.push('O campo comprimento_padrao_mm deve ser maior que zero quando informado.');
  }

  if (payload.categoria === 'LAMINADO' && payload.comprimento_padrao_mm === null) {
    errors.push('Informe o comprimento padrao da barra em metros.');
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

  if (payload.categoria === 'LAMINADO' && !UNIDADES_LAMINADO.includes(payload.unidade_estoque)) {
    errors.push('A unidade de controle do laminado deve ser KG, BARRAS ou M.');
  }

  if (payload.categoria === 'FUNDIDO' && !UNIDADES_FUNDIDO.includes(payload.unidade_estoque)) {
    errors.push('A unidade de controle do fundido deve ser UN ou KG.');
  }

  if (!Number.isInteger(payload.id_fornecedor_principal)) {
    errors.push('Selecione o fornecedor principal da materia-prima.');
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
        categoria: req.query.categoria ? String(req.query.categoria).trim().toUpperCase() : '',
        geometria: req.query.geometria ? String(req.query.geometria).trim() : '',
        bitola: req.query.bitola ? String(req.query.bitola).trim() : '',
        id_fornecedor_principal: normalizeOptionalInteger(req.query.id_fornecedor_principal)
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
      payload.id_fornecedor_principal = await resolvePrincipalSupplierId(payload);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const fornecedorPrincipal = await FornecedorModel.findById(payload.id_fornecedor_principal);
      if (!fornecedorPrincipal) {
        return res.status(400).json({ message: 'Fornecedor principal nao encontrado.' });
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
      payload.id_fornecedor_principal = await resolvePrincipalSupplierId(payload);
      const errors = validatePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const fornecedorPrincipal = await FornecedorModel.findById(payload.id_fornecedor_principal);
      if (!fornecedorPrincipal) {
        return res.status(400).json({ message: 'Fornecedor principal nao encontrado.' });
      }

      const materiaPrima = await MateriaPrimaModel.update(req.params.id, payload);

      if (!materiaPrima) {
        return res.status(404).json({ message: 'Materia-prima nao encontrada.' });
      }

      try {
        await applyDefaultSupplierLink(materiaPrima, payload);
      } catch (linkError) {
        console.warn('Nao foi possivel sincronizar o fornecedor principal da materia-prima:', linkError.message);
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
