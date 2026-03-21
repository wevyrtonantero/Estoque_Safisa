// Controller do modulo de estoque de pecas e submontagens.
const EstoqueModel = require('../models/EstoqueModel');

const TIPOS_VALIDOS = ['COMPRADA', 'PRODUZIDA'];
const CLASSIFICACOES_VALIDAS = ['ITEM', 'SUBMONTAGEM'];

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

  return {
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
    return { status: error.statusCode, body: { message: error.message } };
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
      const estoque = normalizeOptionalInteger(req.query.estoque);

      const saldos = await EstoqueModel.findSaldos({
        estoque: Number.isInteger(estoque) ? estoque : null,
        codigo: req.query.codigo ? String(req.query.codigo).trim() : '',
        descricao: req.query.descricao ? String(req.query.descricao).trim() : '',
        tipo: TIPOS_VALIDOS.includes(tipo) ? tipo : '',
        maquina: req.query.maquina ? String(req.query.maquina).trim() : '',
        classificacao: CLASSIFICACOES_VALIDAS.includes(classificacao) ? classificacao : '',
        q: req.query.q ? String(req.query.q).trim() : '',
        ordem_quantidade: ['ASC', 'DESC'].includes(ordemQuantidade) ? ordemQuantidade : ''
      });

      return res.status(200).json(saldos);
    } catch (error) {
      console.error('Erro ao listar saldos do estoque:', error);
      return res.status(500).json({ message: 'Erro ao listar saldos do estoque.' });
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

      const result = await EstoqueModel.processEntradaInicial(payload);
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

      const result = await EstoqueModel.processTransferencia(payload);
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

      const result = await EstoqueModel.processAjuste(payload);
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao ajustar saldo do estoque.');
      return res.status(response.status).json(response.body);
    }
  },

  // Registra uma baixa de venda sempre usando o estoque de expedicao.
  async createSaida(req, res) {
    try {
      const payload = buildSaidaPayload(req.body);
      const errors = validateSaidaPayload(payload);

      if (errors.length > 0) {
        return res.status(400).json({ message: 'Dados invalidos.', errors });
      }

      const result = await EstoqueModel.processSaidaLote(payload);
      return res.status(201).json(result);
    } catch (error) {
      const response = extractErrorResponse(error, 'Erro ao registrar baixa de venda na Expedição.');
      return res.status(response.status).json(response.body);
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
