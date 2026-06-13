// Controller do modulo de estoque de pecas e submontagens.
const EstoqueModel = require('../models/EstoqueModel');
const ExpedicaoSaidaModel = require('../models/ExpedicaoSaidaModel');
const { recordAuditLog } = require('../audit/auditLogger');

const TIPOS_VALIDOS = ['COMPRADA', 'PRODUZIDA'];
const CLASSIFICACOES_VALIDAS = ['ITEM', 'SUBMONTAGEM'];
const ESTADOS_PRIORIDADE_VALIDOS = ['CRITICO', 'ATENCAO', 'OBSERVAR', 'NORMAL'];
const MODOS_PRIORIDADE_VALIDOS = ['PRIORITARIOS', 'TODOS'];

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function normalizeDecimal(value, defaultValue = Number.NaN) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return Number.parseFloat(value);
}

function normalizeCodeValue(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
}

function normalizeDateFilter(value) {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function buildEntradaPayload(body) {
  return {
    id_peca: normalizeOptionalInteger(body.id_peca),
    id_estoque_origem_componentes: normalizeOptionalInteger(body.id_estoque_origem_componentes),
    id_estoque_destino: normalizeOptionalInteger(body.id_estoque_destino ?? body.id_estoque),
    quantidade: normalizeDecimal(body.quantidade),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function buildTransferPayload(body) {
  return {
    id_peca: normalizeOptionalInteger(body.id_peca),
    id_estoque_origem: normalizeOptionalInteger(body.id_estoque_origem),
    id_estoque_destino: normalizeOptionalInteger(body.id_estoque_destino),
    quantidade: normalizeDecimal(body.quantidade),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

// O ajuste usa novo saldo final para simplificar a operacao e evitar ambiguidade.
function buildAjustePayload(body) {
  return {
    id_peca: normalizeOptionalInteger(body.id_peca),
    id_estoque: normalizeOptionalInteger(body.id_estoque),
    novo_saldo: normalizeDecimal(body.novo_saldo),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function buildSaidaPayload(body) {
  const itens = Array.isArray(body.itens) ? body.itens : [];
  const tipoSaida = body.tipo_saida ? normalizeCodeValue(body.tipo_saida) : 'VENDA';

  return {
    tipo_saida: tipoSaida,
    itens: itens.map((item) => ({
      id_peca: normalizeOptionalInteger(item.id_peca),
      quantidade: normalizeDecimal(item.quantidade)
    })),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function buildConsumoInternoPayload(body) {
  const itens = Array.isArray(body.itens) ? body.itens : [];

  return {
    responsavel_consumo: body.responsavel_consumo
      ? String(body.responsavel_consumo).trim()
      : 'Producao',
    itens: itens.map((item) => ({
      id_peca: normalizeOptionalInteger(item.id_peca),
      quantidade: normalizeDecimal(item.quantidade)
    })),
    observacao: body.observacao ? String(body.observacao).trim() : null
  };
}

function validateEntradaPayload(payload) {
  const errors = [];

  if (!Number.isInteger(payload.id_peca)) {
    errors.push('O item informado deve ser valido.');
  }

  if (!Number.isInteger(payload.id_estoque_destino)) {
    errors.push('O estoque de destino deve ser valido.');
  }

  if (
    payload.id_estoque_origem_componentes !== null
    && !Number.isInteger(payload.id_estoque_origem_componentes)
  ) {
    errors.push('O estoque de origem dos componentes deve ser valido.');
  }

  if (!Number.isFinite(payload.quantidade) || payload.quantidade <= 0) {
    errors.push('A quantidade deve ser maior que zero.');
  }

  return errors;
}

function validateTransferPayload(payload) {
  const errors = [];

  if (!Number.isInteger(payload.id_peca)) {
    errors.push('O item informado deve ser valido.');
  }

  if (!Number.isInteger(payload.id_estoque_origem)) {
    errors.push('O estoque de origem deve ser valido.');
  }

  if (!Number.isInteger(payload.id_estoque_destino)) {
    errors.push('O estoque de destino deve ser valido.');
  }

  if (payload.id_estoque_origem === payload.id_estoque_destino) {
    errors.push('Origem e destino nao podem ser iguais.');
  }

  if (!Number.isFinite(payload.quantidade) || payload.quantidade <= 0) {
    errors.push('A quantidade deve ser maior que zero.');
  }

  return errors;
}

function validateAjustePayload(payload) {
  const errors = [];

  if (!Number.isInteger(payload.id_peca)) {
    errors.push('O item informado deve ser valido.');
  }

  if (!Number.isInteger(payload.id_estoque)) {
    errors.push('O estoque informado deve ser valido.');
  }

  if (!Number.isFinite(payload.novo_saldo) || payload.novo_saldo < 0) {
    errors.push('O novo saldo deve ser um numero valido maior ou igual a zero.');
  }

  return errors;
}

function validateSaidaPayload(payload) {
  const errors = [];

  if (!Array.isArray(payload.itens) || payload.itens.length === 0) {
    errors.push('Informe ao menos um item para baixar na venda.');
    return errors;
  }

  if (!ExpedicaoSaidaModel.TIPOS_SAIDA.includes(payload.tipo_saida)) {
    errors.push('O tipo de saida informado deve ser valido.');
  }

  if (payload.tipo_saida === 'OUTROS' && !payload.observacao) {
    errors.push('A observacao e obrigatoria quando o tipo de saida for Outros.');
  }

  payload.itens.forEach((item, index) => {
    if (!Number.isInteger(item.id_peca)) {
      errors.push(`O item da linha ${index + 1} deve ser valido.`);
    }

    if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) {
      errors.push(`A quantidade da linha ${index + 1} deve ser maior que zero.`);
    }
  });

  return errors;
}

function validateConsumoInternoPayload(payload) {
  const errors = [];

  if (!Array.isArray(payload.itens) || payload.itens.length === 0) {
    errors.push('Informe ao menos um item para o consumo interno.');
    return errors;
  }

  if (!payload.responsavel_consumo) {
    errors.push('Informe o nome do consumo interno.');
  }

  payload.itens.forEach((item, index) => {
    if (!Number.isInteger(item.id_peca)) {
      errors.push(`O item da linha ${index + 1} deve ser valido.`);
    }

    if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) {
      errors.push(`A quantidade da linha ${index + 1} deve ser maior que zero.`);
    }
  });

  return errors;
}

function extractErrorResponse(error, fallbackMessage) {
  if (error.statusCode) {
    const body = { message: error.message };
    if (error.details) {
      body.details = error.details;
    }
    return { status: error.statusCode, body };
  }

  console.error(fallbackMessage, error);
  return { status: 500, body: { message: fallbackMessage } };
}

const EstoqueController = {
  // Rota para listar os estoques padrao do modulo.
  async getStocks(req, res) {
    try {
      const estoques = await EstoqueModel.findStocks();
      return res.status(200).json(estoques);
    } catch (error) {
      console.error('Erro ao listar estoques:', error);
      return res.status(500).json({ message: 'Erro ao listar estoques.' });
    }
  },

  // Rota auxiliar para os modais de movimentacao buscarem pecas e submontagens.
  async getItems(req, res) {
    try {
      const itens = await EstoqueModel.findItemsForStock();
      return res.status(200).json(itens);
    } catch (error) {
      console.error('Erro ao listar itens para o estoque:', error);
      return res.status(500).json({ message: 'Erro ao listar itens para o estoque.' });
    }
  },

  // Lista os saldos com filtros dinamicos.
  async getSaldos(req, res) {
    try {
      const tipo = req.query.tipo ? String(req.query.tipo).trim().toUpperCase() : '';
      const classificacao = req.query.classificacao
        ? String(req.query.classificacao).trim().toUpperCase()
        : '';
      const ordemQuantidade = req.query.ordem_quantidade
        ? String(req.query.ordem_quantidade).trim().toUpperCase()
        : '';
      const modo = req.query.modo ? String(req.query.modo).trim().toUpperCase() : '';
      const estoque = normalizeOptionalInteger(req.query.estoque);
      const idPeca = normalizeOptionalInteger(req.query.id_peca);

      const saldos = await EstoqueModel.findSaldos({
        estoque: Number.isInteger(estoque) ? estoque : null,
        idPeca: Number.isInteger(idPeca) ? idPeca : null,
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : '',
        fornecedor: req.query.fornecedor ? String(req.query.fornecedor).trim() : '',
        tipo: TIPOS_VALIDOS.includes(tipo) ? tipo : '',
        maquina: req.query.maquina ? String(req.query.maquina).trim() : '',
        classificacao: CLASSIFICACOES_VALIDAS.includes(classificacao) ? classificacao : '',
        q: req.query.q ? String(req.query.q).trim() : '',
        ordem_quantidade: ['ASC', 'DESC'].includes(ordemQuantidade) ? ordemQuantidade : '',
        mostrar_todos: modo === 'TODOS'
      });

      return res.status(200).json(saldos);
    } catch (error) {
      console.error('Erro ao listar saldos do estoque:', error);
      return res.status(500).json({ message: 'Erro ao listar saldos do estoque.' });
    }
  },

  // Lista prioridades de reposicao/producao com cobertura e data prevista de ruptura.
  async getPrioridades(req, res) {
    try {
      const estoque = normalizeOptionalInteger(req.query.estoque);
      const classificacao = req.query.classificacao
        ? String(req.query.classificacao).trim().toUpperCase()
        : '';
      const estado = req.query.estado
        ? String(req.query.estado).trim().toUpperCase()
        : '';
      const modo = req.query.modo
        ? String(req.query.modo).trim().toUpperCase()
        : 'PRIORITARIOS';
      const limit = normalizeOptionalInteger(req.query.limit);

      const prioridades = await EstoqueModel.findPrioridades({
        estoque: Number.isInteger(estoque) ? estoque : null,
        estoque_nome: req.query.estoque_nome ? String(req.query.estoque_nome).trim() : '',
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : '',
        fornecedor: req.query.fornecedor ? String(req.query.fornecedor).trim() : '',
        classificacao: CLASSIFICACOES_VALIDAS.includes(classificacao) ? classificacao : '',
        estado: ESTADOS_PRIORIDADE_VALIDOS.includes(estado) ? estado : '',
        modo: MODOS_PRIORIDADE_VALIDOS.includes(modo) ? modo.toLowerCase() : 'prioritarios',
        limit: Number.isInteger(limit) && limit > 0 ? limit : null
      });

      return res.status(200).json(prioridades);
    } catch (error) {
      console.error('Erro ao listar prioridades do estoque:', error);
      return res.status(500).json({ message: 'Erro ao listar prioridades do estoque.' });
    }
  },

  // Busca um saldo especifico da grade principal.
  async getSaldoById(req, res) {
    try {
      const saldo = await EstoqueModel.findSaldoById(req.params.id);

      if (!saldo) {
        return res.status(404).json({ message: 'Saldo nao encontrado.' });
      }

      return res.status(200).json(saldo);
    } catch (error) {
      console.error('Erro ao buscar saldo do estoque:', error);
      return res.status(500).json({ message: 'Erro ao buscar saldo do estoque.' });
    }
  },

  // Cadastra uma entrada inicial em um estoque.
  async createEntradaInicial(req, res) {
    try {
      const payload = buildEntradaPayload(req.body);
      const errors = validateEntradaPayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const result = await EstoqueModel.processEntradaInicial({ ...payload, usuario: req.currentUser || null });
      await recordAuditLog(req, {
        modulo: 'ESTOQUE',
        acao: 'ENTRADA_INICIAL',
        entidade_tipo: 'MOVIMENTACAO_ESTOQUE',
        entidade_id: result?.movimentacao?.id ?? payload.id_peca,
        descricao: 'Entrada inicial registrada no estoque.',
        depois: {
          payload,
          resultado: result
        }
      });
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao registrar entrada inicial no estoque.');
      return res.status(response.status).json(response.body);
    }
  },

  // Realiza transferencia entre dois estoques.
  async createTransferencia(req, res) {
    try {
      const payload = buildTransferPayload(req.body);
      const errors = validateTransferPayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const result = await EstoqueModel.processTransferencia({ ...payload, usuario: req.currentUser || null });
      await recordAuditLog(req, {
        modulo: 'ESTOQUE',
        acao: 'TRANSFERENCIA',
        entidade_tipo: 'MOVIMENTACAO_ESTOQUE',
        entidade_id: result?.movimentacao?.id ?? payload.id_peca,
        descricao: 'Transferencia registrada entre estoques.',
        depois: {
          payload,
          resultado: result
        }
      });
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao transferir item entre estoques.');
      return res.status(response.status).json(response.body);
    }
  },

  // Ajusta o saldo final do item no estoque selecionado.
  async createAjuste(req, res) {
    try {
      const payload = buildAjustePayload(req.body);
      const errors = validateAjustePayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const result = await EstoqueModel.processAjuste({ ...payload, usuario: req.currentUser || null });
      await recordAuditLog(req, {
        modulo: 'ESTOQUE',
        acao: 'AJUSTE',
        entidade_tipo: 'MOVIMENTACAO_ESTOQUE',
        entidade_id: result?.movimentacao?.id ?? payload.id_peca,
        descricao: 'Ajuste manual de estoque registrado.',
        depois: {
          payload,
          resultado: result
        }
      });
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao ajustar saldo do estoque.');
      return res.status(response.status).json(response.body);
    }
  },

  // Registra uma saida sempre usando o estoque de expedicao.
  async createSaida(req, res) {
    try {
      const payload = buildSaidaPayload(req.body);
      const errors = validateSaidaPayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const result = await EstoqueModel.processSaidaLote({
        ...payload,
        usuario: req.currentUser
          ? {
            id: req.currentUser.id,
            login: req.currentUser.login,
            nome: req.currentUser.nome
          }
          : null
      });
      await recordAuditLog(req, {
        modulo: 'ESTOQUE',
        acao: 'SAIDA',
        entidade_tipo: 'EXPEDICAO_SAIDA',
        entidade_id: result?.saida?.id ?? payload.itens?.[0]?.id_peca ?? null,
        descricao: 'Saida da expedicao registrada.',
        depois: {
          payload,
          resultado: result
        }
      });
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao registrar saida na Expedição.');
      return res.status(response.status).json(response.body);
    }
  },

  // Simula a saida pela mesma regra da venda, sem alterar saldos.
  async diagnosticarSaida(req, res) {
    try {
      const payload = buildSaidaPayload(req.body);
      const errors = validateSaidaPayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const result = await EstoqueModel.diagnosticarSaidaLote(payload);
      return res.status(200).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao diagnosticar saida na Expedicao.');
      return res.status(response.status).json(response.body);
    }
  },

  // Registra consumo interno sempre usando o estoque do Almoxarifado e tipo USO_INTERNO.
  async createConsumoInterno(req, res) {
    try {
      const payload = buildConsumoInternoPayload(req.body);
      const errors = validateConsumoInternoPayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const result = await EstoqueModel.processConsumoInternoAlmoxarifado({
        ...payload,
        usuario: req.currentUser
          ? {
            id: req.currentUser.id,
            login: req.currentUser.login,
            nome: req.currentUser.nome
          }
          : null
      });
      await recordAuditLog(req, {
        modulo: 'ESTOQUE',
        acao: 'CONSUMO_INTERNO',
        entidade_tipo: 'EXPEDICAO_SAIDA',
        entidade_id: result?.saida?.id ?? payload.itens?.[0]?.id_peca ?? null,
        descricao: 'Consumo interno do Almoxarifado registrado.',
        depois: {
          payload,
          resultado: result
        }
      });
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao registrar consumo interno do Almoxarifado.');
      return res.status(response.status).json(response.body);
    }
  },

  // Lista o relatorio estruturado de saidas da expedicao.
  async getSaidasExpedicao(req, res) {
    try {
      const tipoSaida = req.query.tipo_saida ? normalizeCodeValue(req.query.tipo_saida) : '';
      const formaAtendimento = req.query.forma_atendimento ? normalizeCodeValue(req.query.forma_atendimento) : '';
      const classificacao = req.query.classificacao ? normalizeCodeValue(req.query.classificacao) : '';
      const limit = normalizeOptionalInteger(req.query.limit);

      const saidas = await ExpedicaoSaidaModel.findAll({
        data_inicio: normalizeDateFilter(req.query.data_inicio),
        data_fim: normalizeDateFilter(req.query.data_fim),
        tipo_saida: ExpedicaoSaidaModel.TIPOS_SAIDA.includes(tipoSaida) ? tipoSaida : '',
        forma_atendimento: ExpedicaoSaidaModel.FORMAS_ATENDIMENTO.includes(formaAtendimento) ? formaAtendimento : '',
        classificacao: CLASSIFICACOES_VALIDAS.includes(classificacao) ? classificacao : '',
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : '',
        observacao: req.query.observacao ? String(req.query.observacao).trim() : '',
        limit: Number.isInteger(limit) && limit > 0 ? limit : null
      });

      return res.status(200).json(saidas);
    } catch (error) {
      console.error('Erro ao listar saidas da expedicao:', error);
      return res.status(500).json({ message: 'Erro ao listar saidas da expedicao.' });
    }
  },

  // Lista o historico geral ou filtrado por estoque.
  async getMovimentacoes(req, res) {
    try {
      const estoque = normalizeOptionalInteger(req.query.estoque);
      const movimentacoes = await EstoqueModel.findMovimentacoes({
        estoque: Number.isInteger(estoque) ? estoque : null
      });

      return res.status(200).json(movimentacoes);
    } catch (error) {
      console.error('Erro ao listar movimentacoes do estoque:', error);
      return res.status(500).json({ message: 'Erro ao listar movimentacoes do estoque.' });
    }
  },

  // Lista o historico de um item especifico para o modal da tela.
  async getMovimentacoesByPeca(req, res) {
    try {
      const movimentacoes = await EstoqueModel.findMovimentacoes({
        idPeca: req.params.idPeca
      });

      return res.status(200).json(movimentacoes);
    } catch (error) {
      console.error('Erro ao listar movimentacoes do item:', error);
      return res.status(500).json({ message: 'Erro ao listar movimentacoes do item.' });
    }
  }
};

module.exports = EstoqueController;
