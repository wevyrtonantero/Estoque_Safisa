// Controller do CRUD de pecas simples.
const PecaModel = require('../models/PecaModel');
const FornecedorModel = require('../models/FornecedorModel');
const PecaFornecedorModel = require('../models/PecaFornecedorModel');
const { recordAuditLog } = require('../audit/auditLogger');

const TIPOS_VALIDOS = ['COMPRADA', 'PRODUZIDA'];

function parseActiveFilter(value) {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'TODOS') return null;
  return status === 'INATIVOS' ? false : true;
}

// Normaliza campos inteiros opcionais sem perder null.
function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

// Normaliza campos decimais opcionais vindos do frontend.
function normalizeOptionalDecimal(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return Number.parseFloat(value);
}

// Normaliza inteiros opcionais sem forcar zero quando o campo vier vazio.
function normalizeOptionalNonNegativeInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
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

// Monta o payload padronizado da entidade peca.
function buildPayload(body) {
  const fornecedorIds = normalizeSupplierIds(body.fornecedores);
  const principalFornecedorId = fornecedorIds[0] || normalizeOptionalInteger(body.id_fornecedor);

  return {
    codigo: String(body.codigo || '').trim(),
    descricao: String(body.descricao || '').trim(),
    comprimento_mm: normalizeOptionalDecimal(body.comprimento_mm),
    tipo: String(body.tipo || '').trim().toUpperCase(),
    classificacao: 'ITEM',
    id_materia_prima: normalizeOptionalInteger(body.id_materia_prima),
    id_fornecedor: principalFornecedorId,
    id_maquina: normalizeOptionalInteger(body.id_maquina),
    fornecedor_ids: fornecedorIds.length > 0
      ? fornecedorIds
      : (Number.isInteger(principalFornecedorId) ? [principalFornecedorId] : []),
    estoque_minimo: normalizeOptionalNonNegativeInteger(body.estoque_minimo),
    estoque_seguranca: normalizeOptionalNonNegativeInteger(body.estoque_seguranca),
    consumo_mensal: normalizeOptionalDecimal(body.consumo_mensal),
    massa_kg: normalizeOptionalDecimal(body.massa_kg)
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

  if (payload.comprimento_mm !== null && (!Number.isFinite(payload.comprimento_mm) || payload.comprimento_mm <= 0)) {
    errors.push('O campo comprimento_mm deve ser maior que zero.');
  }

  if (!TIPOS_VALIDOS.includes(payload.tipo)) {
    errors.push('O campo tipo deve ser COMPRADA ou PRODUZIDA.');
  }

  if (payload.classificacao !== 'ITEM') {
    errors.push('A classificacao da tela de pecas deve ser ITEM.');
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

  if (payload.massa_kg !== null && (!Number.isFinite(payload.massa_kg) || payload.massa_kg < 0)) {
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

async function ensureSuppliersExist(fornecedorIds) {
  for (const fornecedorId of fornecedorIds) {
    const fornecedor = await FornecedorModel.findById(fornecedorId);
    if (!fornecedor) {
      return false;
    }
  }

  return true;
}

async function syncSuppliers(pecaId, fornecedorIds) {
  await PecaFornecedorModel.replaceAll(pecaId, fornecedorIds);
}

const PecaController = {
  // Rota para listar pecas simples.
  async getAll(req, res) {
    try {
      const tipo = req.query.tipo ? String(req.query.tipo).trim().toUpperCase() : '';
      const idMateriaPrima = normalizeOptionalInteger(req.query.id_materia_prima);
      const idFornecedor = normalizeOptionalInteger(req.query.id_fornecedor);
      const idMaquina = normalizeOptionalInteger(req.query.id_maquina);
      const filters = {
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : '',
        tipo: TIPOS_VALIDOS.includes(tipo) ? tipo : '',
        id_materia_prima: Number.isInteger(idMateriaPrima) ? idMateriaPrima : null,
        id_fornecedor: Number.isInteger(idFornecedor) ? idFornecedor : null,
        id_maquina: Number.isInteger(idMaquina) ? idMaquina : null,
        ativo: parseActiveFilter(req.query.status)
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

      const suppliersExist = await ensureSuppliersExist(payload.fornecedor_ids);
      if (!suppliersExist) {
        return res.status(400).json({ message: 'Um ou mais fornecedores nao foram encontrados.' });
      }

      const duplicatePeca = await PecaModel.findByCode(payload.codigo);
      if (duplicatePeca) {
        return res.status(409).json({ message: `O codigo ${payload.codigo} ja esta cadastrado.` });
      }

      const createdPeca = await PecaModel.create(payload);
      await syncSuppliers(createdPeca.id, payload.fornecedor_ids);
      const pecaAtualizada = await PecaModel.findById(createdPeca.id);
      await recordAuditLog(req, {
        modulo: 'PECAS',
        acao: 'CREATE',
        entidade_tipo: 'PECA',
        entidade_id: pecaAtualizada.id,
        descricao: `Peca ${pecaAtualizada.codigo} criada.`,
        depois: pecaAtualizada
      });
      return res.status(201).json(pecaAtualizada);
    } catch (error) {
      console.error('Erro ao criar peca:', error);
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_SIGNAL_EXCEPTION') {
        return res.status(409).json({ message: 'Ja existe uma peca ou submontagem com esse codigo.' });
      }
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

      const suppliersExist = await ensureSuppliersExist(payload.fornecedor_ids);
      if (!suppliersExist) {
        return res.status(400).json({ message: 'Um ou mais fornecedores nao foram encontrados.' });
      }

      const duplicatePeca = await PecaModel.findByCode(payload.codigo, req.params.id);
      if (duplicatePeca) {
        return res.status(409).json({ message: `O codigo ${payload.codigo} ja esta cadastrado.` });
      }

      const pecaAnterior = await PecaModel.findById(req.params.id);
      const updatedPeca = await PecaModel.update(req.params.id, payload);

      if (!updatedPeca) {
        return res.status(404).json({ message: 'Peca nao encontrada.' });
      }

      await syncSuppliers(updatedPeca.id, payload.fornecedor_ids);
      const pecaAtualizada = await PecaModel.findById(updatedPeca.id);
      await recordAuditLog(req, {
        modulo: 'PECAS',
        acao: 'UPDATE',
        entidade_tipo: 'PECA',
        entidade_id: pecaAtualizada.id,
        descricao: `Peca ${pecaAtualizada.codigo} atualizada.`,
        antes: pecaAnterior,
        depois: pecaAtualizada
      });
      return res.status(200).json(pecaAtualizada);
    } catch (error) {
      console.error('Erro ao atualizar peca:', error);
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_SIGNAL_EXCEPTION') {
        return res.status(409).json({ message: 'Ja existe uma peca ou submontagem com esse codigo.' });
      }
      return res.status(500).json({ message: 'Erro ao atualizar peca.' });
    }
  },

  // Rota para excluir pecas.
  async delete(req, res) {
    try {
      const pecaAnterior = await PecaModel.findById(req.params.id);
      const deleted = await PecaModel.delete(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: 'Peca nao encontrada.' });
      }

      await recordAuditLog(req, {
        modulo: 'PECAS',
        acao: 'DELETE',
        entidade_tipo: 'PECA',
        entidade_id: pecaAnterior?.id ?? req.params.id,
        descricao: pecaAnterior ? `Peca ${pecaAnterior.codigo} excluida.` : 'Peca excluida.',
        antes: pecaAnterior
      });

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
  },

  async setActive(req, res) {
    try {
      const ativo = Boolean(req.body.ativo);
      const anterior = await PecaModel.findById(req.params.id);
      const atualizada = await PecaModel.setActive(req.params.id, ativo);

      if (!atualizada) {
        return res.status(404).json({ message: 'Peca nao encontrada.' });
      }

      await recordAuditLog(req, {
        modulo: 'PECAS',
        acao: ativo ? 'REATIVAR' : 'INATIVAR',
        entidade_tipo: 'PECA',
        entidade_id: atualizada.id,
        descricao: `Peca ${atualizada.codigo} ${ativo ? 'reativada' : 'inativada'}.`,
        antes: anterior,
        depois: atualizada
      });

      return res.status(200).json(atualizada);
    } catch (error) {
      console.error('Erro ao alterar status da peca:', error);
      return res.status(500).json({ message: 'Erro ao alterar status da peca.' });
    }
  }
};

module.exports = PecaController;
