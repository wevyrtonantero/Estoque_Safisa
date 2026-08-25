const SubmontagemSerialModel = require('../models/SubmontagemSerialModel');
const { recordAuditLog } = require('../audit/auditLogger');

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) ? parsedValue : null;
}

function normalizeOptionalBoolean(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'sim', 'yes'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'nao', 'não', 'no'].includes(normalized)) {
    return false;
  }

  return null;
}

const SubmontagemSerialController = {
  async getNextSerial(req, res) {
    try {
      const preview = await SubmontagemSerialModel.getNextSerialPreview();
      return res.status(200).json(preview);
    } catch (error) {
      console.error('Erro ao buscar proximo numero de serie da submontagem:', error);
      return res.status(500).json({ message: 'Erro ao buscar o proximo numero de serie.' });
    }
  },

  async getAll(req, res) {
    try {
      const registros = await SubmontagemSerialModel.findAll({
        numero_serie: req.query.numero_serie ? String(req.query.numero_serie).trim() : '',
        numero_pedido: req.query.numero_pedido ? String(req.query.numero_pedido).trim() : '',
        cliente_nome: req.query.cliente_nome ? String(req.query.cliente_nome).trim() : '',
        montador_nome: req.query.montador_nome ? String(req.query.montador_nome).trim() : '',
        id_modelo_servo: normalizeOptionalInteger(req.query.id_modelo_servo),
        data_montagem_inicio: req.query.data_montagem_inicio ? String(req.query.data_montagem_inicio).trim() : '',
        data_montagem_fim: req.query.data_montagem_fim ? String(req.query.data_montagem_fim).trim() : '',
        com_saida: normalizeOptionalBoolean(req.query.com_saida),
        limit: normalizeOptionalInteger(req.query.limit)
      });

      return res.status(200).json(registros);
    } catch (error) {
      console.error('Erro ao listar registros de numeros de serie da submontagem:', error);
      return res.status(500).json({ message: 'Erro ao listar os registros de numeros de serie.' });
    }
  },

  async getAvailable(req, res) {
    try {
      const registros = await SubmontagemSerialModel.findAvailable({
        id_modelo_servo: normalizeOptionalInteger(req.query.id_modelo_servo),
        numero_serie: req.query.numero_serie ? String(req.query.numero_serie).trim() : '',
        limit: normalizeOptionalInteger(req.query.limit)
      });

      return res.status(200).json(registros);
    } catch (error) {
      console.error('Erro ao listar numeros de serie disponiveis:', error);
      return res.status(500).json({ message: 'Erro ao listar os numeros de serie disponiveis.' });
    }
  },

  async getAvailableSummary(req, res) {
    try {
      const resumo = await SubmontagemSerialModel.getAvailableSummary();
      return res.status(200).json(resumo);
    } catch (error) {
      console.error('Erro ao gerar resumo dos numeros de serie disponiveis:', error);
      return res.status(500).json({ message: 'Erro ao consultar o resumo dos numeros de serie disponiveis.' });
    }
  },

  async getById(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'O registro informado deve ser valido.' });
      }

      const registro = await SubmontagemSerialModel.findById(id);
      if (!registro) {
        return res.status(404).json({ message: 'Registro de numero de serie nao encontrado.' });
      }

      return res.status(200).json(registro);
    } catch (error) {
      console.error('Erro ao buscar registro de numero de serie da submontagem:', error);
      return res.status(500).json({ message: 'Erro ao buscar o registro de numero de serie.' });
    }
  },

  async createBatch(req, res) {
    try {
      const montadorNome = String(req.body?.montador_nome || req.currentUser?.nome || '').trim();
      const payload = {
        id_modelo_servo: normalizeOptionalInteger(req.body?.id_modelo_servo),
        quantidade: normalizeOptionalInteger(req.body?.quantidade),
        numero_manual: req.body?.numero_manual,
        id_montador: req.currentUser?.id || null,
        montador_nome: montadorNome
      };

      const result = await SubmontagemSerialModel.createBatch(payload);

      await recordAuditLog(req, {
        modulo: 'SUBMONTAGEM_SERIAIS',
        acao: 'CREATE_BATCH',
        entidade_tipo: 'SUBMONTAGEM_SERIAL',
        entidade_id: result.registros[0]?.id ?? null,
        descricao: `Lote de ${result.quantidade_criada} numeros de serie criado para ${result.ultimo_numero_serie || 'submontagem'}.`,
        depois: {
          id_modelo_servo: payload.id_modelo_servo,
          quantidade_criada: result.quantidade_criada,
          primeiro_numero_serie: result.primeiro_numero_serie,
          ultimo_numero_serie: result.ultimo_numero_serie,
          registro_manual: result.registro_manual,
          montador_nome: montadorNome
        }
      });

      return res.status(201).json(result);
    } catch (error) {
      console.error('Erro ao criar lote de numeros de serie da submontagem:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao criar o lote de numeros de serie.' });
    }
  },

  async updateSequence(req, res) {
    try {
      const antes = await SubmontagemSerialModel.getNextSerialPreview();
      const atualizado = await SubmontagemSerialModel.setNextSerialSequence({
        numero_serie: req.body?.numero_serie,
        numero_sequencial: req.body?.numero_sequencial,
        proximo_numero: req.body?.proximo_numero
      });

      await recordAuditLog(req, {
        modulo: 'SUBMONTAGEM_SERIAIS',
        acao: 'UPDATE_SEQUENCE',
        entidade_tipo: 'SUBMONTAGEM_SERIAL_CONFIG',
        entidade_id: null,
        descricao: `Proximo numero de serie alterado para ${atualizado.numero_serie}.`,
        antes,
        depois: atualizado
      });

      return res.status(200).json(atualizado);
    } catch (error) {
      console.error('Erro ao atualizar sequencia de numeros de serie:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao atualizar a sequencia de numeros de serie.' });
    }
  },

  async updatePedidoSaida(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'O registro informado deve ser valido.' });
      }

      const antes = await SubmontagemSerialModel.findById(id);
      if (!antes) {
        return res.status(404).json({ message: 'Registro de numero de serie nao encontrado.' });
      }

      const atualizado = await SubmontagemSerialModel.updatePedidoSaida(id, {
        numero_pedido: req.body?.numero_pedido,
        data_saida: req.body?.data_saida
      });

      await recordAuditLog(req, {
        modulo: 'SUBMONTAGEM_SERIAIS',
        acao: 'UPDATE_PEDIDO_SAIDA',
        entidade_tipo: 'SUBMONTAGEM_SERIAL',
        entidade_id: atualizado.id,
        descricao: `Numero de serie ${atualizado.numero_serie} atualizado com pedido/saida.`,
        antes,
        depois: atualizado
      });

      return res.status(200).json(atualizado);
    } catch (error) {
      console.error('Erro ao atualizar pedido e saida do numero de serie:', error);
      return res.status(500).json({ message: 'Erro ao atualizar pedido e saida do numero de serie.' });
    }
  },

  async changeAvailableModel(req, res) {
    try {
      const id = normalizeOptionalInteger(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'O registro informado deve ser valido.' });
      }

      const result = await SubmontagemSerialModel.changeAvailableModelWithStock(id, {
        id_modelo_servo: req.body?.id_modelo_servo,
        usuario: req.currentUser || null
      });

      await recordAuditLog(req, {
        modulo: 'SUBMONTAGEM_SERIAIS',
        acao: 'TROCA_MODELO_COM_ESTOQUE',
        entidade_tipo: 'SUBMONTAGEM_SERIAL',
        entidade_id: result.depois.id,
        descricao: `Numero de serie ${result.numero_serie} trocado de ${result.modelo_anterior.codigo} para ${result.modelo_novo.codigo}, com movimentacao automatica dos estoques.`,
        antes: result.antes,
        depois: {
          registro: result.depois,
          modelo_anterior: result.modelo_anterior,
          modelo_novo: result.modelo_novo,
          componentes_retornados: result.componentes_retornados,
          componentes_consumidos: result.componentes_consumidos
        }
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao trocar modelo disponivel com movimentacao de estoque:', error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details || null
        });
      }

      return res.status(500).json({ message: 'Erro ao trocar o modelo e movimentar os estoques.' });
    }
  }
};

module.exports = SubmontagemSerialController;
