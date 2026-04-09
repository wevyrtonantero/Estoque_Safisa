// Controller do cadastro de materia-prima com modos de laminado e fundido.
const MateriaPrimaModel = require('../models/MateriaPrimaModel');
const FornecedorModel = require('../models/FornecedorModel');
const MateriaPrimaFornecedorModel = require('../models/MateriaPrimaFornecedorModel');
const { recordAuditLog } = require('../audit/auditLogger');

const CATEGORIAS_VALIDAS = ['LAMINADO', 'FUNDIDO'];
const GEOMETRIAS_LAMINADO = ['REDONDO', 'QUADRADO', 'SEXTAVADO', 'FITA / BOBINA'];
const UNIDADES_LAMINADO = ['KG'];
const UNIDADES_FUNDIDO = ['UN'];
const ESTOQUE_MINIMO_PADRAO_LAMINADO = 60;
const ESTOQUE_MINIMO_PADRAO_FUNDIDO = 50;

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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function normalizeSupplierIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = [];
  const usedIds = new Set();

  value.forEach((entry) => {
    const candidate = typeof entry === 'object' && entry !== null ? entry.id_fornecedor ?? entry.id : entry;
    const parsed = normalizeOptionalInteger(candidate);

    if (Number.isInteger(parsed) && !usedIds.has(parsed)) {
      usedIds.add(parsed);
      uniqueIds.push(parsed);
    }
  });

  return uniqueIds;
}

function getDefaultEstoqueMinimo(categoria) {
  return categoria === 'FUNDIDO'
    ? ESTOQUE_MINIMO_PADRAO_FUNDIDO
    : ESTOQUE_MINIMO_PADRAO_LAMINADO;
}

function buildPayload(body) {
  const categoria = String(body.categoria || '').trim().toUpperCase() || 'LAMINADO';
  const isFundido = categoria === 'FUNDIDO';
  const comprimentoPadraoMetros = normalizeOptionalDecimal(body.comprimento_padrao_m);
  const estoqueMinimoInformado = normalizeOptionalDecimal(body.estoque_minimo);

  const fornecedorIds = normalizeSupplierIds(body.fornecedores);

  return {
    codigo: String(body.codigo || '').trim(),
    nome: String(body.nome || '').trim(),
    categoria,
    material: isFundido ? null : (body.material ? String(body.material).trim() : null),
    liga: body.liga ? String(body.liga).trim() : null,
    geometria: isFundido
      ? 'FUNDIDO'
      : String(body.geometria || '').trim().toUpperCase(),
    bitola: isFundido ? null : (body.bitola ? String(body.bitola).trim() : null),
    bitola_mm: isFundido ? null : normalizeOptionalDecimal(body.bitola_mm),
    comprimento_padrao_mm: isFundido || comprimentoPadraoMetros === null
      ? null
      : Number((comprimentoPadraoMetros * 1000).toFixed(2)),
    peso_por_metro: isFundido ? null : normalizeOptionalDecimal(body.peso_por_metro),
    peso_unitario_kg: isFundido ? normalizeOptionalDecimal(body.peso_unitario_kg) : null,
    densidade_g_cm3: null,
    estoque_minimo: estoqueMinimoInformado === null ? getDefaultEstoqueMinimo(categoria) : estoqueMinimoInformado,
    unidade_estoque: isFundido ? 'UN' : 'KG',
    id_fornecedor_principal: fornecedorIds[0] || null,
    fornecedor_ids: fornecedorIds,
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function validatePayload(payload) {
  const errors = [];

  if (!payload.codigo) {
    errors.push('O campo ID e obrigatorio.');
  }

  if (!payload.nome) {
    errors.push('O campo descricao e obrigatorio.');
  }

  if (!CATEGORIAS_VALIDAS.includes(payload.categoria)) {
    errors.push('O tipo de materia-prima deve ser LAMINADO ou FUNDIDO.');
  }

  if (!payload.liga) {
    errors.push('O campo liga e obrigatorio.');
  }

  if (payload.fornecedor_ids.length === 0) {
    errors.push('Selecione pelo menos um fornecedor.');
  }

  if (payload.categoria === 'LAMINADO' && !payload.material) {
    errors.push('Informe a descricao tecnica do laminado.');
  }

  if (payload.categoria === 'LAMINADO' && !GEOMETRIAS_LAMINADO.includes(payload.geometria)) {
    errors.push('Selecione uma geometria valida para o laminado.');
  }

  if (payload.categoria === 'LAMINADO' && !payload.bitola && payload.bitola_mm === null) {
    errors.push('Informe a bitola em polegada ou em mm.');
  }

  if (payload.bitola_mm !== null && (!Number.isFinite(payload.bitola_mm) || payload.bitola_mm <= 0)) {
    errors.push('A bitola em mm deve ser maior que zero.');
  }

  if (
    payload.categoria === 'LAMINADO'
    && payload.geometria !== 'FITA / BOBINA'
    && (!Number.isFinite(payload.comprimento_padrao_mm) || payload.comprimento_padrao_mm <= 0)
  ) {
    errors.push('Informe o comprimento da barra em metros.');
  }

  if (
    payload.categoria === 'LAMINADO'
    && (!Number.isFinite(payload.peso_por_metro) || payload.peso_por_metro <= 0)
  ) {
    errors.push('Informe o peso por metro do laminado.');
  }

  if (
    payload.categoria === 'FUNDIDO'
    && (!Number.isFinite(payload.peso_unitario_kg) || payload.peso_unitario_kg <= 0)
  ) {
    errors.push('Informe a massa do fundido.');
  }

  if (!Number.isFinite(payload.estoque_minimo) || payload.estoque_minimo < 0) {
    errors.push('O estoque minimo deve ser maior ou igual a zero.');
  }

  if (payload.categoria === 'LAMINADO' && !UNIDADES_LAMINADO.includes(payload.unidade_estoque)) {
    errors.push('O laminado deve usar unidade de controle KG.');
  }

  if (payload.categoria === 'FUNDIDO' && !UNIDADES_FUNDIDO.includes(payload.unidade_estoque)) {
    errors.push('O fundido deve usar unidade de controle UN.');
  }

  return errors;
}

async function ensureSuppliersExist(fornecedorIds) {
  for (const fornecedorId of fornecedorIds) {
    const fornecedor = await FornecedorModel.findById(fornecedorId);
    if (!fornecedor) {
      return false;
    }
  }

  return true;
}

async function syncSuppliers(materiaPrimaId, fornecedorIds) {
  await MateriaPrimaFornecedorModel.replaceAll(materiaPrimaId, fornecedorIds);
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
        id_fornecedor: normalizeOptionalInteger(req.query.id_fornecedor_principal || req.query.id_fornecedor)
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

      const suppliersExist = await ensureSuppliersExist(payload.fornecedor_ids);
      if (!suppliersExist) {
        return res.status(400).json({ message: 'Um ou mais fornecedores nao foram encontrados.' });
      }

      const materiaPrima = await MateriaPrimaModel.create(payload);
      await syncSuppliers(materiaPrima.id, payload.fornecedor_ids);
      const materiaPrimaAtualizada = await MateriaPrimaModel.findById(materiaPrima.id);
      await recordAuditLog(req, {
        modulo: 'MATERIAS_PRIMAS',
        acao: 'CREATE',
        entidade_tipo: 'MATERIA_PRIMA',
        entidade_id: materiaPrimaAtualizada.id,
        descricao: `Materia-prima ${materiaPrimaAtualizada.codigo} criada.`,
        depois: materiaPrimaAtualizada
      });
      return res.status(201).json(materiaPrimaAtualizada);
    } catch (error) {
      console.error('Erro ao criar materia-prima:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Ja existe uma materia-prima com este ID.' });
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

      const suppliersExist = await ensureSuppliersExist(payload.fornecedor_ids);
      if (!suppliersExist) {
        return res.status(400).json({ message: 'Um ou mais fornecedores nao foram encontrados.' });
      }

      const materiaPrimaAnterior = await MateriaPrimaModel.findById(req.params.id);
      const materiaPrima = await MateriaPrimaModel.update(req.params.id, payload);

      if (!materiaPrima) {
        return res.status(404).json({ message: 'Materia-prima nao encontrada.' });
      }

      await syncSuppliers(materiaPrima.id, payload.fornecedor_ids);
      const materiaPrimaAtualizada = await MateriaPrimaModel.findById(materiaPrima.id);
      await recordAuditLog(req, {
        modulo: 'MATERIAS_PRIMAS',
        acao: 'UPDATE',
        entidade_tipo: 'MATERIA_PRIMA',
        entidade_id: materiaPrimaAtualizada.id,
        descricao: `Materia-prima ${materiaPrimaAtualizada.codigo} atualizada.`,
        antes: materiaPrimaAnterior,
        depois: materiaPrimaAtualizada
      });
      return res.status(200).json(materiaPrimaAtualizada);
    } catch (error) {
      console.error('Erro ao atualizar materia-prima:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Ja existe uma materia-prima com este ID.' });
      }
      return res.status(500).json({ message: 'Erro ao atualizar materia-prima.' });
    }
  },

  // Rota para excluir materia-prima.
  async delete(req, res) {
    try {
      const materiaPrimaAnterior = await MateriaPrimaModel.findById(req.params.id);
      const deleted = await MateriaPrimaModel.delete(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: 'Materia-prima nao encontrada.' });
      }

      await recordAuditLog(req, {
        modulo: 'MATERIAS_PRIMAS',
        acao: 'DELETE',
        entidade_tipo: 'MATERIA_PRIMA',
        entidade_id: materiaPrimaAnterior?.id ?? req.params.id,
        descricao: materiaPrimaAnterior
          ? `Materia-prima ${materiaPrimaAnterior.codigo} excluida.`
          : 'Materia-prima excluida.',
        antes: materiaPrimaAnterior
      });

      return res.status(200).json({ message: 'Materia-prima excluida com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir materia-prima:', error);
      return res.status(500).json({ message: 'Erro ao excluir materia-prima.' });
    }
  }
};

module.exports = MateriaPrimaController;
