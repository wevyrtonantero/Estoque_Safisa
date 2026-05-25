const { pool } = require('../../database/connection');
const EstoqueModel = require('./EstoqueModel');

const SERIAL_BLOCK_SIZE = 100000;
const SERIAL_PREFIX_START = 'A'.charCodeAt(0);
const ELIGIBLE_CODE_KEYWORDS = Object.freeze(['VF', 'MC', 'AL', 'BR', 'SAF', 'CJ', 'MBF']);
const ELIGIBLE_ITEM_CODES = Object.freeze([
  '600',
  '550',
  '401RB',
  '401',
  '500',
  '450',
  '400',
  '350',
  '300',
  '250',
  '150',
  '100',
  '001'
]);

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function padSerialNumber(value) {
  return String(value);
}

class SubmontagemSerialModel {
  static isEligibleModel(codigo, descricao = '', classificacao = '') {
    const normalized = String(codigo || '').trim().toUpperCase();
    const normalizedClassificacao = String(classificacao || '').trim().toUpperCase();

    if (!normalized) {
      return false;
    }

    if (ELIGIBLE_ITEM_CODES.includes(normalized)) {
      return true;
    }

    if (normalized.includes('/')) {
      return false;
    }

    if (normalizedClassificacao === 'ITEM') {
      return false;
    }

    return ELIGIBLE_CODE_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }

  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static formatSerial(sequenceNumber) {
    const safeNumber = Number.parseInt(sequenceNumber, 10);

    if (!Number.isInteger(safeNumber) || safeNumber <= 0) {
      throw this.createBusinessError('O numero sequencial informado para o numero de serie e invalido.');
    }

    const prefixIndex = Math.floor((safeNumber - 1) / SERIAL_BLOCK_SIZE);
    const prefix = String.fromCharCode(SERIAL_PREFIX_START + prefixIndex);
    return `${prefix}-${padSerialNumber(safeNumber)}`;
  }

  static async ensureSchema(db = pool) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS submontagem_seriais (
        id BIGINT NOT NULL AUTO_INCREMENT,
        numero_sequencial BIGINT NOT NULL,
        numero_serie VARCHAR(20) NOT NULL,
        id_modelo_servo INT NOT NULL,
        modelo_servo_codigo VARCHAR(100) NOT NULL,
        modelo_servo_descricao VARCHAR(255) NOT NULL,
        data_montagem TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        id_montador INT NULL,
        montador_nome VARCHAR(120) NOT NULL,
        numero_pedido VARCHAR(80) NULL,
        data_saida TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_submontagem_seriais_numero_sequencial (numero_sequencial),
        UNIQUE KEY uq_submontagem_seriais_numero_serie (numero_serie),
        KEY idx_submontagem_seriais_modelo (id_modelo_servo),
        KEY idx_submontagem_seriais_data_montagem (data_montagem),
        KEY idx_submontagem_seriais_pedido (numero_pedido),
        KEY idx_submontagem_seriais_data_saida (data_saida)
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8mb4
        COLLATE = utf8mb4_unicode_ci
    `);
  }

  static mapRow(row) {
    return {
      id: Number(row.id),
      numero_sequencial: Number(row.numero_sequencial),
      numero_serie: row.numero_serie,
      id_modelo_servo: Number(row.id_modelo_servo),
      modelo_servo_codigo: row.modelo_servo_codigo,
      modelo_servo_descricao: row.modelo_servo_descricao,
      data_montagem: row.data_montagem || null,
      id_montador: row.id_montador === null ? null : Number(row.id_montador),
      montador_nome: row.montador_nome,
      numero_pedido: row.numero_pedido || null,
      cliente_nome: row.cliente_nome || null,
      data_saida: row.data_saida || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  }

  static async findModeloServoById(idModeloServo, db = pool) {
    const [rows] = await db.query(
      `
        SELECT id, codigo, descricao, classificacao
        FROM pecas
        WHERE id = ?
        LIMIT 1
      `,
      [idModeloServo]
    );

    const row = rows[0] || null;
    if (!row) {
      return null;
    }

    const classificacao = String(row.classificacao || '').trim().toUpperCase();
    if (!['SUBMONTAGEM', 'ITEM'].includes(classificacao)) {
      return null;
    }

    if (!this.isEligibleModel(row.codigo, row.descricao, classificacao)) {
      return null;
    }

    return {
      id: Number(row.id),
      codigo: row.codigo,
      descricao: row.descricao,
      classificacao
    };
  }

  static async findLastSerial(db = pool) {
    await this.ensureSchema(db);

    const [rows] = await db.query(
      `
        SELECT *
        FROM submontagem_seriais
        ORDER BY numero_sequencial DESC
        LIMIT 1
      `
    );

    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  static async getNextSerialPreview(db = pool) {
    const lastSerial = await this.findLastSerial(db);
    const nextSequence = (lastSerial?.numero_sequencial || 61123) + 1;

    return {
      numero_sequencial: nextSequence,
      numero_serie: this.formatSerial(nextSequence),
      ultimo_registro: lastSerial
    };
  }

  static buildWhereClause(filters = {}) {
    const conditions = ['1 = 1'];
    const params = [];

    if (filters.numero_serie) {
      conditions.push('s.numero_serie LIKE ?');
      params.push(`%${filters.numero_serie}%`);
    }

    if (filters.numero_pedido) {
      conditions.push('COALESCE(s.numero_pedido, \'\') LIKE ?');
      params.push(`%${filters.numero_pedido}%`);
    }

    if (filters.cliente_nome) {
      conditions.push('COALESCE(p.cliente_nome, \'\') LIKE ?');
      params.push(`%${filters.cliente_nome}%`);
    }

    if (filters.montador_nome) {
      conditions.push('s.montador_nome LIKE ?');
      params.push(`%${filters.montador_nome}%`);
    }

    if (Number.isInteger(filters.id_modelo_servo)) {
      conditions.push('s.id_modelo_servo = ?');
      params.push(filters.id_modelo_servo);
    }

    if (filters.data_montagem_inicio) {
      conditions.push('s.data_montagem >= ?');
      params.push(`${filters.data_montagem_inicio} 00:00:00`);
    }

    if (filters.data_montagem_fim) {
      conditions.push('s.data_montagem < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(filters.data_montagem_fim);
    }

    if (filters.com_saida === true) {
      conditions.push('s.data_saida IS NOT NULL');
    } else if (filters.com_saida === false) {
      conditions.push('s.data_saida IS NULL');
    }

    return {
      whereClause: conditions.join(' AND '),
      params
    };
  }

  static async findAll(filters = {}, db = pool) {
    await this.ensureSchema(db);

    const { whereClause, params } = this.buildWhereClause(filters);
    const limit = Number.isInteger(filters.limit) && filters.limit > 0
      ? Math.min(filters.limit, 100)
      : 100;

    const [rows] = await db.query(
      `
        SELECT
          s.*,
          p.cliente_nome
        FROM submontagem_seriais s
        LEFT JOIN pedidos_expedicao p
          ON p.codigo_pedido = s.numero_pedido
        WHERE ${whereClause}
        ORDER BY s.numero_sequencial DESC
        LIMIT ${limit}
      `,
      params
    );

    return rows.map((row) => this.mapRow(row));
  }

  static async findById(id, db = pool) {
    await this.ensureSchema(db);

    const [rows] = await db.query(
      `
        SELECT *
        FROM submontagem_seriais
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  static async findAvailable(filters = {}, db = pool) {
    await this.ensureSchema(db);

    const conditions = [
      'numero_pedido IS NULL',
      'data_saida IS NULL'
    ];
    const params = [];

    if (Number.isInteger(filters.id_modelo_servo)) {
      conditions.push('id_modelo_servo = ?');
      params.push(filters.id_modelo_servo);
    }

    if (filters.numero_serie) {
      conditions.push('numero_serie LIKE ?');
      params.push(`%${filters.numero_serie}%`);
    }

    const limit = Number.isInteger(filters.limit) && filters.limit > 0
      ? Math.min(filters.limit, 500)
      : 200;

    const [rows] = await db.query(
      `
        SELECT *
        FROM submontagem_seriais
        WHERE ${conditions.join(' AND ')}
        ORDER BY numero_sequencial ASC
        LIMIT ${limit}
      `,
      params
    );

    return rows.map((row) => this.mapRow(row));
  }

  static async getAvailableSummary(db = pool) {
    await this.ensureSchema(db);

    const [rows] = await db.query(
      `
        SELECT
          id_modelo_servo,
          modelo_servo_codigo,
          modelo_servo_descricao,
          COUNT(*) AS quantidade_disponivel,
          MIN(numero_sequencial) AS menor_numero_sequencial,
          MAX(numero_sequencial) AS maior_numero_sequencial
        FROM submontagem_seriais
        WHERE numero_pedido IS NULL
          AND data_saida IS NULL
        GROUP BY
          id_modelo_servo,
          modelo_servo_codigo,
          modelo_servo_descricao
        ORDER BY modelo_servo_codigo ASC
      `
    );

    const modelos = rows.map((row) => ({
      id_modelo_servo: Number(row.id_modelo_servo),
      modelo_servo_codigo: row.modelo_servo_codigo,
      modelo_servo_descricao: row.modelo_servo_descricao,
      quantidade_disponivel: Number(row.quantidade_disponivel || 0),
      primeiro_numero_serie: row.menor_numero_sequencial
        ? this.formatSerial(row.menor_numero_sequencial)
        : null,
      ultimo_numero_serie: row.maior_numero_sequencial
        ? this.formatSerial(row.maior_numero_sequencial)
        : null
    }));

    return {
      total_disponivel: modelos.reduce((total, item) => total + Number(item.quantidade_disponivel || 0), 0),
      total_modelos: modelos.length,
      modelos
    };
  }

  static async createBatch(data = {}, db = pool) {
    await this.ensureSchema(db);

    const idModeloServo = normalizeOptionalInteger(data.id_modelo_servo);
    const quantidade = normalizeOptionalInteger(data.quantidade);
    const montadorNome = String(data.montador_nome || '').trim();

    if (!Number.isInteger(idModeloServo)) {
      throw this.createBusinessError('O modelo de servo informado deve ser valido.');
    }

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw this.createBusinessError('A quantidade informada deve ser um numero inteiro maior que zero.');
    }

    if (!montadorNome) {
      throw this.createBusinessError('O nome do montador e obrigatorio.');
    }

    const modeloServo = await this.findModeloServoById(idModeloServo, db);
    if (!modeloServo) {
      throw this.createBusinessError('O modelo informado nao foi encontrado como modelo elegivel para numero de serie.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const estoqueMontagem = await EstoqueModel.findStockByName(EstoqueModel.MONTAGEM_NOME, connection);
      const estoqueExpedicao = await EstoqueModel.findStockByName(EstoqueModel.EXPEDICAO_NOME, connection);

      if (!estoqueMontagem || Number(estoqueMontagem.ativo) !== 1) {
        throw this.createBusinessError('O estoque da Montagem nao esta disponivel para montar o modelo selecionado.');
      }

      if (!estoqueExpedicao || Number(estoqueExpedicao.ativo) !== 1) {
        throw this.createBusinessError('O estoque da Expedicao nao esta disponivel para receber o modelo seriado.');
      }

      const [rows] = await connection.query(
        `
          SELECT numero_sequencial
          FROM submontagem_seriais
          ORDER BY numero_sequencial DESC
          LIMIT 1
          FOR UPDATE
        `
      );

      const lastSequence = rows[0]?.numero_sequencial ? Number(rows[0].numero_sequencial) : 61123;
      const observacaoMovimento = `Montagem com registro de numero de serie por ${montadorNome}. Envio automatico para a Expedicao.`;

      let componentesConsumidos = [];

      if (modeloServo.classificacao === 'SUBMONTAGEM') {
        componentesConsumidos = await EstoqueModel.consumeSubmontagemComponentsFromStock(
          connection,
          modeloServo,
          quantidade,
          estoqueMontagem.id,
          estoqueExpedicao.nome,
          observacaoMovimento
        );

        const saldoAtualSubmontagem = await EstoqueModel.findSaldoForUpdate(
          connection,
          estoqueExpedicao.id,
          modeloServo.id
        );
        const quantidadeAtualSubmontagem = saldoAtualSubmontagem ? Number(saldoAtualSubmontagem.quantidade) : 0;
        const novoSaldoSubmontagem = Number((quantidadeAtualSubmontagem + Number(quantidade)).toFixed(2));

        await EstoqueModel.persistSaldo(
          connection,
          estoqueExpedicao.id,
          modeloServo.id,
          novoSaldoSubmontagem,
          saldoAtualSubmontagem
        );

        await EstoqueModel.createMovimentacao(connection, {
          id_peca: modeloServo.id,
          id_estoque_origem: estoqueMontagem.id,
          id_estoque_destino: estoqueExpedicao.id,
          tipo_movimentacao: 'ENTRADA_INICIAL',
          quantidade,
          observacao: `${observacaoMovimento} Submontagem montada e encaminhada para a Expedicao.`.slice(0, 255)
        });
      } else {
        const saldoAtualItem = await EstoqueModel.findSaldoForUpdate(
          connection,
          estoqueMontagem.id,
          modeloServo.id
        );
        const quantidadeAtualItem = saldoAtualItem ? Number(saldoAtualItem.quantidade) : 0;

        if (Number(quantidade) > quantidadeAtualItem) {
          throw this.createBusinessError(`Saldo insuficiente na Montagem para registrar numero de serie em ${modeloServo.codigo}.`);
        }

        const novoSaldoMontagem = Number((quantidadeAtualItem - Number(quantidade)).toFixed(2));
        await EstoqueModel.persistSaldo(
          connection,
          estoqueMontagem.id,
          modeloServo.id,
          novoSaldoMontagem,
          saldoAtualItem
        );

        const saldoAtualExpedicao = await EstoqueModel.findSaldoForUpdate(
          connection,
          estoqueExpedicao.id,
          modeloServo.id
        );
        const quantidadeAtualExpedicao = saldoAtualExpedicao ? Number(saldoAtualExpedicao.quantidade) : 0;
        const novoSaldoExpedicao = Number((quantidadeAtualExpedicao + Number(quantidade)).toFixed(2));

        await EstoqueModel.persistSaldo(
          connection,
          estoqueExpedicao.id,
          modeloServo.id,
          novoSaldoExpedicao,
          saldoAtualExpedicao
        );

        await EstoqueModel.createMovimentacao(connection, {
          id_peca: modeloServo.id,
          id_estoque_origem: estoqueMontagem.id,
          id_estoque_destino: estoqueExpedicao.id,
          tipo_movimentacao: 'TRANSFERENCIA',
          quantidade,
          observacao: `${observacaoMovimento} Item seriado encaminhado para a Expedicao.`.slice(0, 255)
        });
      }

      const createdRecords = [];

      for (let index = 1; index <= quantidade; index += 1) {
        const numeroSequencial = lastSequence + index;
        const numeroSerie = this.formatSerial(numeroSequencial);

        const [result] = await connection.query(
          `
            INSERT INTO submontagem_seriais (
              numero_sequencial,
              numero_serie,
              id_modelo_servo,
              modelo_servo_codigo,
              modelo_servo_descricao,
              data_montagem,
              id_montador,
              montador_nome
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
          `,
          [
            numeroSequencial,
            numeroSerie,
            modeloServo.id,
            modeloServo.codigo,
            modeloServo.descricao,
            data.id_montador || null,
            montadorNome
          ]
        );

        createdRecords.push({
          id: Number(result.insertId),
          numero_sequencial: numeroSequencial,
          numero_serie: numeroSerie,
          id_modelo_servo: modeloServo.id,
          modelo_servo_codigo: modeloServo.codigo,
          modelo_servo_descricao: modeloServo.descricao,
          montador_nome: montadorNome,
          numero_pedido: null,
          data_saida: null
        });
      }

      await connection.commit();

      return {
        quantidade_criada: createdRecords.length,
        primeiro_numero_serie: createdRecords[0]?.numero_serie || null,
        ultimo_numero_serie: createdRecords[createdRecords.length - 1]?.numero_serie || null,
        estoque_origem_componentes: estoqueMontagem.nome,
        estoque_destino_submontagem: estoqueExpedicao.nome,
        componentes_consumidos: componentesConsumidos,
        registros: createdRecords
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updatePedidoSaida(id, data = {}, db = pool) {
    await this.ensureSchema(db);

    const registroAtual = await this.findById(id, db);
    if (!registroAtual) {
      return null;
    }

    const numeroPedido = data.numero_pedido === undefined
      ? registroAtual.numero_pedido
      : (String(data.numero_pedido || '').trim() || null);

    const dataSaida = data.data_saida === undefined
      ? registroAtual.data_saida
      : (data.data_saida ? String(data.data_saida).trim() : null);

    await db.query(
      `
        UPDATE submontagem_seriais
        SET
          numero_pedido = ?,
          data_saida = ?
        WHERE id = ?
      `,
      [numeroPedido, dataSaida, id]
    );

    return this.findById(id, db);
  }

  static async updateModeloServo(id, data = {}, db = pool) {
    await this.ensureSchema(db);

    const registroAtual = await this.findById(id, db);
    if (!registroAtual) {
      return null;
    }

    const idModeloServo = normalizeOptionalInteger(data.id_modelo_servo);
    if (!Number.isInteger(idModeloServo)) {
      throw this.createBusinessError('O modelo de servo informado deve ser valido.');
    }

    const modeloServo = await this.findModeloServoById(idModeloServo, db);
    if (!modeloServo) {
      throw this.createBusinessError('O modelo de servo informado nao foi encontrado como submontagem.');
    }

    await db.query(
      `
        UPDATE submontagem_seriais
        SET
          id_modelo_servo = ?,
          modelo_servo_codigo = ?,
          modelo_servo_descricao = ?
        WHERE id = ?
      `,
      [modeloServo.id, modeloServo.codigo, modeloServo.descricao, id]
    );

    return this.findById(id, db);
  }

  static async reconcileExpedicaoStockWithAvailableSeriais(db = pool) {
    await this.ensureSchema(db);

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const estoqueExpedicao = await EstoqueModel.findStockByName(EstoqueModel.EXPEDICAO_NOME, connection);
      if (!estoqueExpedicao || Number(estoqueExpedicao.ativo) !== 1) {
        throw this.createBusinessError('O estoque da Expedicao nao esta disponivel para equalizar os seriais.');
      }

      const [rows] = await connection.query(`
        SELECT
          p.id,
          p.codigo,
          p.descricao,
          p.classificacao,
          COUNT(CASE WHEN s.numero_pedido IS NULL AND s.data_saida IS NULL THEN 1 END) AS quantidade_disponivel
        FROM pecas p
        LEFT JOIN submontagem_seriais s ON s.id_modelo_servo = p.id
        WHERE p.classificacao IN ('SUBMONTAGEM', 'ITEM')
        GROUP BY p.id, p.codigo, p.descricao, p.classificacao
        ORDER BY p.codigo ASC
      `);

      const ajustes = [];

      for (const row of rows) {
        if (!this.isEligibleModel(row.codigo, row.descricao, row.classificacao)) {
          continue;
        }

        const quantidadeEsperada = Number(row.quantidade_disponivel || 0);
        const saldoAtual = await EstoqueModel.findSaldoForUpdate(connection, estoqueExpedicao.id, Number(row.id));
        const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;

        if (quantidadeAtual === quantidadeEsperada) {
          continue;
        }

        await EstoqueModel.persistSaldo(
          connection,
          estoqueExpedicao.id,
          Number(row.id),
          quantidadeEsperada,
          saldoAtual
        );

        await EstoqueModel.createMovimentacao(connection, {
          id_peca: Number(row.id),
          id_estoque_origem: quantidadeEsperada < quantidadeAtual ? estoqueExpedicao.id : null,
          id_estoque_destino: quantidadeEsperada > quantidadeAtual ? estoqueExpedicao.id : null,
          tipo_movimentacao: 'AJUSTE',
          quantidade: Math.abs(Number((quantidadeEsperada - quantidadeAtual).toFixed(2))),
          observacao: `Equalizacao automatica pelo controle de seriais disponiveis: ${row.codigo}.`.slice(0, 255)
        });

        ajustes.push({
          id_modelo_servo: Number(row.id),
          codigo: row.codigo,
          descricao: row.descricao,
          saldo_anterior: quantidadeAtual,
          saldo_novo: quantidadeEsperada
        });
      }

      await connection.commit();
      return ajustes;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = SubmontagemSerialModel;
