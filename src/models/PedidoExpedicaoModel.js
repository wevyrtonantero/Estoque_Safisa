const { pool } = require('../../database/connection');
const EstoqueModel = require('./EstoqueModel');
const ExpedicaoSaidaModel = require('./ExpedicaoSaidaModel');
const SubmontagemSerialModel = require('./SubmontagemSerialModel');
const ComposicaoVendaModel = require('./ComposicaoVendaModel');

const STATUS = Object.freeze({
  AGUARDANDO_MONTAGEM: 'AGUARDANDO MONTAGEM',
  EM_MONTAGEM: 'EM MONTAGEM',
  AGUARDANDO_NF: 'AGUARDANDO NF',
  AGUARDANDO_TRANSPORTADORA: 'AGUARDANDO TRANSPORTADORA',
  PEDIDO_COLETADO: 'PEDIDO COLETADO'
});

const BUSINESS_TIME_ZONE = process.env.APP_TIME_ZONE || 'America/Sao_Paulo';

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
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

function normalizeDecimal(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeOptionalDecimal(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = Number(String(value).replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeDateOnly(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return value.trim().slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateOnlyInTimeZone(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    if (values.year && values.month && values.day) {
      return `${values.year}-${values.month}-${values.day}`;
    }
  } catch (_) {
    // Usa a data local do servidor se o timezone configurado nao estiver disponivel.
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDateOnly() {
  return getDateOnlyInTimeZone();
}

function compareOrderAge(a, b) {
  const aDate = normalizeDateOnly(a?.data_pedido);
  const bDate = normalizeDateOnly(b?.data_pedido);

  if (aDate && bDate && aDate !== bDate) {
    return aDate.localeCompare(bDate);
  }

  return Number(a?.id || 0) - Number(b?.id || 0);
}

class PedidoExpedicaoModel {
  static STATUS = STATUS;

  static createBusinessError(message, details = null) {
    const error = new Error(message);
    error.statusCode = 400;
    if (details) {
      error.details = details;
    }
    return error;
  }

  static compareReservationPriority(a, b) {
    const today = getTodayDateOnly();
    const aIsToday = normalizeDateOnly(a?.data_programacao_saida) === today;
    const bIsToday = normalizeDateOnly(b?.data_programacao_saida) === today;

    if (aIsToday !== bIsToday) {
      return aIsToday ? -1 : 1;
    }

    if (aIsToday && bIsToday) {
      return Number(a?.prioridade_ordem || 0) - Number(b?.prioridade_ordem || 0)
        || compareOrderAge(a, b);
    }

    return compareOrderAge(a, b);
  }

  static async ensureSchema(db = pool) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS pedidos_expedicao (
        id BIGINT NOT NULL AUTO_INCREMENT,
        codigo_pedido VARCHAR(20) NULL,
        cliente_nome VARCHAR(160) NOT NULL,
        cidade VARCHAR(120) NOT NULL,
        data_pedido DATE NOT NULL,
        observacao TEXT NULL,
        possui_nota_fiscal TINYINT(1) NOT NULL DEFAULT 0,
        numero_nota_fiscal VARCHAR(80) NULL,
        transportadora VARCHAR(160) NULL,
        vendedora VARCHAR(120) NULL,
        peso_total_override_kg DECIMAL(10, 3) NULL,
        quantidade_volumes INT NULL,
        data_programacao_saida DATE NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'AGUARDANDO MONTAGEM',
        prioridade_ordem INT NOT NULL DEFAULT 0,
        data_coleta DATETIME NULL,
        created_by INT NULL,
        updated_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_pedidos_expedicao_codigo (codigo_pedido),
        KEY idx_pedidos_expedicao_status (status),
        KEY idx_pedidos_expedicao_prioridade (prioridade_ordem),
        KEY idx_pedidos_expedicao_cliente (cliente_nome),
        KEY idx_pedidos_expedicao_data (data_pedido)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const ensureColumn = async (columnName, sqlDefinition) => {
      const [rows] = await db.query(
        `
          SELECT COUNT(*) AS total
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'pedidos_expedicao'
            AND COLUMN_NAME = ?
        `,
        [columnName]
      );

      if (Number(rows[0]?.total || 0) === 0) {
        await db.query(`ALTER TABLE pedidos_expedicao ADD COLUMN ${sqlDefinition}`);
      }
    };

    await ensureColumn('peso_total_override_kg', 'peso_total_override_kg DECIMAL(10, 3) NULL AFTER vendedora');
    await ensureColumn('quantidade_volumes', 'quantidade_volumes INT NULL AFTER peso_total_override_kg');
    await ensureColumn('data_programacao_saida', 'data_programacao_saida DATE NULL AFTER quantidade_volumes');

    await db.query(`
      CREATE TABLE IF NOT EXISTS pedido_expedicao_itens (
        id BIGINT NOT NULL AUTO_INCREMENT,
        id_pedido BIGINT NOT NULL,
        id_peca INT NOT NULL,
        codigo VARCHAR(100) NOT NULL,
        descricao VARCHAR(255) NOT NULL,
        classificacao VARCHAR(40) NOT NULL,
        quantidade INT NOT NULL,
        massa_unitaria_kg DECIMAL(10, 3) NULL,
        exige_numero_serie TINYINT(1) NOT NULL DEFAULT 0,
        separado_avulso TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pedido_expedicao_itens_pedido (id_pedido),
        KEY idx_pedido_expedicao_itens_peca (id_peca),
        CONSTRAINT fk_pedido_expedicao_itens_pedido
          FOREIGN KEY (id_pedido) REFERENCES pedidos_expedicao(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_pedido_expedicao_itens_peca
          FOREIGN KEY (id_peca) REFERENCES pecas(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS pedido_expedicao_item_seriais (
        id BIGINT NOT NULL AUTO_INCREMENT,
        id_pedido_item BIGINT NOT NULL,
        id_submontagem_serial BIGINT NOT NULL,
        numero_serie VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_pedido_item_serial_registro (id_submontagem_serial),
        KEY idx_pedido_item_serial_item (id_pedido_item),
        CONSTRAINT fk_pedido_item_serial_item
          FOREIGN KEY (id_pedido_item) REFERENCES pedido_expedicao_itens(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_pedido_item_serial_serial
          FOREIGN KEY (id_submontagem_serial) REFERENCES submontagem_seriais(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS pedido_expedicao_item_reservas (
        id BIGINT NOT NULL AUTO_INCREMENT,
        id_pedido_item BIGINT NOT NULL,
        id_peca INT NOT NULL,
        id_estoque INT NOT NULL,
        quantidade DECIMAL(10, 2) NOT NULL,
        id_movimentacao_estoque INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pedido_item_reservas_item (id_pedido_item),
        KEY idx_pedido_item_reservas_peca (id_peca),
        KEY idx_pedido_item_reservas_estoque (id_estoque),
        CONSTRAINT fk_pedido_item_reserva_item
          FOREIGN KEY (id_pedido_item) REFERENCES pedido_expedicao_itens(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_pedido_item_reserva_peca
          FOREIGN KEY (id_peca) REFERENCES pecas(id),
        CONSTRAINT fk_pedido_item_reserva_estoque
          FOREIGN KEY (id_estoque) REFERENCES estoques(id),
        CONSTRAINT fk_pedido_item_reserva_movimentacao
          FOREIGN KEY (id_movimentacao_estoque) REFERENCES estoque_movimentacoes(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  static async findPecaById(idPeca, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          codigo,
          descricao,
          classificacao,
          massa_kg
        FROM pecas
        WHERE id = ?
        LIMIT 1
      `,
      [idPeca]
    );

    return rows[0] || null;
  }

  static async releaseSerialBindingInTransaction(connection, bindingId) {
    const [rows] = await connection.query(
      `
        SELECT
          pis.*,
          i.id_pedido
        FROM pedido_expedicao_item_seriais pis
        INNER JOIN pedido_expedicao_itens i ON i.id = pis.id_pedido_item
        WHERE pis.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [bindingId]
    );

    const vinculo = rows[0] || null;
    if (!vinculo) {
      throw this.createBusinessError('Vinculo de numero de serie nao encontrado.');
    }

    const serial = await SubmontagemSerialModel.findById(Number(vinculo.id_submontagem_serial), connection);
    if (!serial) {
      throw this.createBusinessError('Numero de serie vinculado nao encontrado.');
    }

    if (serial.data_saida) {
      throw this.createBusinessError('Nao e possivel desvincular um numero de serie que ja saiu com o pedido.');
    }

    await connection.query('DELETE FROM pedido_expedicao_item_seriais WHERE id = ?', [bindingId]);
    await connection.query(
      `
        UPDATE submontagem_seriais
        SET numero_pedido = NULL
        WHERE id = ?
      `,
      [serial.id]
    );

    const estoqueExpedicao = await EstoqueModel.findStockByName(EstoqueModel.EXPEDICAO_NOME, connection);
    if (!estoqueExpedicao || Number(estoqueExpedicao.ativo) !== 1) {
      throw this.createBusinessError('O estoque da Expedicao nao esta disponivel para devolver a reserva do numero de serie.');
    }

    const saldoExpedicao = await EstoqueModel.findSaldoForUpdate(
      connection,
      estoqueExpedicao.id,
      Number(serial.id_modelo_servo)
    );
    const quantidadeDisponivel = saldoExpedicao ? Number(saldoExpedicao.quantidade) : 0;

    await EstoqueModel.persistSaldo(
      connection,
      estoqueExpedicao.id,
      Number(serial.id_modelo_servo),
      Number((quantidadeDisponivel + 1).toFixed(2)),
      saldoExpedicao
    );

    await EstoqueModel.createMovimentacao(connection, {
      id_peca: Number(serial.id_modelo_servo),
      id_estoque_origem: null,
      id_estoque_destino: estoqueExpedicao.id,
      tipo_movimentacao: 'AJUSTE',
      quantidade: 1,
      observacao: `Retorno de reserva do numero de serie ${serial.numero_serie} ao estoque da Expedicao.`.slice(0, 255)
    });

    return {
      vinculo,
      serial
    };
  }

  static async fetchReservasAvulsasByItemIds(idsItens, connection = pool) {
    if (!idsItens.length) {
      return [];
    }

    const placeholders = idsItens.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `
        SELECT
          pir.id,
          pir.id_pedido_item,
          pir.id_peca,
          pir.id_estoque,
          pir.quantidade,
          pir.id_movimentacao_estoque,
          pir.created_at,
          p.codigo,
          p.descricao,
          e.nome AS estoque_nome
        FROM pedido_expedicao_item_reservas pir
        INNER JOIN pecas p ON p.id = pir.id_peca
        INNER JOIN estoques e ON e.id = pir.id_estoque
        WHERE pir.id_pedido_item IN (${placeholders})
        ORDER BY pir.id ASC
      `,
      idsItens
    );

    return rows.map((row) => ({
      id: Number(row.id),
      id_pedido_item: Number(row.id_pedido_item),
      id_peca: Number(row.id_peca),
      id_estoque: Number(row.id_estoque),
      quantidade: Number(row.quantidade || 0),
      id_movimentacao_estoque: row.id_movimentacao_estoque === null ? null : Number(row.id_movimentacao_estoque),
      codigo: row.codigo,
      descricao: row.descricao,
      estoque_nome: row.estoque_nome,
      created_at: row.created_at || null
    }));
  }

  static async reserveAvulsoComponentsInTransaction(connection, pedido, itemHydrated) {
    const componentes = (itemHydrated.componentes_avulsos || [])
      .map((componente) => ({
        id_peca: Number(componente.id_peca),
        codigo: componente.codigo,
        descricao: componente.descricao,
        quantidade: Number(
          (Number(itemHydrated.quantidade || 0) * Number(componente.quantidade_por_item_venda || 0)).toFixed(2)
        )
      }))
      .filter((componente) => componente.id_peca && componente.quantidade > 0);

    if (!componentes.length) {
      throw this.createBusinessError('Este item nao possui componentes avulsos para separar.');
    }

    const estoqueExpedicao = await EstoqueModel.findStockByName(EstoqueModel.EXPEDICAO_NOME, connection);
    if (!estoqueExpedicao || Number(estoqueExpedicao.ativo) !== 1) {
      throw this.createBusinessError('O estoque da Expedicao nao esta disponivel para validar a separacao.');
    }

    for (const componente of componentes) {
      const saldoExpedicao = await EstoqueModel.findSaldoForUpdate(
        connection,
        estoqueExpedicao.id,
        componente.id_peca
      );
      const quantidadeDisponivel = saldoExpedicao ? Number(saldoExpedicao.quantidade) : 0;

      if (quantidadeDisponivel < componente.quantidade) {
        throw this.createBusinessError(
          `Nao e possivel marcar OK. Faltam ${Number((componente.quantidade - quantidadeDisponivel).toFixed(2))} unidade(s) de ${componente.codigo} na Expedicao.`
        );
      }

      await EstoqueModel.persistSaldo(
        connection,
        estoqueExpedicao.id,
        componente.id_peca,
        Number((quantidadeDisponivel - componente.quantidade).toFixed(2)),
        saldoExpedicao
      );

      const idMovimentacao = await EstoqueModel.createMovimentacao(connection, {
        id_peca: componente.id_peca,
        id_estoque_origem: estoqueExpedicao.id,
        id_estoque_destino: null,
        tipo_movimentacao: 'AJUSTE',
        quantidade: componente.quantidade,
        observacao: `Reserva do item ${componente.codigo} para o pedido ${pedido.codigo_pedido}.`.slice(0, 255)
      });

      await connection.query(
        `
          INSERT INTO pedido_expedicao_item_reservas (
            id_pedido_item,
            id_peca,
            id_estoque,
            quantidade,
            id_movimentacao_estoque
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          Number(itemHydrated.id),
          componente.id_peca,
          estoqueExpedicao.id,
          componente.quantidade,
          idMovimentacao
        ]
      );
    }
  }

  static async releaseAvulsoReservationsInTransaction(connection, idPedidoItem, pedidoCodigo = '') {
    const itemId = normalizeOptionalInteger(idPedidoItem);
    if (!Number.isInteger(itemId)) {
      return [];
    }

    const [rows] = await connection.query(
      `
        SELECT
          pir.*,
          p.codigo,
          p.descricao,
          e.nome AS estoque_nome
        FROM pedido_expedicao_item_reservas pir
        INNER JOIN pecas p ON p.id = pir.id_peca
        INNER JOIN estoques e ON e.id = pir.id_estoque
        WHERE pir.id_pedido_item = ?
        ORDER BY pir.id ASC
        FOR UPDATE
      `,
      [itemId]
    );

    const reservas = rows.map((row) => ({
      id: Number(row.id),
      id_pedido_item: Number(row.id_pedido_item),
      id_peca: Number(row.id_peca),
      id_estoque: Number(row.id_estoque),
      quantidade: Number(row.quantidade || 0),
      codigo: row.codigo,
      descricao: row.descricao,
      estoque_nome: row.estoque_nome
    }));

    for (const reserva of reservas) {
      if (reserva.quantidade <= 0) {
        continue;
      }

      const saldoAtual = await EstoqueModel.findSaldoForUpdate(
        connection,
        reserva.id_estoque,
        reserva.id_peca
      );
      const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;

      await EstoqueModel.persistSaldo(
        connection,
        reserva.id_estoque,
        reserva.id_peca,
        Number((quantidadeAtual + reserva.quantidade).toFixed(2)),
        saldoAtual
      );

      await EstoqueModel.createMovimentacao(connection, {
        id_peca: reserva.id_peca,
        id_estoque_origem: null,
        id_estoque_destino: reserva.id_estoque,
        tipo_movimentacao: 'AJUSTE',
        quantidade: reserva.quantidade,
        observacao: `Retorno da reserva do item ${reserva.codigo}${pedidoCodigo ? ` do pedido ${pedidoCodigo}` : ''}.`.slice(0, 255)
      });
    }

    if (reservas.length) {
      await connection.query(
        'DELETE FROM pedido_expedicao_item_reservas WHERE id_pedido_item = ?',
        [itemId]
      );
    }

    return reservas;
  }

  static async findResumoClientes(filters = {}, connection = pool) {
    await this.ensureSchema(connection);

    const conditions = ['1 = 1'];
    const params = [];

    if (filters.q) {
      conditions.push('cliente_nome LIKE ?');
      params.push(`%${String(filters.q).trim()}%`);
    }

    const limit = Number.isInteger(filters.limit) && filters.limit > 0
      ? Math.min(filters.limit, 20)
      : 10;

    const [rows] = await connection.query(
      `
        SELECT
          cliente_nome,
          SUBSTRING_INDEX(
            GROUP_CONCAT(cidade ORDER BY updated_at DESC SEPARATOR '||'),
            '||',
            1
          ) AS cidade,
          SUBSTRING_INDEX(
            GROUP_CONCAT(vendedora ORDER BY updated_at DESC SEPARATOR '||'),
            '||',
            1
          ) AS vendedora,
          MAX(updated_at) AS ultima_utilizacao
        FROM pedidos_expedicao
        WHERE ${conditions.join(' AND ')}
        GROUP BY cliente_nome
        ORDER BY ultima_utilizacao DESC
        LIMIT ${limit}
      `,
      params
    );

    return rows.map((row) => ({
      cliente_nome: row.cliente_nome,
      cidade: row.cidade || '',
      vendedora: row.vendedora || '',
      ultima_utilizacao: row.ultima_utilizacao || null
    }));
  }

  static async create(data = {}, connection = pool) {
    await this.ensureSchema(connection);

    const codigoPedido = String(data.codigo_pedido || '').trim();
    const clienteNome = String(data.cliente_nome || '').trim();
    const cidade = String(data.cidade || '').trim();
    const dataPedido = String(data.data_pedido || '').trim();
    const observacao = String(data.observacao || '').trim() || null;
    const possuiNotaFiscal = normalizeOptionalBoolean(data.possui_nota_fiscal) === true ? 1 : 0;
    const transportadora = String(data.transportadora || '').trim() || null;
    const vendedora = String(data.vendedora || '').trim() || null;
    const pesoTotalOverrideKg = normalizeOptionalDecimal(data.peso_total_override_kg);
    const quantidadeVolumes = normalizeOptionalInteger(data.quantidade_volumes);
    const itens = Array.isArray(data.itens) ? data.itens : [];

    if (!codigoPedido) {
      throw this.createBusinessError('Informe o numero do pedido.');
    }

    if (!clienteNome) {
      throw this.createBusinessError('Informe o cliente do pedido.');
    }

    if (!cidade) {
      throw this.createBusinessError('Informe a cidade do pedido.');
    }

    if (!dataPedido) {
      throw this.createBusinessError('Informe a data do pedido.');
    }

    if (!itens.length) {
      throw this.createBusinessError('Inclua ao menos um item no pedido.');
    }

    const dbConnection = connection.getConnection ? await connection.getConnection() : connection;
    const shouldRelease = Boolean(connection.getConnection);

    try {
      await dbConnection.beginTransaction();

      const [prioridadeRows] = await dbConnection.query(
        `
          SELECT COALESCE(MAX(prioridade_ordem), 0) AS ultima_prioridade
          FROM pedidos_expedicao
          WHERE data_coleta IS NULL
        `
      );
      const prioridadeOrdem = Number(prioridadeRows[0]?.ultima_prioridade || 0) + 1;

      const [pedidoResult] = await dbConnection.query(
        `
          INSERT INTO pedidos_expedicao (
            codigo_pedido,
            cliente_nome,
            cidade,
            data_pedido,
            observacao,
            possui_nota_fiscal,
            transportadora,
            vendedora,
            peso_total_override_kg,
            quantidade_volumes,
            status,
            prioridade_ordem,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          codigoPedido,
          clienteNome,
          cidade,
          dataPedido,
          observacao,
          possuiNotaFiscal,
          transportadora,
          vendedora,
          pesoTotalOverrideKg,
          quantidadeVolumes,
          STATUS.AGUARDANDO_MONTAGEM,
          prioridadeOrdem,
          data.usuario_id || null,
          data.usuario_id || null
        ]
      );

      const pedidoId = Number(pedidoResult.insertId);

      for (const item of itens) {
        const idPeca = normalizeOptionalInteger(item.id_peca);
        const quantidade = normalizeOptionalInteger(item.quantidade);

        if (!Number.isInteger(idPeca)) {
          throw this.createBusinessError('Um dos itens informados nao possui peca valida.');
        }

        if (!Number.isInteger(quantidade) || quantidade <= 0) {
          throw this.createBusinessError('A quantidade de cada item deve ser um numero inteiro maior que zero.');
        }

        const peca = await this.findPecaById(idPeca, dbConnection);
        if (!peca) {
          throw this.createBusinessError('Uma das pecas do pedido nao foi encontrada.');
        }

        const exigeNumeroSerie = SubmontagemSerialModel.isEligibleModel(peca.codigo, peca.descricao) ? 1 : 0;

        await dbConnection.query(
          `
            INSERT INTO pedido_expedicao_itens (
              id_pedido,
              id_peca,
              codigo,
              descricao,
              classificacao,
              quantidade,
              massa_unitaria_kg,
              exige_numero_serie,
              separado_avulso
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
          `,
          [
            pedidoId,
            peca.id,
            peca.codigo,
            peca.descricao,
            peca.classificacao,
            quantidade,
            peca.massa_kg || null,
            exigeNumeroSerie
          ]
        );
      }

      await this.recalculateStatus(dbConnection, pedidoId, data.usuario_id || null);
      await dbConnection.commit();

      return this.findById(pedidoId, dbConnection);
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        throw this.createBusinessError('Ja existe um pedido com esse numero.');
      }

      await dbConnection.rollback();
      throw error;
    } finally {
      if (shouldRelease) {
        dbConnection.release();
      }
    }
  }

  static async update(id, data = {}, db = pool) {
    await this.ensureSchema(db);

    const pedidoId = normalizeOptionalInteger(id);
    if (!Number.isInteger(pedidoId)) {
      throw this.createBusinessError('O pedido informado e invalido.');
    }

    const codigoPedido = String(data.codigo_pedido || '').trim();
    const clienteNome = String(data.cliente_nome || '').trim();
    const cidade = String(data.cidade || '').trim();
    const dataPedido = String(data.data_pedido || '').trim();
    const observacao = String(data.observacao || '').trim() || null;
    const possuiNotaFiscal = normalizeOptionalBoolean(data.possui_nota_fiscal) === true ? 1 : 0;
    const transportadora = String(data.transportadora || '').trim() || null;
    const vendedora = String(data.vendedora || '').trim() || null;
    const pesoTotalOverrideKg = normalizeOptionalDecimal(data.peso_total_override_kg);
    const quantidadeVolumes = normalizeOptionalInteger(data.quantidade_volumes);
    const itens = Array.isArray(data.itens) ? data.itens : [];

    if (!codigoPedido) {
      throw this.createBusinessError('Informe o numero do pedido.');
    }

    if (!clienteNome) {
      throw this.createBusinessError('Informe o cliente do pedido.');
    }

    if (!cidade) {
      throw this.createBusinessError('Informe a cidade do pedido.');
    }

    if (!dataPedido) {
      throw this.createBusinessError('Informe a data do pedido.');
    }

    if (!itens.length) {
      throw this.createBusinessError('Inclua ao menos um item no pedido.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const pedidoAtual = await this.findById(pedidoId, connection);
      if (!pedidoAtual) {
        throw this.createBusinessError('Pedido nao encontrado.');
      }

      if (pedidoAtual.status === STATUS.PEDIDO_COLETADO) {
        throw this.createBusinessError('Nao e possivel editar um pedido que ja foi coletado.');
      }

      const itensNormalizados = itens.map((item) => ({
        id_peca: normalizeOptionalInteger(item.id_peca),
        quantidade: normalizeOptionalInteger(item.quantidade)
      }));

      await connection.query(
        `
          UPDATE pedidos_expedicao
          SET
            codigo_pedido = ?,
            cliente_nome = ?,
            cidade = ?,
            data_pedido = ?,
            observacao = ?,
            possui_nota_fiscal = ?,
            transportadora = ?,
            vendedora = ?,
            peso_total_override_kg = ?,
            quantidade_volumes = ?,
            updated_by = ?
          WHERE id = ?
        `,
        [
          codigoPedido,
          clienteNome,
          cidade,
          dataPedido,
          observacao,
          possuiNotaFiscal,
          transportadora,
          vendedora,
          pesoTotalOverrideKg,
          quantidadeVolumes,
          data.usuario_id || null,
          pedidoId
        ]
      );

      const itensAtuaisPorPeca = new Map(
        pedidoAtual.itens.map((item) => [Number(item.id_peca), item])
      );
      const itensNovosPorPeca = new Map();

      for (const item of itensNormalizados) {
        if (!Number.isInteger(item.id_peca)) {
          throw this.createBusinessError('Uma das pecas do pedido nao foi encontrada.');
        }

        if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) {
          throw this.createBusinessError('A quantidade de cada item deve ser um numero inteiro maior que zero.');
        }

        if (itensNovosPorPeca.has(Number(item.id_peca))) {
          throw this.createBusinessError('Nao repita a mesma peca no pedido. Ajuste apenas a quantidade.');
        }

        itensNovosPorPeca.set(Number(item.id_peca), item);
      }

      for (const itemAtual of pedidoAtual.itens) {
        if (itensNovosPorPeca.has(Number(itemAtual.id_peca))) {
          continue;
        }

        for (const serial of itemAtual.seriais_vinculados || []) {
          await this.releaseSerialBindingInTransaction(connection, Number(serial.id));
        }

        if (itemAtual.separado_avulso) {
          await this.releaseAvulsoReservationsInTransaction(connection, Number(itemAtual.id), pedidoAtual.codigo_pedido);
        }

        await connection.query('DELETE FROM pedido_expedicao_itens WHERE id = ?', [Number(itemAtual.id)]);
      }

      for (const item of itensNormalizados) {
        const itemAtual = itensAtuaisPorPeca.get(Number(item.id_peca));
        const peca = await this.findPecaById(item.id_peca, connection);
        if (!peca) {
          throw this.createBusinessError('Uma das pecas do pedido nao foi encontrada.');
        }

        const exigeNumeroSerie = SubmontagemSerialModel.isEligibleModel(peca.codigo, peca.descricao, peca.classificacao) ? 1 : 0;

        if (!itemAtual) {
          await connection.query(
            `
              INSERT INTO pedido_expedicao_itens (
                id_pedido,
                id_peca,
                codigo,
                descricao,
                classificacao,
                quantidade,
                massa_unitaria_kg,
                exige_numero_serie,
                separado_avulso
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            `,
            [
              pedidoId,
              peca.id,
              peca.codigo,
              peca.descricao,
              peca.classificacao,
              item.quantidade,
              peca.massa_kg || null,
              exigeNumeroSerie
            ]
          );
          continue;
        }

        const quantidadeAnterior = Number(itemAtual.quantidade || 0);
        const quantidadeNova = Number(item.quantidade || 0);
        const quantidadePorItemVenda = Number(itemAtual.componente_serial?.quantidade_por_item_venda || 1);
        const seriaisVinculados = Array.isArray(itemAtual.seriais_vinculados) ? itemAtual.seriais_vinculados : [];
        const quantidadeSeriaisNecessariosNova = exigeNumeroSerie
          ? Math.max(1, quantidadeNova * quantidadePorItemVenda)
          : 0;

        if (exigeNumeroSerie && seriaisVinculados.length > quantidadeSeriaisNecessariosNova) {
          const excedentes = seriaisVinculados.slice(quantidadeSeriaisNecessariosNova);
          for (const serial of excedentes) {
            await this.releaseSerialBindingInTransaction(connection, Number(serial.id));
          }
        }

        if (quantidadeNova !== quantidadeAnterior && itemAtual.separado_avulso) {
          await this.releaseAvulsoReservationsInTransaction(connection, Number(itemAtual.id), pedidoAtual.codigo_pedido);
        }

        await connection.query(
          `
            UPDATE pedido_expedicao_itens
            SET
              codigo = ?,
              descricao = ?,
              classificacao = ?,
              quantidade = ?,
              massa_unitaria_kg = ?,
              exige_numero_serie = ?,
              separado_avulso = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [
            peca.codigo,
            peca.descricao,
            peca.classificacao,
            quantidadeNova,
            peca.massa_kg || null,
            exigeNumeroSerie,
            quantidadeNova !== quantidadeAnterior ? 0 : Number(itemAtual.separado_avulso || 0),
            Number(itemAtual.id)
          ]
        );
      }

      await this.recalculateStatus(connection, pedidoId, data.usuario_id || null);
      await connection.commit();

      return this.findById(pedidoId, connection);
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        throw this.createBusinessError('Ja existe um pedido com esse numero.');
      }

      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async delete(id, usuarioId = null, db = pool) {
    await this.ensureSchema(db);

    const pedidoId = normalizeOptionalInteger(id);
    if (!Number.isInteger(pedidoId)) {
      throw this.createBusinessError('O pedido informado e invalido.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const pedido = await this.findById(pedidoId, connection);
      if (!pedido) {
        throw this.createBusinessError('Pedido nao encontrado.');
      }

      if (pedido.status === STATUS.PEDIDO_COLETADO) {
        throw this.createBusinessError('Nao e possivel excluir um pedido que ja foi coletado.');
      }

      for (const item of pedido.itens || []) {
        for (const serial of item.seriais_vinculados || []) {
          await this.releaseSerialBindingInTransaction(connection, Number(serial.id));
        }

        if (item.separado_avulso) {
          await this.releaseAvulsoReservationsInTransaction(connection, Number(item.id), pedido.codigo_pedido);
        }
      }

      await connection.query('DELETE FROM pedidos_expedicao WHERE id = ?', [pedidoId]);
      await connection.commit();

      return pedido;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async fetchPedidos(filters = {}, connection = pool) {
    await this.ensureSchema(connection);

    const conditions = ['1 = 1'];
    const params = [];

    if (filters.id) {
      conditions.push('p.id = ?');
      params.push(filters.id);
    }

    if (filters.status) {
      conditions.push('p.status = ?');
      params.push(filters.status);
    }

    if (filters.ativos === true) {
      conditions.push('p.data_coleta IS NULL');
    } else if (filters.ativos === false) {
      conditions.push('p.data_coleta IS NOT NULL');
    }

    if (filters.q) {
      conditions.push(`
        (
          p.codigo_pedido LIKE ?
          OR p.cliente_nome LIKE ?
          OR COALESCE(p.cidade, '') LIKE ?
          OR COALESCE(p.transportadora, '') LIKE ?
          OR COALESCE(p.vendedora, '') LIKE ?
        )
      `);
      const value = `%${String(filters.q).trim()}%`;
      params.push(value, value, value, value, value);
    }

    const [rows] = await connection.query(
      `
        SELECT
          p.*
        FROM pedidos_expedicao p
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          CASE WHEN p.data_coleta IS NULL THEN 0 ELSE 1 END ASC,
          p.prioridade_ordem ASC,
          p.data_pedido DESC,
          p.id DESC
      `,
      params
    );

    return rows.map((row) => ({
      id: Number(row.id),
      codigo_pedido: row.codigo_pedido,
      cliente_nome: row.cliente_nome,
      cidade: row.cidade,
      data_pedido: normalizeDateOnly(row.data_pedido) || null,
      observacao: row.observacao || '',
      possui_nota_fiscal: Number(row.possui_nota_fiscal || 0) === 1,
      numero_nota_fiscal: row.numero_nota_fiscal || '',
      transportadora: row.transportadora || '',
      vendedora: row.vendedora || '',
      peso_total_override_kg: row.peso_total_override_kg === null ? null : Number(row.peso_total_override_kg),
      quantidade_volumes: row.quantidade_volumes === null ? null : Number(row.quantidade_volumes),
      data_programacao_saida: normalizeDateOnly(row.data_programacao_saida) || null,
      status: row.status,
      prioridade_ordem: Number(row.prioridade_ordem || 0),
      data_coleta: row.data_coleta || null,
      created_by: row.created_by === null ? null : Number(row.created_by),
      updated_by: row.updated_by === null ? null : Number(row.updated_by),
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    }));
  }

  static async fetchItensByPedidoIds(idsPedidos, connection = pool) {
    if (!idsPedidos.length) {
      return [];
    }

    const placeholders = idsPedidos.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `
        SELECT
          i.*,
          (
            SELECT COUNT(*)
            FROM pedido_expedicao_item_seriais pis
            WHERE pis.id_pedido_item = i.id
          ) AS quantidade_seriais_vinculados
        FROM pedido_expedicao_itens i
        WHERE i.id_pedido IN (${placeholders})
        ORDER BY i.id ASC
      `,
      idsPedidos
    );

    return rows.map((row) => ({
      id: Number(row.id),
      id_pedido: Number(row.id_pedido),
      id_peca: Number(row.id_peca),
      codigo: row.codigo,
      descricao: row.descricao,
      classificacao: row.classificacao,
      quantidade: Number(row.quantidade),
      massa_unitaria_kg: row.massa_unitaria_kg === null ? null : Number(row.massa_unitaria_kg),
      exige_numero_serie: Number(row.exige_numero_serie || 0) === 1,
      separado_avulso: Number(row.separado_avulso || 0) === 1,
      quantidade_seriais_vinculados: Number(row.quantidade_seriais_vinculados || 0),
      seriais_vinculados: [],
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    }));
  }

  static async fetchSeriaisVinculadosByItemIds(idsItens, connection = pool) {
    if (!idsItens.length) {
      return [];
    }

    const placeholders = idsItens.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `
        SELECT
          pis.id,
          pis.id_pedido_item,
          pis.id_submontagem_serial,
          pis.numero_serie,
          pis.created_at,
          s.modelo_servo_codigo,
          s.modelo_servo_descricao,
          s.data_saida
        FROM pedido_expedicao_item_seriais pis
        INNER JOIN submontagem_seriais s ON s.id = pis.id_submontagem_serial
        WHERE pis.id_pedido_item IN (${placeholders})
        ORDER BY pis.id ASC
      `,
      idsItens
    );

    return rows.map((row) => ({
      id: Number(row.id),
      id_pedido_item: Number(row.id_pedido_item),
      id_submontagem_serial: Number(row.id_submontagem_serial),
      numero_serie: row.numero_serie,
      modelo_servo_codigo: row.modelo_servo_codigo,
      modelo_servo_descricao: row.modelo_servo_descricao,
      data_saida: row.data_saida || null,
      created_at: row.created_at || null
    }));
  }

  static async buildStockMap(estoqueNome, idsPeca, connection = pool) {
    if (!idsPeca.length) {
      return new Map();
    }

    const placeholders = idsPeca.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `
        SELECT
          s.id_peca,
          s.quantidade
        FROM estoque_saldos s
        INNER JOIN estoques e ON e.id = s.id_estoque
        WHERE e.nome = ?
          AND s.id_peca IN (${placeholders})
      `,
      [estoqueNome, ...idsPeca]
    );

    const map = new Map();
    idsPeca.forEach((idPeca) => {
      map.set(Number(idPeca), 0);
    });

    rows.forEach((row) => {
      map.set(Number(row.id_peca), Number(row.quantidade || 0));
    });

    return map;
  }

  static async buildStructureMap(idsModelo, connection = pool) {
    if (!idsModelo.length) {
      return new Map();
    }

    const placeholders = idsModelo.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `
        SELECT
          es.id_submontagem,
          es.id_item_componente,
          es.quantidade,
          p.codigo,
          p.descricao
        FROM estrutura_submontagem es
        INNER JOIN pecas p ON p.id = es.id_item_componente
        WHERE es.id_submontagem IN (${placeholders})
        ORDER BY es.id_submontagem ASC, p.codigo ASC
      `,
      idsModelo
    );

    const map = new Map();
    idsModelo.forEach((idModelo) => {
      map.set(Number(idModelo), []);
    });

    rows.forEach((row) => {
      const idModelo = Number(row.id_submontagem);
      if (!map.has(idModelo)) {
        map.set(idModelo, []);
      }

      map.get(idModelo).push({
        id_peca: Number(row.id_item_componente),
        codigo: row.codigo,
        descricao: row.descricao,
        quantidade: Number(row.quantidade || 0)
      });
    });

    return map;
  }

  static reserveFromStockMap(stockMap, idPeca, quantidadeNecessaria) {
    const quantidadeDisponivel = Number(stockMap.get(Number(idPeca)) || 0);
    const quantidadeReservada = Math.min(
      Math.max(0, Number(quantidadeNecessaria || 0)),
      Math.max(0, quantidadeDisponivel)
    );

    stockMap.set(Number(idPeca), Math.max(0, Number((quantidadeDisponivel - quantidadeReservada).toFixed(2))));
    return quantidadeReservada;
  }

  static reserveAcrossStocks(stockMaps, idPeca, quantidadeNecessaria) {
    const restanteInicial = Math.max(0, Number(quantidadeNecessaria || 0));
    let restante = restanteInicial;

    const reservadoExpedicao = this.reserveFromStockMap(stockMaps.expedicao, idPeca, restante);
    restante = Number((restante - reservadoExpedicao).toFixed(2));

    const reservadoMontagem = this.reserveFromStockMap(stockMaps.montagem, idPeca, restante);
    restante = Number((restante - reservadoMontagem).toFixed(2));

    const reservadoAlmoxarifado = this.reserveFromStockMap(stockMaps.almoxarifado, idPeca, restante);
    restante = Number((restante - reservadoAlmoxarifado).toFixed(2));

    return {
      reservado_expedicao: reservadoExpedicao,
      reservado_montagem: reservadoMontagem,
      reservado_almoxarifado: reservadoAlmoxarifado,
      reservado_total: Number((restanteInicial - restante).toFixed(2)),
      restante
    };
  }

  static calcularCapacidadeMontagem(structureMap, stockMaps, idModeloServo) {
    const estrutura = structureMap.get(Number(idModeloServo)) || [];
    if (!estrutura.length) {
      return {
        capacidade: 0,
        componentes: []
      };
    }

    const componentes = estrutura.map((componente) => {
      const expedicaoDisponivel = Number(stockMaps.expedicao.get(componente.id_peca) || 0);
      const montagemDisponivel = Number(stockMaps.montagem.get(componente.id_peca) || 0);
      const almoxarifadoDisponivel = Number(stockMaps.almoxarifado.get(componente.id_peca) || 0);
      const totalDisponivel = expedicaoDisponivel + montagemDisponivel + almoxarifadoDisponivel;
      const capacidadeComponente = componente.quantidade > 0
        ? Math.floor(totalDisponivel / Number(componente.quantidade))
        : 0;

      return {
        ...componente,
        expedicao_disponivel: expedicaoDisponivel,
        montagem_disponivel: montagemDisponivel,
        almoxarifado_disponivel: almoxarifadoDisponivel,
        total_disponivel: totalDisponivel,
        capacidade_componente: capacidadeComponente
      };
    });

    const capacidade = componentes.length
      ? Math.max(0, Math.min(...componentes.map((componente) => Number(componente.capacidade_componente || 0))))
      : 0;

    return {
      capacidade,
      componentes
    };
  }

  static async buildAvailableSerialMap(idsModelo, connection = pool) {
    if (!idsModelo.length) {
      return new Map();
    }

    const placeholders = idsModelo.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `
        SELECT
          id_modelo_servo,
          COUNT(*) AS quantidade
        FROM submontagem_seriais
        WHERE id_modelo_servo IN (${placeholders})
          AND numero_pedido IS NULL
          AND data_saida IS NULL
        GROUP BY id_modelo_servo
      `,
      idsModelo
    );

    const map = new Map();
    idsModelo.forEach((idModelo) => {
      map.set(Number(idModelo), 0);
    });

    rows.forEach((row) => {
      map.set(Number(row.id_modelo_servo), Number(row.quantidade || 0));
    });

    return map;
  }

  static async getResumoKits(escopo = 'dia', db = pool) {
    await this.ensureSchema(db);

    const pedidos = await this.findAll({ ativos: true }, db);
    const pedidosFiltrados = String(escopo || 'dia').toLowerCase() === 'geral'
      ? pedidos.filter((pedido) => pedido.status !== STATUS.PEDIDO_COLETADO)
      : pedidos.filter((pedido) => pedido.status !== STATUS.PEDIDO_COLETADO && normalizeDateOnly(pedido.data_programacao_saida) === getTodayDateOnly());

    const kitsMap = new Map();

    pedidosFiltrados.forEach((pedido) => {
      (pedido.itens || []).forEach((item) => {
        if (item.separado_avulso) {
          return;
        }

        (item.componentes_avulsos || []).forEach((componente) => {
          const codigoComponente = String(componente.codigo || '').trim().toUpperCase();
          if (!codigoComponente.startsWith('KT-')) {
            return;
          }

          const quantidadeNecessaria = Number(
            (Number(item.quantidade || 0) * Number(componente.quantidade_por_item_venda || 0)).toFixed(2)
          );

          if (quantidadeNecessaria <= 0) {
            return;
          }

          const key = Number(componente.id_peca);
          const atual = kitsMap.get(key) || {
            id_peca: key,
            codigo: componente.codigo,
            descricao: componente.descricao,
            quantidade_requerida: 0,
            clientes: new Set(),
            codigos_origem: new Set()
          };

          atual.quantidade_requerida = Number((atual.quantidade_requerida + quantidadeNecessaria).toFixed(2));
          atual.clientes.add(pedido.cliente_nome || pedido.codigo_pedido || '-');
          if (item.codigo) {
            atual.codigos_origem.add(item.codigo);
          }
          kitsMap.set(key, atual);
        });
      });
    });

    const idsKits = [...kitsMap.keys()];
    const estoqueExpedicao = await this.buildStockMap(EstoqueModel.EXPEDICAO_NOME, idsKits, db);

    const kits = [...kitsMap.values()]
      .map((item) => {
        const quantidadeEmEstoque = Number(estoqueExpedicao.get(Number(item.id_peca)) || 0);
        const quantidadePendente = Math.max(0, Number((item.quantidade_requerida - quantidadeEmEstoque).toFixed(2)));

        return {
          id_peca: item.id_peca,
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade_requerida: item.quantidade_requerida,
          quantidade_em_estoque: quantidadeEmEstoque,
          quantidade_pendente: quantidadePendente,
          clientes: [...item.clientes].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')),
          codigos_origem: [...item.codigos_origem].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }))
        };
      })
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR'));

    return {
      escopo: String(escopo || 'dia').toLowerCase() === 'geral' ? 'geral' : 'dia',
      total_kits: kits.length,
      total_requerido: Number(kits.reduce((total, item) => total + Number(item.quantidade_requerida || 0), 0).toFixed(2)),
      total_estoque: Number(kits.reduce((total, item) => total + Number(item.quantidade_em_estoque || 0), 0).toFixed(2)),
      total_pendente: Number(kits.reduce((total, item) => total + Number(item.quantidade_pendente || 0), 0).toFixed(2)),
      kits
    };
  }

  static async registrarMontagemKit(idPeca, quantidade, usuarioId = null, db = pool) {
    await this.ensureSchema(db);

    const kitId = normalizeOptionalInteger(idPeca);
    const quantidadeMontada = Number(quantidade);

    if (!Number.isInteger(kitId)) {
      throw this.createBusinessError('O kit informado e invalido.');
    }

    if (!Number.isFinite(quantidadeMontada) || quantidadeMontada <= 0) {
      throw this.createBusinessError('Informe uma quantidade valida para o kit montado.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const peca = await this.findPecaById(kitId, connection);
      if (!peca) {
        throw this.createBusinessError('Kit nao encontrado.');
      }

      if (!String(peca.codigo || '').trim().toUpperCase().startsWith('KT-')) {
        throw this.createBusinessError('Apenas itens de kit podem ser registrados nesta tela.');
      }

      const estoqueExpedicao = await EstoqueModel.findStockByName(EstoqueModel.EXPEDICAO_NOME, connection);
      if (!estoqueExpedicao || Number(estoqueExpedicao.ativo) !== 1) {
        throw this.createBusinessError('O estoque da Expedicao nao esta disponivel.');
      }

      const estruturaMap = await this.buildStructureMap([kitId], connection);
      const componentesKit = estruturaMap.get(kitId) || [];

      if (!componentesKit.length) {
        throw this.createBusinessError(`O kit ${peca.codigo} nao possui componentes cadastrados na estrutura.`);
      }

      const faltantes = [];
      const componentesPlanejados = [];

      for (const componente of componentesKit) {
        const quantidadeConsumida = Number(
          (Number(componente.quantidade || 0) * quantidadeMontada).toFixed(2)
        );
        const saldoComponente = await EstoqueModel.findSaldoForUpdate(
          connection,
          estoqueExpedicao.id,
          componente.id_peca
        );
        const quantidadeDisponivel = saldoComponente ? Number(saldoComponente.quantidade) : 0;

        if (quantidadeConsumida > quantidadeDisponivel) {
          faltantes.push({
            id_peca: componente.id_peca,
            codigo: componente.codigo,
            descricao: componente.descricao,
            quantidade_necessaria: quantidadeConsumida,
            quantidade_disponivel: quantidadeDisponivel,
            quantidade_faltante: Number((quantidadeConsumida - quantidadeDisponivel).toFixed(2))
          });
          continue;
        }

        componentesPlanejados.push({
          ...componente,
          saldoAtual: saldoComponente,
          quantidade_disponivel: quantidadeDisponivel,
          quantidade_consumida: quantidadeConsumida
        });
      }

      if (faltantes.length > 0) {
        throw this.createBusinessError(
          `Nao ha componentes suficientes na Expedicao para montar o kit ${peca.codigo}.`,
          {
            tipo: 'FALTA_COMPONENTE_KIT',
            kit: {
              id: peca.id,
              codigo: peca.codigo,
              descricao: peca.descricao
            },
            faltantes
          }
        );
      }

      const componentesConsumidos = [];

      for (const componente of componentesPlanejados) {
        const novoSaldoComponente = Number(
          (componente.quantidade_disponivel - componente.quantidade_consumida).toFixed(2)
        );

        await EstoqueModel.persistSaldo(
          connection,
          estoqueExpedicao.id,
          componente.id_peca,
          novoSaldoComponente,
          componente.saldoAtual
        );

        await EstoqueModel.createMovimentacao(connection, {
          id_peca: componente.id_peca,
          id_estoque_origem: estoqueExpedicao.id,
          id_estoque_destino: null,
          tipo_movimentacao: 'SAIDA',
          quantidade: componente.quantidade_consumida,
          observacao: `Consumo de componente ${componente.codigo} para montagem do kit ${peca.codigo} na Expedicao.`.slice(0, 255)
        });

        componentesConsumidos.push({
          id_peca: componente.id_peca,
          codigo: componente.codigo,
          descricao: componente.descricao,
          quantidade_consumida: componente.quantidade_consumida,
          saldo_restante: novoSaldoComponente
        });
      }

      const saldoAtual = await EstoqueModel.findSaldoForUpdate(connection, estoqueExpedicao.id, kitId);
      const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
      const novoSaldo = Number((quantidadeAtual + quantidadeMontada).toFixed(2));

      await EstoqueModel.persistSaldo(connection, estoqueExpedicao.id, kitId, novoSaldo, saldoAtual);
      await EstoqueModel.createMovimentacao(connection, {
        id_peca: kitId,
        id_estoque_origem: null,
        id_estoque_destino: estoqueExpedicao.id,
        tipo_movimentacao: 'TRANSFERENCIA',
        quantidade: quantidadeMontada,
        observacao: `Entrada do kit ${peca.codigo} montado a partir do consumo de componentes na Expedicao.`
      });

      await connection.commit();

      return {
        id_peca: kitId,
        codigo: peca.codigo,
        descricao: peca.descricao,
        quantidade_registrada: quantidadeMontada,
        novo_saldo: novoSaldo,
        usuario_id: usuarioId || null,
        componentes_consumidos: componentesConsumidos
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static calcularStatus(order, itens) {
    if (order.data_coleta) {
      return STATUS.PEDIDO_COLETADO;
    }

    const itensCompletos = itens.length > 0 && itens.every((item) => item.concluido);
    const houveProgresso = itens.some((item) => (
      item.exige_numero_serie
        ? item.seriais_vinculados.length > 0
        : item.separado_avulso
    ));

    if (order.numero_nota_fiscal) {
      return STATUS.AGUARDANDO_TRANSPORTADORA;
    }

    if (!order.possui_nota_fiscal && itensCompletos) {
      return STATUS.AGUARDANDO_TRANSPORTADORA;
    }

    if (itensCompletos) {
      return STATUS.AGUARDANDO_NF;
    }

    if (houveProgresso) {
      return STATUS.EM_MONTAGEM;
    }

    return STATUS.AGUARDANDO_MONTAGEM;
  }

  static async hydratePedidos(pedidos, connection = pool) {
    if (!pedidos.length) {
      return [];
    }

    const pedidosMap = new Map();
    pedidos.forEach((pedido) => {
      pedidosMap.set(pedido.id, {
        ...pedido,
        itens: [],
        massa_total_kg: 0,
        total_itens: 0,
        itens_concluidos: 0,
        pode_atender: false,
        faltantes: []
      });
    });

    const pedidoIds = pedidos.map((pedido) => pedido.id);
    const itens = await this.fetchItensByPedidoIds(pedidoIds, connection);
    const composicoes = await ComposicaoVendaModel.findAll({
      ids_item_venda: [...new Set(itens.map((item) => item.id_peca))]
    }, connection);
    const itemIds = itens.map((item) => item.id);
    const seriais = await this.fetchSeriaisVinculadosByItemIds(itemIds, connection);
    const reservasAvulsas = await this.fetchReservasAvulsasByItemIds(itemIds, connection);
    const seriaisMap = new Map();
    const reservasAvulsasMap = new Map();

    seriais.forEach((serial) => {
      if (!seriaisMap.has(serial.id_pedido_item)) {
        seriaisMap.set(serial.id_pedido_item, []);
      }
      seriaisMap.get(serial.id_pedido_item).push(serial);
    });

    reservasAvulsas.forEach((reserva) => {
      if (!reservasAvulsasMap.has(reserva.id_pedido_item)) {
        reservasAvulsasMap.set(reserva.id_pedido_item, []);
      }
      reservasAvulsasMap.get(reserva.id_pedido_item).push(reserva);
    });

    const composicaoPorItemVenda = new Map();
    composicoes.forEach((linha) => {
      const idItemVenda = Number(linha.id_item_venda);
      if (!composicaoPorItemVenda.has(idItemVenda)) {
        composicaoPorItemVenda.set(idItemVenda, []);
      }
      composicaoPorItemVenda.get(idItemVenda).push(linha);
    });

    itens.forEach((item) => {
      const composicaoItem = composicaoPorItemVenda.get(Number(item.id_peca)) || [];
      const linhaSerial = composicaoItem.find((linha) => SubmontagemSerialModel.isEligibleModel(
        linha.item_atende_codigo,
        linha.item_atende_descricao
      ));
      const componenteSerialLocal = linhaSerial
        ? {
          id_peca: Number(linhaSerial.id_item_atende),
          codigo: linhaSerial.item_atende_codigo,
          descricao: linhaSerial.item_atende_descricao,
          quantidade_por_item_venda: Number(linhaSerial.quantidade || 1)
        }
        : (SubmontagemSerialModel.isEligibleModel(item.codigo, item.descricao)
          ? {
            id_peca: Number(item.id_peca),
            codigo: item.codigo,
            descricao: item.descricao,
            quantidade_por_item_venda: 1
          }
          : null);
      const componentesAvulsos = composicaoItem.length
        ? composicaoItem
          .filter((linha) => !linhaSerial || Number(linha.id_item_atende) !== Number(linhaSerial.id_item_atende))
          .map((linha) => ({
            id_peca: Number(linha.id_item_atende),
            codigo: linha.item_atende_codigo,
            descricao: linha.item_atende_descricao,
            quantidade_por_item_venda: Number(linha.quantidade || 0)
          }))
        : (componenteSerialLocal ? [] : [{
          id_peca: Number(item.id_peca),
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade_por_item_venda: 1
        }]);

      const itemHydrated = {
        ...item,
        seriais_vinculados: seriaisMap.get(item.id) || [],
        reservas_avulsas: reservasAvulsasMap.get(item.id) || [],
        composicao_venda: composicaoItem,
        componente_serial: componenteSerialLocal,
        componentes_avulsos: componentesAvulsos,
        exige_numero_serie: Boolean(componenteSerialLocal),
        exige_separacao_manual: componentesAvulsos.length > 0
      };
      const quantidadeSeriaisNecessarios = itemHydrated.componente_serial
        ? Math.max(1, Number(itemHydrated.quantidade || 0) * Number(itemHydrated.componente_serial.quantidade_por_item_venda || 1))
        : 0;
      itemHydrated.quantidade_seriais_necessarios = quantidadeSeriaisNecessarios;
      itemHydrated.concluido = (
        (!itemHydrated.exige_numero_serie || itemHydrated.seriais_vinculados.length >= quantidadeSeriaisNecessarios)
        && (!itemHydrated.exige_separacao_manual || itemHydrated.separado_avulso)
      );
      itemHydrated.massa_total_kg = Number(
        (normalizeDecimal(itemHydrated.massa_unitaria_kg) * Number(itemHydrated.quantidade || 0)).toFixed(3)
      );

      const pedido = pedidosMap.get(itemHydrated.id_pedido);
      if (pedido) {
        pedido.itens.push(itemHydrated);
      }
    });

    const activeOrders = [...pedidosMap.values()]
      .filter((pedido) => !pedido.data_coleta)
      .sort((a, b) => this.compareReservationPriority(a, b));

    const serialModelIds = [...new Set(
      [...pedidosMap.values()]
        .flatMap((pedido) => pedido.itens)
        .filter((item) => item.componente_serial)
        .map((item) => item.componente_serial.id_peca)
    )];
    const structureMap = await this.buildStructureMap(serialModelIds, connection);
    const idsPeca = [...new Set(
      [...pedidosMap.values()]
        .flatMap((pedido) => pedido.itens)
        .flatMap((item) => [
          ...item.componentes_avulsos.map((componente) => componente.id_peca),
          ...(item.componente_serial ? [item.componente_serial.id_peca] : []),
          ...((structureMap.get(Number(item.componente_serial?.id_peca || 0)) || []).map((componente) => componente.id_peca))
        ])
    )];
    const [expedicaoMap, montagemMap, almoxarifadoMap, serialMap] = await Promise.all([
      this.buildStockMap(EstoqueModel.EXPEDICAO_NOME, idsPeca, connection),
      this.buildStockMap(EstoqueModel.MONTAGEM_NOME, idsPeca, connection),
      this.buildStockMap(EstoqueModel.ALMOXARIFADO_NOME, idsPeca, connection),
      this.buildAvailableSerialMap(serialModelIds, connection)
    ]);
    const stockMaps = {
      expedicao: expedicaoMap,
      montagem: montagemMap,
      almoxarifado: almoxarifadoMap
    };

    activeOrders.forEach((pedido) => {
      pedido.faltantes = [];

      pedido.itens.forEach((item) => {
        const quantidade = Number(item.quantidade || 0);

        if (item.exige_numero_serie) {
          const vinculados = item.seriais_vinculados.length;
          const quantidadeNecessaria = Number(item.quantidade_seriais_necessarios || quantidade);
          const disponiveis = Number(serialMap.get(item.componente_serial.id_peca) || 0);
          const faltanteAposVinculos = Math.max(0, quantidadeNecessaria - vinculados);
          const reservaSeriaisProntos = Math.min(disponiveis, faltanteAposVinculos);
          const restanteParaMontar = Math.max(0, faltanteAposVinculos - reservaSeriaisProntos);
          const diagnosticoMontagem = this.calcularCapacidadeMontagem(
            structureMap,
            stockMaps,
            item.componente_serial.id_peca
          );
          const capacidadeMontagem = Number(diagnosticoMontagem.capacidade || 0);
          const reservaMontagem = Math.min(capacidadeMontagem, restanteParaMontar);
          const totalParaEstePedido = vinculados + disponiveis + capacidadeMontagem;
          const falta = Math.max(0, quantidadeNecessaria - totalParaEstePedido);
          const componentesFaltantes = restanteParaMontar > 0
            ? diagnosticoMontagem.componentes
              .map((componente) => {
                const quantidadeNecessariaComponente = Number(
                  (Number(componente.quantidade || 0) * restanteParaMontar).toFixed(2)
                );
                const quantidadeFaltanteComponente = Number(
                  Math.max(0, quantidadeNecessariaComponente - Number(componente.total_disponivel || 0)).toFixed(2)
                );

                return {
                  id_peca: componente.id_peca,
                  codigo: componente.codigo,
                  descricao: componente.descricao,
                  quantidade_por_submontagem: Number(componente.quantidade || 0),
                  quantidade_necessaria: quantidadeNecessariaComponente,
                  quantidade_disponivel: Number(componente.total_disponivel || 0),
                  quantidade_faltante: quantidadeFaltanteComponente,
                  expedicao_disponivel: Number(componente.expedicao_disponivel || 0),
                  montagem_disponivel: Number(componente.montagem_disponivel || 0),
                  almoxarifado_disponivel: Number(componente.almoxarifado_disponivel || 0)
                };
              })
              .filter((componente) => componente.quantidade_faltante > 0)
            : [];

          item.quantidade_possivel = Math.min(quantidadeNecessaria, totalParaEstePedido);
          item.diagnostico = {
            tipo: 'NUMERO_SERIE',
            modelo_serial_codigo: item.componente_serial.codigo,
            modelo_serial_descricao: item.componente_serial.descricao,
            vinculados,
            disponiveis,
            capacidade_montagem: capacidadeMontagem,
            componentes_montagem: diagnosticoMontagem.componentes,
            componentes_faltantes: componentesFaltantes,
            total_para_este_pedido: totalParaEstePedido,
            falta
          };

          serialMap.set(item.componente_serial.id_peca, Math.max(0, disponiveis - reservaSeriaisProntos));

          if (reservaMontagem > 0) {
            (structureMap.get(Number(item.componente_serial.id_peca)) || []).forEach((componente) => {
              const quantidadeComponente = Number((Number(componente.quantidade || 0) * reservaMontagem).toFixed(2));
              this.reserveAcrossStocks(stockMaps, componente.id_peca, quantidadeComponente);
            });
          }

          if (falta > 0) {
            pedido.faltantes.push({
              id_item: item.id,
              id_peca: item.id_peca,
              codigo: item.componente_serial.codigo,
              descricao: item.componente_serial.descricao,
              tipo: 'NUMERO_SERIE',
              quantidade_solicitada: quantidadeNecessaria,
              quantidade_disponivel: totalParaEstePedido,
              quantidade_faltante: falta,
              componentes_faltantes: componentesFaltantes,
              mensagem: `Faltam ${falta} unidade(s) de material/serial para ${item.componente_serial.codigo}.`
            });
          }
        }

        const diagnosticoAvulsos = [];
        const reservasAvulsasPorPeca = new Map();
        (item.reservas_avulsas || []).forEach((reserva) => {
          const idPeca = Number(reserva.id_peca);
          const quantidadeAtual = Number(reservasAvulsasPorPeca.get(idPeca) || 0);
          reservasAvulsasPorPeca.set(idPeca, Number((quantidadeAtual + Number(reserva.quantidade || 0)).toFixed(2)));
        });

        for (const componente of item.componentes_avulsos) {
          const quantidadeNecessaria = Number((quantidade * Number(componente.quantidade_por_item_venda || 0)).toFixed(2));
          const quantidadeReservada = Math.min(
            quantidadeNecessaria,
            Number(reservasAvulsasPorPeca.get(Number(componente.id_peca)) || 0)
          );
          const quantidadePendente = Number((quantidadeNecessaria - quantidadeReservada).toFixed(2));
          const expedicaoDisponivel = Number(expedicaoMap.get(componente.id_peca) || 0);
          const montagemDisponivel = Number(montagemMap.get(componente.id_peca) || 0);
          const almoxarifadoDisponivel = Number(almoxarifadoMap.get(componente.id_peca) || 0);
          const totalParaEstePedido = quantidadeReservada + expedicaoDisponivel + montagemDisponivel + almoxarifadoDisponivel;
          const falta = Math.max(0, quantidadeNecessaria - totalParaEstePedido);
          this.reserveAcrossStocks(stockMaps, componente.id_peca, quantidadePendente);

          diagnosticoAvulsos.push({
            id_peca: componente.id_peca,
            codigo: componente.codigo,
            descricao: componente.descricao,
            quantidade_necessaria: quantidadeNecessaria,
            quantidade_reservada_pedido: quantidadeReservada,
            expedicao_disponivel: expedicaoDisponivel,
            montagem_disponivel: montagemDisponivel,
            almoxarifado_disponivel: almoxarifadoDisponivel,
            total_para_este_pedido: totalParaEstePedido,
            falta
          });

          if (falta > 0) {
            pedido.faltantes.push({
              id_item: item.id,
              id_peca: componente.id_peca,
              codigo: componente.codigo,
              descricao: componente.descricao,
              tipo: 'AVULSO',
              quantidade_solicitada: quantidadeNecessaria,
              expedicao_disponivel: expedicaoDisponivel,
              montagem_disponivel: montagemDisponivel,
              almoxarifado_disponivel: almoxarifadoDisponivel,
              quantidade_disponivel: totalParaEstePedido,
              quantidade_faltante: falta,
              mensagem: `Faltam ${falta} peca(s) de ${componente.codigo}.`
            });
          }
        }

        item.diagnostico_avulsos = diagnosticoAvulsos;
        item.diagnostico = item.diagnostico || {};
        item.diagnostico.avulsos = diagnosticoAvulsos;
        item.pode_atender = (
          (!item.exige_numero_serie || item.diagnostico.falta <= 0)
          && diagnosticoAvulsos.every((componente) => componente.falta <= 0)
        );
      });
    });

    return [...pedidosMap.values()].map((pedido) => {
      const itensConcluidos = pedido.itens.filter((item) => item.concluido).length;
      const massaTotal = pedido.itens.reduce((total, item) => total + Number(item.massa_total_kg || 0), 0);
      const statusCalculado = this.calcularStatus(pedido, pedido.itens);

      return {
        ...pedido,
        status: statusCalculado,
        massa_total_calculada_kg: Number(massaTotal.toFixed(3)),
        massa_total_kg: pedido.peso_total_override_kg === null || pedido.peso_total_override_kg === undefined
          ? Number(massaTotal.toFixed(3))
          : Number(pedido.peso_total_override_kg),
        total_itens: pedido.itens.length,
        itens_concluidos: itensConcluidos,
        pode_atender: pedido.data_coleta ? true : pedido.faltantes.length === 0,
        faltantes: pedido.faltantes
      };
    });
  }

  static async findAll(filters = {}, connection = pool) {
    const pedidos = await this.fetchPedidos(filters, connection);
    return this.hydratePedidos(pedidos, connection);
  }

  static async findById(id, connection = pool) {
    const pedidos = await this.fetchPedidos({ id }, connection);
    const [pedido] = await this.hydratePedidos(pedidos, connection);
    return pedido || null;
  }

  static async recalculateStatus(connection, pedidoId, usuarioId = null) {
    const pedido = await this.findById(pedidoId, connection);
    if (!pedido) {
      return null;
    }

    const status = this.calcularStatus(pedido, pedido.itens);

    await connection.query(
      `
        UPDATE pedidos_expedicao
        SET
          status = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [status, usuarioId, pedidoId]
    );

    return status;
  }

  static async hasSaidaColetaRegistrada(connection, pedido) {
    if (!pedido?.codigo_pedido) {
      return false;
    }

    await ExpedicaoSaidaModel.ensureSchema(connection);

    const [rows] = await connection.query(
      `
        SELECT id
        FROM expedicao_saidas
        WHERE tipo_saida = 'VENDA'
          AND observacao LIKE ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [`Pedido ${pedido.codigo_pedido}%`]
    );

    return rows.length > 0;
  }

  static async reabrirColeta(idPedido, usuarioId = null, db = pool) {
    await this.ensureSchema(db);

    const pedidoId = normalizeOptionalInteger(idPedido);
    if (!Number.isInteger(pedidoId)) {
      throw this.createBusinessError('O pedido informado e invalido.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const pedido = await this.findById(pedidoId, connection);
      if (!pedido) {
        throw this.createBusinessError('Pedido nao encontrado.');
      }

      if (pedido.status !== STATUS.PEDIDO_COLETADO && !pedido.data_coleta) {
        throw this.createBusinessError('Este pedido nao esta marcado como coletado.');
      }

      const statusReaberto = this.calcularStatus({ ...pedido, data_coleta: null }, pedido.itens);

      await connection.query(
        `
          UPDATE pedidos_expedicao
          SET
            data_coleta = NULL,
            status = ?,
            updated_by = ?
          WHERE id = ?
        `,
        [statusReaberto, usuarioId, pedidoId]
      );

      await connection.commit();
      return this.findById(pedidoId, connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updatePrioridades(orderIds = [], usuarioId = null, db = pool) {
    await this.ensureSchema(db);

    if (!Array.isArray(orderIds) || !orderIds.length) {
      throw this.createBusinessError('Informe ao menos um pedido para reorganizar.');
    }

    const ids = orderIds
      .map((value) => normalizeOptionalInteger(value))
      .filter((value) => Number.isInteger(value));

    if (!ids.length) {
      throw this.createBusinessError('Nenhum pedido valido foi informado para reorganizar.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      for (let index = 0; index < ids.length; index += 1) {
        await connection.query(
          `
            UPDATE pedidos_expedicao
            SET
              prioridade_ordem = ?,
              updated_by = ?
            WHERE id = ?
              AND data_coleta IS NULL
          `,
          [index + 1, usuarioId, ids[index]]
        );
      }

      await connection.commit();
      return this.findAll({}, connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateItemSeparado(idPedidoItem, separado, usuarioId = null, db = pool) {
    await this.ensureSchema(db);

    const itemId = normalizeOptionalInteger(idPedidoItem);
    if (!Number.isInteger(itemId)) {
      throw this.createBusinessError('O item do pedido informado e invalido.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `
          SELECT *
          FROM pedido_expedicao_itens
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [itemId]
      );

      const item = rows[0] || null;
      if (!item) {
        throw this.createBusinessError('Item do pedido nao encontrado.');
      }

      const pedido = await this.findById(Number(item.id_pedido), connection);
      const itemHydrated = pedido?.itens?.find((entry) => Number(entry.id) === Number(item.id));
      if (!pedido || !itemHydrated) {
        throw this.createBusinessError('Pedido nao encontrado para validar a separacao.');
      }

      if (pedido.status === STATUS.PEDIDO_COLETADO) {
        throw this.createBusinessError('Nao e possivel alterar um item de pedido que ja foi coletado.');
      }

      if (separado && !itemHydrated.exige_separacao_manual) {
        throw this.createBusinessError('Este item nao exige separacao manual.');
      }

      const reservasAtuais = await this.fetchReservasAvulsasByItemIds([itemId], connection);

      if (separado && reservasAtuais.length === 0) {
        await this.reserveAvulsoComponentsInTransaction(connection, pedido, itemHydrated);
      } else if (!separado && reservasAtuais.length > 0) {
        await this.releaseAvulsoReservationsInTransaction(connection, itemId, pedido.codigo_pedido);
      }

      await connection.query(
        `
          UPDATE pedido_expedicao_itens
          SET
            separado_avulso = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [separado ? 1 : 0, itemId]
      );

      await this.recalculateStatus(connection, Number(item.id_pedido), usuarioId);
      await connection.commit();

      return this.findById(Number(item.id_pedido), connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateNotaFiscal(idPedido, numeroNotaFiscal, usuarioId = null, db = pool) {
    await this.ensureSchema(db);

    const pedidoId = normalizeOptionalInteger(idPedido);
    if (!Number.isInteger(pedidoId)) {
      throw this.createBusinessError('O pedido informado e invalido.');
    }

    const nota = String(numeroNotaFiscal || '').trim();
    if (!nota) {
      throw this.createBusinessError('Informe o numero da nota fiscal.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const pedido = await this.findById(pedidoId, connection);
      if (!pedido) {
        throw this.createBusinessError('Pedido nao encontrado.');
      }

      if (!pedido.itens.length || pedido.itens.some((item) => !item.concluido)) {
        throw this.createBusinessError('Finalize a montagem e a separacao de todos os itens antes de informar a nota fiscal.');
      }

      await connection.query(
        `
          UPDATE pedidos_expedicao
          SET
            numero_nota_fiscal = ?,
            updated_by = ?
          WHERE id = ?
        `,
        [nota, usuarioId, pedidoId]
      );

      await this.recalculateStatus(connection, pedidoId, usuarioId);
      await connection.commit();

      return this.findById(pedidoId, connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateDadosFinais(idPedido, data = {}, usuarioId = null, db = pool) {
    await this.ensureSchema(db);

    const pedidoId = normalizeOptionalInteger(idPedido);
    if (!Number.isInteger(pedidoId)) {
      throw this.createBusinessError('O pedido informado e invalido.');
    }

    const numeroNotaFiscal = data.numero_nota_fiscal === undefined
      ? undefined
      : (String(data.numero_nota_fiscal || '').trim() || null);
    const pesoTotalOverrideKg = data.peso_total_override_kg === undefined
      ? undefined
      : normalizeOptionalDecimal(data.peso_total_override_kg);
    const quantidadeVolumes = data.quantidade_volumes === undefined
      ? undefined
      : normalizeOptionalInteger(data.quantidade_volumes);

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const pedido = await this.findById(pedidoId, connection);
      if (!pedido) {
        throw this.createBusinessError('Pedido nao encontrado.');
      }

      if (pedido.status === STATUS.PEDIDO_COLETADO) {
        throw this.createBusinessError('Nao e possivel alterar os dados finais de um pedido que ja foi coletado.');
      }

      if (numeroNotaFiscal && (!pedido.itens.length || pedido.itens.some((item) => !item.concluido))) {
        throw this.createBusinessError('Finalize a montagem e a separacao de todos os itens antes de informar a nota fiscal.');
      }

      await connection.query(
        `
          UPDATE pedidos_expedicao
          SET
            numero_nota_fiscal = COALESCE(?, numero_nota_fiscal),
            peso_total_override_kg = COALESCE(?, peso_total_override_kg),
            quantidade_volumes = COALESCE(?, quantidade_volumes),
            updated_by = ?
          WHERE id = ?
        `,
        [
          numeroNotaFiscal,
          pesoTotalOverrideKg,
          quantidadeVolumes,
          usuarioId,
          pedidoId
        ]
      );

      if (data.numero_nota_fiscal !== undefined && numeroNotaFiscal === null) {
        await connection.query(
          `
            UPDATE pedidos_expedicao
            SET
              numero_nota_fiscal = NULL,
              updated_by = ?
            WHERE id = ?
          `,
          [usuarioId, pedidoId]
        );
      }

      if (data.peso_total_override_kg !== undefined && pesoTotalOverrideKg === null) {
        await connection.query(
          `
            UPDATE pedidos_expedicao
            SET
              peso_total_override_kg = NULL,
              updated_by = ?
            WHERE id = ?
          `,
          [usuarioId, pedidoId]
        );
      }

      if (data.quantidade_volumes !== undefined && quantidadeVolumes === null) {
        await connection.query(
          `
            UPDATE pedidos_expedicao
            SET
              quantidade_volumes = NULL,
              updated_by = ?
            WHERE id = ?
          `,
          [usuarioId, pedidoId]
        );
      }

      await this.recalculateStatus(connection, pedidoId, usuarioId);
      await connection.commit();

      return this.findById(pedidoId, connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateProgramacaoHoje(idPedido, programadoHoje, usuarioId = null, db = pool) {
    await this.ensureSchema(db);

    const pedidoId = normalizeOptionalInteger(idPedido);
    if (!Number.isInteger(pedidoId)) {
      throw this.createBusinessError('O pedido informado e invalido.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const pedido = await this.findById(pedidoId, connection);
      if (!pedido) {
        throw this.createBusinessError('Pedido nao encontrado.');
      }

      if (pedido.status === STATUS.PEDIDO_COLETADO) {
        throw this.createBusinessError('Nao e possivel mover um pedido coletado para a programacao do dia.');
      }

      const dataProgramacao = programadoHoje ? getTodayDateOnly() : null;

      await connection.query(
        `
          UPDATE pedidos_expedicao
          SET
            data_programacao_saida = ?,
            updated_by = ?
          WHERE id = ?
        `,
        [dataProgramacao, usuarioId, pedidoId]
      );

      await connection.commit();
      return this.findById(pedidoId, connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getItemById(idPedidoItem, connection = pool) {
    const itemId = normalizeOptionalInteger(idPedidoItem);
    if (!Number.isInteger(itemId)) {
      return null;
    }

    const [rows] = await connection.query(
      `
        SELECT *
        FROM pedido_expedicao_itens
        WHERE id = ?
        LIMIT 1
      `,
      [itemId]
    );

    return rows[0] || null;
  }

  static async getAvailableSeriaisForItem(idPedidoItem, connection = pool) {
    await this.ensureSchema(connection);

    const item = await this.getItemById(idPedidoItem, connection);
    if (!item) {
      throw this.createBusinessError('Item do pedido nao encontrado.');
    }

    const pedido = await this.findById(Number(item.id_pedido), connection);
    if (!pedido) {
      throw this.createBusinessError('Pedido nao encontrado.');
    }

    const itemHydrated = pedido.itens.find((entry) => Number(entry.id) === Number(item.id));
    if (!itemHydrated || !itemHydrated.exige_numero_serie || !itemHydrated.componente_serial) {
      throw this.createBusinessError('Este item nao exige numero de serie.');
    }

    const [disponiveisRows, vinculadosRows] = await Promise.all([
      connection.query(
        `
          SELECT *
          FROM submontagem_seriais
          WHERE id_modelo_servo = ?
            AND numero_pedido IS NULL
            AND data_saida IS NULL
          ORDER BY numero_sequencial ASC
        `,
        [itemHydrated.componente_serial.id_peca]
      ),
      connection.query(
        `
          SELECT
            pis.id,
            pis.id_submontagem_serial,
            pis.numero_serie,
            pis.created_at
          FROM pedido_expedicao_item_seriais pis
          WHERE pis.id_pedido_item = ?
          ORDER BY pis.id ASC
        `,
        [idPedidoItem]
      )
    ]);

    const [disponiveis] = disponiveisRows;
    const [vinculados] = vinculadosRows;

    return {
      item: {
        id: Number(item.id),
        id_pedido: Number(item.id_pedido),
        id_peca: Number(item.id_peca),
        codigo: item.codigo,
        descricao: item.descricao,
        quantidade: Number(item.quantidade),
        quantidade_seriais_vinculados: vinculados.length,
        quantidade_seriais_necessarios: Number(itemHydrated.quantidade_seriais_necessarios || item.quantidade),
        modelo_serial_codigo: itemHydrated.componente_serial.codigo,
        modelo_serial_descricao: itemHydrated.componente_serial.descricao
      },
      disponiveis: disponiveis.map((row) => SubmontagemSerialModel.mapRow(row)),
      vinculados: vinculados.map((row) => ({
        id: Number(row.id),
        id_submontagem_serial: Number(row.id_submontagem_serial),
        numero_serie: row.numero_serie,
        created_at: row.created_at || null
      }))
    };
  }

  static async vincularSeriais(idPedidoItem, serialIds = [], usuarioId = null, db = pool) {
    await this.ensureSchema(db);

    const itemId = normalizeOptionalInteger(idPedidoItem);
    if (!Number.isInteger(itemId)) {
      throw this.createBusinessError('O item do pedido informado e invalido.');
    }

    const idsSeriais = [...new Set(
      (Array.isArray(serialIds) ? serialIds : [])
        .map((value) => normalizeOptionalInteger(value))
        .filter((value) => Number.isInteger(value))
    )];

    if (!idsSeriais.length) {
      throw this.createBusinessError('Selecione ao menos um numero de serie para vincular.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const item = await this.getItemById(itemId, connection);
      if (!item) {
        throw this.createBusinessError('Item do pedido nao encontrado.');
      }

      if (Number(item.exige_numero_serie || 0) !== 1) {
        const pedidoHydrated = await this.findById(Number(item.id_pedido), connection);
        const hydrated = pedidoHydrated?.itens?.find((entry) => Number(entry.id) === Number(item.id));
        if (!hydrated || !hydrated.exige_numero_serie || !hydrated.componente_serial) {
          throw this.createBusinessError('Este item nao exige numero de serie.');
        }
      }

      const pedidoHydrated = await this.findById(Number(item.id_pedido), connection);
      const hydratedItem = pedidoHydrated?.itens?.find((entry) => Number(entry.id) === Number(item.id));
      if (!hydratedItem || !hydratedItem.exige_numero_serie || !hydratedItem.componente_serial) {
        throw this.createBusinessError('Este item nao exige numero de serie.');
      }

      if (!pedidoHydrated) {
        throw this.createBusinessError('Pedido nao encontrado.');
      }

      const estoqueExpedicao = await EstoqueModel.findStockByName(EstoqueModel.EXPEDICAO_NOME, connection);
      if (!estoqueExpedicao || Number(estoqueExpedicao.ativo) !== 1) {
        throw this.createBusinessError('O estoque da Expedicao nao esta disponivel para reservar os numeros de serie.');
      }

      const [vinculadosRows] = await connection.query(
        `
          SELECT COUNT(*) AS quantidade
          FROM pedido_expedicao_item_seriais
          WHERE id_pedido_item = ?
        `,
        [itemId]
      );
      const jaVinculados = Number(vinculadosRows[0]?.quantidade || 0);

      if (jaVinculados + idsSeriais.length > Number(hydratedItem.quantidade_seriais_necessarios || item.quantidade || 0)) {
        throw this.createBusinessError('A quantidade selecionada ultrapassa o necessario para este item.');
      }

      const placeholders = idsSeriais.map(() => '?').join(', ');
      const [serialRows] = await connection.query(
        `
          SELECT *
          FROM submontagem_seriais
          WHERE id IN (${placeholders})
          FOR UPDATE
        `,
        idsSeriais
      );

      if (serialRows.length !== idsSeriais.length) {
        throw this.createBusinessError('Um dos numeros de serie selecionados nao foi encontrado.');
      }

      for (const row of serialRows) {
        const serial = SubmontagemSerialModel.mapRow(row);

        if (Number(serial.id_modelo_servo) !== Number(hydratedItem.componente_serial.id_peca)) {
          throw this.createBusinessError(`O numero de serie ${serial.numero_serie} nao pertence ao modelo ${hydratedItem.componente_serial.codigo}.`);
        }

        if (serial.data_saida) {
          throw this.createBusinessError(`O numero de serie ${serial.numero_serie} ja saiu em outro pedido.`);
        }

        if (serial.numero_pedido) {
          throw this.createBusinessError(`O numero de serie ${serial.numero_serie} ja esta vinculado ao pedido ${serial.numero_pedido}.`);
        }

        await connection.query(
          `
            INSERT INTO pedido_expedicao_item_seriais (
              id_pedido_item,
              id_submontagem_serial,
              numero_serie
            ) VALUES (?, ?, ?)
          `,
          [itemId, serial.id, serial.numero_serie]
        );

        await connection.query(
          `
            UPDATE submontagem_seriais
            SET numero_pedido = ?
            WHERE id = ?
          `,
          [pedidoHydrated.codigo_pedido, serial.id]
        );

        const saldoExpedicao = await EstoqueModel.findSaldoForUpdate(
          connection,
          estoqueExpedicao.id,
          Number(serial.id_modelo_servo)
        );
        const quantidadeDisponivel = saldoExpedicao ? Number(saldoExpedicao.quantidade) : 0;

        if (quantidadeDisponivel < 1) {
          throw this.createBusinessError(`Saldo insuficiente na Expedicao para reservar o numero de serie ${serial.numero_serie}.`);
        }

        await EstoqueModel.persistSaldo(
          connection,
          estoqueExpedicao.id,
          Number(serial.id_modelo_servo),
          Number((quantidadeDisponivel - 1).toFixed(2)),
          saldoExpedicao
        );

        await EstoqueModel.createMovimentacao(connection, {
          id_peca: Number(serial.id_modelo_servo),
          id_estoque_origem: estoqueExpedicao.id,
          id_estoque_destino: null,
          tipo_movimentacao: 'AJUSTE',
          quantidade: 1,
          observacao: `Reserva do numero de serie ${serial.numero_serie} para o pedido ${pedidoHydrated.codigo_pedido}.`.slice(0, 255)
        });
      }

      await this.recalculateStatus(connection, Number(item.id_pedido), usuarioId);
      await connection.commit();

      return this.findById(Number(item.id_pedido), connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async desvincularSerial(idVinculo, usuarioId = null, db = pool) {
    await this.ensureSchema(db);

    const bindingId = normalizeOptionalInteger(idVinculo);
    if (!Number.isInteger(bindingId)) {
      throw this.createBusinessError('O vinculo informado e invalido.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `
          SELECT
            pis.*,
            i.id_pedido
          FROM pedido_expedicao_item_seriais pis
          INNER JOIN pedido_expedicao_itens i ON i.id = pis.id_pedido_item
          WHERE pis.id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [bindingId]
      );

      const vinculo = rows[0] || null;
      if (!vinculo) {
        throw this.createBusinessError('Vinculo de numero de serie nao encontrado.');
      }

      const pedido = await this.findById(Number(vinculo.id_pedido), connection);
      if (!pedido) {
        throw this.createBusinessError('Pedido nao encontrado.');
      }

      await this.releaseSerialBindingInTransaction(connection, bindingId);

      await this.recalculateStatus(connection, Number(vinculo.id_pedido), usuarioId);
      await connection.commit();

      return this.findById(Number(vinculo.id_pedido), connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async marcarColetado(idPedido, usuario = null, db = pool) {
    await this.ensureSchema(db);

    const pedidoId = normalizeOptionalInteger(idPedido);
    if (!Number.isInteger(pedidoId)) {
      throw this.createBusinessError('O pedido informado e invalido.');
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const pedido = await this.findById(pedidoId, connection);
      if (!pedido) {
        throw this.createBusinessError('Pedido nao encontrado.');
      }

      if (pedido.possui_nota_fiscal && !pedido.numero_nota_fiscal) {
        throw this.createBusinessError('Informe o numero da nota fiscal antes de coletar o pedido.');
      }

      if (!Number.isInteger(pedido.quantidade_volumes) || Number(pedido.quantidade_volumes) <= 0) {
        throw this.createBusinessError('Informe a quantidade de volumes antes de coletar o pedido.');
      }

      if (pedido.itens.some((item) => !item.concluido)) {
        throw this.createBusinessError('Finalize todos os itens do pedido antes da coleta.');
      }

      const estoqueExpedicao = await EstoqueModel.findStockByName(EstoqueModel.EXPEDICAO_NOME, connection);
      if (!estoqueExpedicao || Number(estoqueExpedicao.ativo) !== 1) {
        throw this.createBusinessError('O estoque da Expedicao nao esta disponivel para a baixa final do pedido.');
      }

      const actor = usuario && typeof usuario === 'object'
        ? {
          id: usuario.id ?? null,
          login: usuario.login || null,
          nome: usuario.nome || null
        }
        : {
          id: Number.isInteger(usuario) ? usuario : null,
          login: null,
          nome: null
        };

      const coletaSaidaJaRegistrada = await this.hasSaidaColetaRegistrada(connection, pedido);
      const solicitacoesSaida = [];
      const movimentosSaida = [];
      const observacaoSaidaBase = [
        `Pedido ${pedido.codigo_pedido}`,
        pedido.cliente_nome ? `Cliente ${pedido.cliente_nome}` : '',
        pedido.transportadora ? `Transportadora ${pedido.transportadora}` : '',
        pedido.numero_nota_fiscal ? `NF ${pedido.numero_nota_fiscal}` : ''
      ].filter(Boolean).join(' | ').slice(0, 255);

      if (!coletaSaidaJaRegistrada) {
        for (const item of pedido.itens) {
        const componentesBaixa = [];
        const solicitacaoRef = Number(item.id);
        const ehComposicaoVenda = Array.isArray(item.composicao_venda) && item.composicao_venda.length > 0;
        const reservasAvulsasPorPeca = new Map();

        (item.reservas_avulsas || []).forEach((reserva) => {
          const idPeca = Number(reserva.id_peca);
          const quantidadeAtual = Number(reservasAvulsasPorPeca.get(idPeca) || 0);
          reservasAvulsasPorPeca.set(idPeca, Number((quantidadeAtual + Number(reserva.quantidade || 0)).toFixed(2)));
        });

        solicitacoesSaida.push({
          solicitacao_ref: solicitacaoRef,
          id_peca: Number(item.id_peca),
          codigo: item.codigo,
          descricao: item.descricao,
          classificacao: item.classificacao,
          quantidade_solicitada: Number(item.quantidade || 0),
          quantidade_submontagem_pronta: item.exige_numero_serie ? Number(item.quantidade || 0) : 0,
          quantidade_composicao_venda: ehComposicaoVenda ? Number(item.quantidade || 0) : 0,
          quantidade_componentes: item.exige_separacao_manual ? Number(item.quantidade || 0) : 0
        });

        if (item.componente_serial) {
          componentesBaixa.push({
            id_peca: Number(item.componente_serial.id_peca),
            codigo: item.componente_serial.codigo,
            descricao: item.componente_serial.descricao,
            quantidade: Number(item.quantidade_seriais_necessarios || 0),
            somente_expedicao: false,
            baixa_ja_reservada: true,
            forma_atendimento: ehComposicaoVenda ? 'COMPOSICAO_VENDA' : 'PRONTO',
            solicitacao_ref: solicitacaoRef,
            observacao: `Coleta do pedido ${pedido.codigo_pedido}: confirmacao de venda do modelo serial ${item.componente_serial.codigo}.`
          });
        }

        for (const componente of item.componentes_avulsos || []) {
          const quantidadeTotal = Number((Number(item.quantidade || 0) * Number(componente.quantidade_por_item_venda || 0)).toFixed(2));
          const quantidadeReservada = Math.min(
            quantidadeTotal,
            Number(reservasAvulsasPorPeca.get(Number(componente.id_peca)) || 0)
          );
          const quantidadePendente = Number((quantidadeTotal - quantidadeReservada).toFixed(2));

          if (quantidadeReservada > 0) {
            componentesBaixa.push({
              id_peca: Number(componente.id_peca),
              codigo: componente.codigo,
              descricao: componente.descricao,
              quantidade: quantidadeReservada,
              somente_expedicao: false,
              baixa_ja_reservada: true,
              forma_atendimento: ehComposicaoVenda ? 'COMPOSICAO_VENDA' : 'PRONTO',
              solicitacao_ref: solicitacaoRef,
              observacao: `Coleta do pedido ${pedido.codigo_pedido}: confirmacao de item reservado ${componente.codigo}.`
            });
          }

          if (quantidadePendente <= 0) {
            continue;
          }

          componentesBaixa.push({
            id_peca: Number(componente.id_peca),
            codigo: componente.codigo,
            descricao: componente.descricao,
            quantidade: quantidadePendente,
            somente_expedicao: false,
            forma_atendimento: ehComposicaoVenda ? 'COMPOSICAO_VENDA' : 'PRONTO',
            solicitacao_ref: solicitacaoRef,
            observacao: `Coleta do pedido ${pedido.codigo_pedido}: baixa do componente ${componente.codigo}.`
          });
        }

        for (const componente of componentesBaixa) {
          if (componente.quantidade <= 0) {
            continue;
          }

          const observacaoBase = `${componente.observacao} Cliente ${pedido.cliente_nome}.`.slice(0, 255);
          if (componente.baixa_ja_reservada) {
            movimentosSaida.push({
              id_peca: componente.id_peca,
              quantidade: componente.quantidade,
              observacao: observacaoBase,
              solicitacao_ref: componente.solicitacao_ref,
              id_peca_solicitada: Number(item.id_peca),
              forma_atendimento: componente.forma_atendimento,
              id_movimentacao_estoque: null
            });
            continue;
          }

          const saldoExpedicao = await EstoqueModel.findSaldoForUpdate(connection, estoqueExpedicao.id, componente.id_peca);
          const quantidadeExpedicao = saldoExpedicao ? Number(saldoExpedicao.quantidade) : 0;

          if (componente.quantidade > quantidadeExpedicao) {
            throw this.createBusinessError(`Saldo insuficiente na Expedicao para baixar ${componente.codigo} na coleta do pedido ${pedido.codigo_pedido}.`);
          }

          const novoSaldoExpedicao = Number((quantidadeExpedicao - componente.quantidade).toFixed(2));
          await EstoqueModel.persistSaldo(
            connection,
            estoqueExpedicao.id,
            componente.id_peca,
            novoSaldoExpedicao,
            saldoExpedicao
          );

          const idMovimentacao = await EstoqueModel.createMovimentacao(connection, {
            id_peca: componente.id_peca,
            id_estoque_origem: estoqueExpedicao.id,
            id_estoque_destino: null,
            tipo_movimentacao: 'SAIDA',
            quantidade: componente.quantidade,
            observacao: observacaoBase
          });

          movimentosSaida.push({
            id_peca: componente.id_peca,
            quantidade: componente.quantidade,
            observacao: observacaoBase,
            solicitacao_ref: componente.solicitacao_ref,
            id_peca_solicitada: Number(item.id_peca),
            forma_atendimento: componente.forma_atendimento,
            id_movimentacao_estoque: idMovimentacao
          });
        }

        if (item.exige_numero_serie && item.seriais_vinculados.length) {
          const serialIds = item.seriais_vinculados.map((serial) => Number(serial.id_submontagem_serial));
          const placeholders = serialIds.map(() => '?').join(', ');

          await connection.query(
            `
              UPDATE submontagem_seriais
              SET
                numero_pedido = ?,
                data_saida = CURRENT_TIMESTAMP
              WHERE id IN (${placeholders})
            `,
            [pedido.codigo_pedido, ...serialIds]
          );
        }
      }
      }

      if (!coletaSaidaJaRegistrada && solicitacoesSaida.length && movimentosSaida.length) {
        await ExpedicaoSaidaModel.createFromProcess(connection, {
          tipo_saida: 'VENDA',
          observacao: observacaoSaidaBase,
          usuario: actor,
          solicitacoes: solicitacoesSaida,
          movimentos: movimentosSaida
        });
      }

      await connection.query(
        `
          UPDATE pedidos_expedicao
          SET
            data_coleta = CURRENT_TIMESTAMP,
            status = ?,
            updated_by = ?
          WHERE id = ?
        `,
        [STATUS.PEDIDO_COLETADO, actor.id, pedidoId]
      );

      await connection.commit();
      return this.findById(pedidoId, connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = PedidoExpedicaoModel;
