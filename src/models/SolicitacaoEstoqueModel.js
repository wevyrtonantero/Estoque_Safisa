const { pool } = require('../../database/connection');
const EstoqueModel = require('./EstoqueModel');
const UsuarioModel = require('./UsuarioModel');
const NotificacaoModel = require('./NotificacaoModel');

class SolicitacaoEstoqueModel {
  static STATUSS_ABERTOS = ['PENDENTE', 'FALTANDO_PECA', 'MONTANDO', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'];

  static AREAS_DESTINO = {
    EXPEDICAO: 'Expedição',
    MONTAGEM: 'Montagem'
  };

  static ORIGENS_ATENDIMENTO = {
    ALMOXARIFADO: 'Almoxarifado',
    MONTAGEM: 'Montagem'
  };

  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static normalizeUserId(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
  }

  static async ensureSchema(db = pool) {
    await UsuarioModel.ensureSchema(db);
    await this.ensureSolicitanteColumn(db);
  }

  static async ensureSolicitanteColumn(db = pool) {
    const [columns] = await db.query(
      `
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'solicitacoes_estoque'
          AND COLUMN_NAME = 'solicitante_id'
        LIMIT 1
      `
    );

    if (!columns.length) {
      await db.query(`
        ALTER TABLE solicitacoes_estoque
        ADD COLUMN solicitante_id INT NULL AFTER origem_atendimento
      `);
    }

    const [indexes] = await db.query(
      `
        SELECT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'solicitacoes_estoque'
          AND INDEX_NAME = 'idx_solicitacao_solicitante'
        LIMIT 1
      `
    );

    if (!indexes.length) {
      await db.query(`
        ALTER TABLE solicitacoes_estoque
        ADD INDEX idx_solicitacao_solicitante (solicitante_id)
      `);
    }

    const [constraints] = await db.query(
      `
        SELECT CONSTRAINT_NAME
        FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'solicitacoes_estoque'
          AND CONSTRAINT_NAME = 'fk_solicitacao_solicitante'
        LIMIT 1
      `
    );

    if (!constraints.length) {
      await db.query(`
        ALTER TABLE solicitacoes_estoque
        ADD CONSTRAINT fk_solicitacao_solicitante
          FOREIGN KEY (solicitante_id) REFERENCES usuarios(id)
          ON DELETE SET NULL
      `);
    }
  }

  static normalizeArea(area) {
    const normalized = String(area || '').trim().toUpperCase();
    return ['EXPEDICAO', 'MONTAGEM'].includes(normalized) ? normalized : '';
  }

  static normalizeOrigin(origin) {
    const normalized = String(origin || '').trim().toUpperCase();
    return ['ALMOXARIFADO', 'MONTAGEM'].includes(normalized) ? normalized : '';
  }

  static buildAreaLabel(area) {
    return area === 'EXPEDICAO' ? 'Expedição' : 'Montagem';
  }

  static buildOriginLabel(origin) {
    return origin === 'MONTAGEM' ? 'Montagem' : 'Almoxarifado';
  }

  static normalizeStatus(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return ['PENDENTE', 'FALTANDO_PECA', 'MONTANDO', 'EM_SEPARACAO'].includes(normalized) ? normalized : '';
  }

  static formatStatus(status) {
    const labels = {
      PENDENTE: 'Pendente',
      FALTANDO_PECA: 'Faltando peca',
      MONTANDO: 'Montando',
      EM_SEPARACAO: 'Pronto',
      ATENDIDA_PARCIAL: 'Atendida parcial',
      ATENDIDA: 'Pronta',
      CANCELADA: 'Cancelada'
    };

    return labels[String(status || '').toUpperCase()] || status || '-';
  }

  static buildSolicitacaoLink(setor) {
    const links = {
      ALMOXARIFADO: '/pagina-almoxarifado',
      MONTAGEM: '/pagina-montagem',
      EXPEDICAO: '/pagina-expedicao',
      PRODUCAO: '/pagina-producao',
      ADMINISTRATIVO: '/pagina-acesso'
    };

    return links[String(setor || '').toUpperCase()] || '/pagina-acesso';
  }

  static buildItemLabel(solicitacao) {
    const codigo = solicitacao?.codigo || `#${solicitacao?.id || '-'}`;
    const descricao = solicitacao?.descricao ? ` - ${solicitacao.descricao}` : '';
    return `${codigo}${descricao}`;
  }

  static async notifyNovaSolicitacao(solicitacao) {
    if (!solicitacao?.id || !solicitacao.origem_atendimento) {
      return;
    }

    const solicitante = solicitacao.solicitante_nome || solicitacao.solicitante_login || 'Usuario';
    const setorDestino = String(solicitacao.origem_atendimento).toUpperCase();
    const quantidade = Number(solicitacao.quantidade_solicitada || 0);

    await NotificacaoModel.createForSetor(setorDestino, {
      tipo: 'SOLICITACAO_ESTOQUE',
      titulo: 'Nova solicitacao de peca',
      mensagem: `${solicitante} solicitou ${quantidade} de ${this.buildItemLabel(solicitacao)} para ${solicitacao.destino_nome || 'o setor solicitante'}.`,
      link: this.buildSolicitacaoLink(setorDestino),
      payload: {
        solicitacao_id: Number(solicitacao.id),
        status: solicitacao.status,
        origem_atendimento: solicitacao.origem_atendimento,
        area_origem: solicitacao.area_origem
      }
    }, {
      excludeUserIds: solicitacao.solicitante_id ? [solicitacao.solicitante_id] : []
    });
  }

  static async notifyResumoSolicitacoes(solicitacaoIds, solicitanteId) {
    await this.ensureSchema(pool);

    const ids = [...new Set(
      (Array.isArray(solicitacaoIds) ? solicitacaoIds : [solicitacaoIds])
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];
    const normalizedSolicitanteId = this.normalizeUserId(solicitanteId);

    if (!ids.length || !Number.isInteger(normalizedSolicitanteId)) {
      return { grupos: 0, notificacoes: 0 };
    }

    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.area_origem,
          s.origem_atendimento,
          s.solicitante_id,
          s.status,
          s.quantidade_solicitada,
          p.codigo,
          p.descricao,
          us.nome AS solicitante_nome,
          us.login AS solicitante_login,
          CASE
            WHEN s.area_origem = 'EXPEDICAO' THEN 'Expedicao'
            ELSE 'Montagem'
          END AS destino_nome
        FROM solicitacoes_estoque s
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN usuarios us ON us.id = s.solicitante_id
        WHERE s.id IN (${placeholders})
          AND s.solicitante_id = ?
        ORDER BY s.origem_atendimento ASC, s.id ASC
      `,
      [...ids, normalizedSolicitanteId]
    );

    const groups = rows.reduce((accumulator, row) => {
      const key = String(row.origem_atendimento || '').toUpperCase();
      if (!key) {
        return accumulator;
      }

      if (!accumulator.has(key)) {
        accumulator.set(key, []);
      }

      accumulator.get(key).push(row);
      return accumulator;
    }, new Map());

    let notificationCount = 0;

    for (const [setorDestino, items] of groups.entries()) {
      const first = items[0];
      const solicitante = first.solicitante_nome || first.solicitante_login || 'Usuario';
      const destinoNome = first.destino_nome || 'o setor solicitante';
      const totalItems = items.length;

      const created = await NotificacaoModel.createForSetor(setorDestino, {
        tipo: 'SOLICITACAO_ESTOQUE',
        titulo: 'Nova solicitacao de pecas',
        mensagem: `${solicitante} solicitou ${totalItems} item(ns) para ${destinoNome}.`,
        link: this.buildSolicitacaoLink(setorDestino),
        payload: {
          solicitacao_ids: items.map((item) => Number(item.id)),
          total_itens: totalItems,
          origem_atendimento: setorDestino,
          area_origem: first.area_origem
        }
      }, {
        excludeUserIds: [normalizedSolicitanteId]
      });

      notificationCount += created.length;
    }

    return {
      grupos: groups.size,
      notificacoes: notificationCount
    };
  }

  static async notifyStatusSolicitacao(solicitacao, previousStatus) {
    if (!solicitacao?.id || !solicitacao.solicitante_id) {
      return;
    }

    const currentStatus = String(solicitacao.status || '').toUpperCase();
    if (currentStatus === 'CANCELADA') {
      return;
    }

    if (previousStatus && String(previousStatus).toUpperCase() === currentStatus) {
      return;
    }

    if (currentStatus !== 'EM_SEPARACAO') {
      return;
    }

    await NotificacaoModel.createForUser(solicitacao.solicitante_id, {
      tipo: 'SOLICITACAO_STATUS',
      titulo: 'Sua solicitacao esta pronta',
      mensagem: `Solicitacao #${solicitacao.id} de ${this.buildItemLabel(solicitacao)} esta pronta para retirada.`,
      link: this.buildSolicitacaoLink(solicitacao.area_origem),
      payload: {
        solicitacao_id: Number(solicitacao.id),
        status: currentStatus,
        status_anterior: previousStatus || null,
        area_origem: solicitacao.area_origem,
        origem_atendimento: solicitacao.origem_atendimento
      }
    });
  }

  static async notifyCancelamentoSolicitacao(solicitacao) {
    if (!solicitacao?.id || !solicitacao.origem_atendimento) {
      return;
    }

    const setorDestino = String(solicitacao.origem_atendimento).toUpperCase();

    await NotificacaoModel.createForSetor(setorDestino, {
      tipo: 'SOLICITACAO_CANCELADA',
      titulo: 'Solicitacao cancelada',
      mensagem: `Solicitacao #${solicitacao.id} de ${this.buildItemLabel(solicitacao)} foi cancelada.`,
      link: this.buildSolicitacaoLink(setorDestino),
      payload: {
        solicitacao_id: Number(solicitacao.id),
        status: 'CANCELADA',
        origem_atendimento: solicitacao.origem_atendimento,
        area_origem: solicitacao.area_origem
      }
    }, {
      excludeUserIds: solicitacao.solicitante_id ? [solicitacao.solicitante_id] : []
    });
  }

  static async runNotificationSafely(callback) {
    try {
      await callback();
    } catch (error) {
      console.error('Falha ao criar notificacao de solicitacao:', error.message);
    }
  }

  static async findDestinationStock(connection, area) {
    const stockName = this.AREAS_DESTINO[area];
    if (!stockName) {
      throw this.createBusinessError('Area de destino invalida para a solicitacao.');
    }

    const stock = await EstoqueModel.findStockByName(stockName, connection);
    if (!stock || Number(stock.ativo) !== 1) {
      throw this.createBusinessError(`O estoque de ${this.buildAreaLabel(area)} nao esta disponivel.`);
    }

    return stock;
  }

  static async findAlmoxStock(connection) {
    const stock = await EstoqueModel.findStockByName('Almoxarifado', connection);
    if (!stock || Number(stock.ativo) !== 1) {
      throw this.createBusinessError('O estoque do Almoxarifado nao esta disponivel.');
    }

    return stock;
  }

  static async findSourceStock(connection, origin) {
    const stockName = this.ORIGENS_ATENDIMENTO[origin];
    if (!stockName) {
      throw this.createBusinessError('Origem de atendimento invalida para a solicitacao.');
    }

    const stock = await EstoqueModel.findStockByName(stockName, connection);
    if (!stock || Number(stock.ativo) !== 1) {
      throw this.createBusinessError(`O estoque de ${this.buildOriginLabel(origin)} nao esta disponivel.`);
    }

    return stock;
  }

  static async findById(id, connection = pool) {
    await this.ensureSchema(connection);

    const [rows] = await connection.query(
      `
        SELECT
          s.id,
          s.area_origem,
          s.origem_atendimento,
          s.solicitante_id,
          s.id_peca,
          s.quantidade_solicitada,
          s.quantidade_atendida,
          GREATEST(s.quantidade_solicitada - s.quantidade_atendida, 0) AS quantidade_pendente,
          s.status,
          s.observacao,
          s.data_previsao,
          s.data_solicitacao,
          s.data_inicio_separacao,
          s.data_atendimento,
          p.codigo,
          p.descricao,
          p.classificacao,
          p.tipo,
          p.estoque_minimo AS quantidade_pacote,
          COALESCE(m.nome, '-') AS maquina_nome,
          us.nome AS solicitante_nome,
          us.login AS solicitante_login,
          COALESCE(sa.quantidade, 0) AS saldo_almoxarifado,
          CASE
            WHEN s.area_origem = 'EXPEDICAO' THEN 'Expedição'
            ELSE 'Montagem'
          END AS destino_nome,
          CASE
            WHEN s.origem_atendimento = 'MONTAGEM' THEN 'Montagem'
            ELSE 'Almoxarifado'
          END AS origem_atendimento_nome
        FROM solicitacoes_estoque s
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        LEFT JOIN usuarios us ON us.id = s.solicitante_id
        LEFT JOIN estoque_saldos sa ON sa.id_peca = s.id_peca
          AND sa.id_estoque = (
            SELECT id FROM estoques WHERE nome = 'Almoxarifado' LIMIT 1
          )
        WHERE s.id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async findAll(filters = {}) {
    await this.ensureSchema(pool);

    const conditions = ['1 = 1'];
    const values = [];

    if (filters.area_origem) {
      conditions.push('s.area_origem = ?');
      values.push(filters.area_origem);
    }

    if (filters.origem_atendimento) {
      conditions.push('s.origem_atendimento = ?');
      values.push(filters.origem_atendimento);
    }

    if (filters.status) {
      conditions.push('s.status = ?');
      values.push(filters.status);
    }

    if (filters.abertas) {
      conditions.push(`s.status IN (${this.STATUSS_ABERTOS.map(() => '?').join(', ')})`);
      values.push(...this.STATUSS_ABERTOS);
    }

    if (filters.q) {
      conditions.push(`
        (
          p.codigo LIKE ?
          OR p.descricao LIKE ?
          OR s.observacao LIKE ?
        )
      `);
      values.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.area_origem,
          s.origem_atendimento,
          s.solicitante_id,
          s.id_peca,
          s.quantidade_solicitada,
          s.quantidade_atendida,
          GREATEST(s.quantidade_solicitada - s.quantidade_atendida, 0) AS quantidade_pendente,
          s.status,
          s.observacao,
          s.data_previsao,
          s.data_solicitacao,
          s.data_inicio_separacao,
          s.data_atendimento,
          p.codigo,
          p.descricao,
          p.classificacao,
          p.tipo,
          p.estoque_minimo AS quantidade_pacote,
          COALESCE(m.nome, '-') AS maquina_nome,
          us.nome AS solicitante_nome,
          us.login AS solicitante_login,
          COALESCE(sa.quantidade, 0) AS saldo_almoxarifado,
          CASE
            WHEN s.area_origem = 'EXPEDICAO' THEN 'Expedição'
            ELSE 'Montagem'
          END AS destino_nome,
          CASE
            WHEN s.origem_atendimento = 'MONTAGEM' THEN 'Montagem'
            ELSE 'Almoxarifado'
          END AS origem_atendimento_nome
        FROM solicitacoes_estoque s
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        LEFT JOIN usuarios us ON us.id = s.solicitante_id
        LEFT JOIN estoque_saldos sa ON sa.id_peca = s.id_peca
          AND sa.id_estoque = (
            SELECT id FROM estoques WHERE nome = 'Almoxarifado' LIMIT 1
          )
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          CASE s.status
            WHEN 'PENDENTE' THEN 1
            WHEN 'FALTANDO_PECA' THEN 2
            WHEN 'MONTANDO' THEN 3
            WHEN 'EM_SEPARACAO' THEN 4
            WHEN 'ATENDIDA_PARCIAL' THEN 5
            WHEN 'ATENDIDA' THEN 6
            ELSE 7
          END,
          s.id DESC
      `,
      values
    );

    return rows;
  }

  static async create(data) {
    await this.ensureSchema(pool);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const area = this.normalizeArea(data.area_origem);
      if (!area) {
        throw this.createBusinessError('A area de origem da solicitacao deve ser valida.');
      }

      const origemAtendimento = this.normalizeOrigin(data.origem_atendimento || 'ALMOXARIFADO');
      if (!origemAtendimento) {
        throw this.createBusinessError('A origem de atendimento da solicitacao deve ser valida.');
      }

      const solicitanteId = this.normalizeUserId(data.solicitante_id);
      if (Number.isNaN(solicitanteId)) {
        throw this.createBusinessError('O usuario solicitante da peca e invalido.');
      }

      if (area === 'MONTAGEM' && origemAtendimento !== 'ALMOXARIFADO') {
        throw this.createBusinessError('A Montagem deve solicitar pecas ao Almoxarifado.');
      }

      const item = await EstoqueModel.findItemById(data.id_peca, connection);
      if (!item) {
        throw this.createBusinessError('O item solicitado nao foi encontrado.');
      }

      const estoqueOrigem = await this.findSourceStock(connection, origemAtendimento);
      const quantidadeSolicitada = Number(data.quantidade_solicitada || 0);

      const exigeSaldoNaOrigem = !(area === 'EXPEDICAO' && origemAtendimento === 'MONTAGEM');

      if (exigeSaldoNaOrigem) {
        const saldoOrigem = await EstoqueModel.findSaldoForUpdate(connection, estoqueOrigem.id, data.id_peca);
        const quantidadeDisponivel = saldoOrigem ? Number(saldoOrigem.quantidade) : 0;

        if (quantidadeDisponivel <= 0) {
          throw this.createBusinessError(
            `Nao ha saldo disponivel de ${item.codigo} em ${estoqueOrigem.nome} para gerar a solicitacao.`
          );
        }

        if (quantidadeSolicitada > quantidadeDisponivel) {
          throw this.createBusinessError(
            `Saldo insuficiente em ${estoqueOrigem.nome}. Disponivel: ${quantidadeDisponivel}.`
          );
        }
      }

      const [result] = await connection.query(
        `
          INSERT INTO solicitacoes_estoque (
            area_origem,
            origem_atendimento,
            solicitante_id,
            id_peca,
            quantidade_solicitada,
            observacao
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          area,
          origemAtendimento,
          solicitanteId,
          data.id_peca,
          data.quantidade_solicitada,
          data.observacao || null
        ]
      );

      await connection.commit();

      const created = await this.findById(result.insertId);
      if (data.notificar !== false) {
        await this.runNotificationSafely(() => this.notifyNovaSolicitacao(created));
      }
      return created;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async startSeparation(id) {
    await this.ensureSchema(pool);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const request = await this.findById(id, connection);
      if (!request) {
        throw this.createBusinessError('Solicitacao nao encontrada.');
      }

      if (!['PENDENTE', 'FALTANDO_PECA', 'MONTANDO', 'ATENDIDA_PARCIAL'].includes(request.status)) {
        throw this.createBusinessError('Somente solicitacoes pendentes podem entrar em separacao.');
      }

      await connection.query(
        `
          UPDATE solicitacoes_estoque
          SET
            status = 'EM_SEPARACAO',
            data_inicio_separacao = COALESCE(data_inicio_separacao, NOW())
          WHERE id = ?
        `,
        [id]
      );

      await connection.commit();

      const updated = await this.findById(id);
      await this.runNotificationSafely(() => this.notifyStatusSolicitacao(updated, request.status));
      return updated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async fulfill(id, data) {
    await this.ensureSchema(pool);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [requestRows] = await connection.query(
        `
          SELECT
            id,
            area_origem,
            origem_atendimento,
            solicitante_id,
            id_peca,
            quantidade_solicitada,
            quantidade_atendida,
            status,
            observacao
          FROM solicitacoes_estoque
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

      const request = requestRows[0] || null;
      if (!request) {
        throw this.createBusinessError('Solicitacao nao encontrada.');
      }

      if (!['PENDENTE', 'FALTANDO_PECA', 'MONTANDO', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'].includes(request.status)) {
        throw this.createBusinessError('Esta solicitacao nao pode mais ser atendida.');
      }

      const item = await EstoqueModel.findItemById(request.id_peca, connection);
      if (!item) {
        throw this.createBusinessError('O item solicitado nao foi encontrado para atendimento.');
      }

      const quantidadePendente = Number(
        (Number(request.quantidade_solicitada) - Number(request.quantidade_atendida)).toFixed(2)
      );
      const quantidadeAtender = Number(Number(data.quantidade_atendida).toFixed(2));

      if (!Number.isFinite(quantidadeAtender) || quantidadeAtender <= 0) {
        throw this.createBusinessError('A quantidade atendida deve ser maior que zero.');
      }

      if (quantidadeAtender > quantidadePendente) {
        throw this.createBusinessError('A quantidade atendida nao pode ser maior que o saldo pendente da solicitacao.');
      }

      const origemAtendimento = this.normalizeOrigin(request.origem_atendimento);
      const estoqueOrigem = await this.findSourceStock(connection, origemAtendimento);
      const destino = await this.findDestinationStock(connection, request.area_origem);

      const saldoOrigem = await EstoqueModel.findSaldoForUpdate(connection, estoqueOrigem.id, request.id_peca);
      const quantidadeOrigem = saldoOrigem ? Number(saldoOrigem.quantidade) : 0;

      if (quantidadeAtender > quantidadeOrigem) {
        throw this.createBusinessError(`Saldo insuficiente em ${estoqueOrigem.nome} para ${item.codigo}.`);
      }

      const saldoDestino = await EstoqueModel.findSaldoForUpdate(connection, destino.id, request.id_peca);
      const quantidadeDestino = saldoDestino ? Number(saldoDestino.quantidade) : 0;

      const novoSaldoOrigem = Number((quantidadeOrigem - quantidadeAtender).toFixed(2));
      const novoSaldoDestino = Number((quantidadeDestino + quantidadeAtender).toFixed(2));

      await EstoqueModel.persistSaldo(connection, estoqueOrigem.id, request.id_peca, novoSaldoOrigem, saldoOrigem);
      await EstoqueModel.persistSaldo(connection, destino.id, request.id_peca, novoSaldoDestino, saldoDestino);
      await EstoqueModel.createMovimentacao(connection, {
        id_peca: request.id_peca,
        id_estoque_origem: estoqueOrigem.id,
        id_estoque_destino: destino.id,
        tipo_movimentacao: 'TRANSFERENCIA',
        quantidade: quantidadeAtender,
        observacao: `${data.observacao || 'Atendimento de solicitacao interna.'} Solicitação #${request.id} de ${estoqueOrigem.nome} para ${destino.nome}.`.slice(0, 255)
      });

      const quantidadeAtendidaTotal = Number((Number(request.quantidade_atendida) + quantidadeAtender).toFixed(2));
      const novoStatus = quantidadeAtendidaTotal >= Number(request.quantidade_solicitada)
        ? 'ATENDIDA'
        : 'ATENDIDA_PARCIAL';

      await connection.query(
        `
          UPDATE solicitacoes_estoque
          SET
            quantidade_atendida = ?,
            status = ?,
            data_atendimento = NOW(),
            data_previsao = NULL,
            observacao = ?
          WHERE id = ?
        `,
        [
          quantidadeAtendidaTotal,
          novoStatus,
          data.observacao || request.observacao || null,
          id
        ]
      );

      await connection.commit();

      const updated = await this.findById(id);
      await this.runNotificationSafely(() => this.notifyStatusSolicitacao(updated, request.status));
      return updated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async cancel(id, data = {}) {
    await this.ensureSchema(pool);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const request = await this.findById(id, connection);
      if (!request) {
        throw this.createBusinessError('Solicitacao nao encontrada.');
      }

      if (request.status === 'ATENDIDA') {
        throw this.createBusinessError('Solicitacoes atendidas nao podem ser canceladas.');
      }

      await connection.query(
        `
          UPDATE solicitacoes_estoque
          SET
            status = 'CANCELADA',
            observacao = ?
          WHERE id = ?
        `,
        [data.observacao || request.observacao || null, id]
      );

      await connection.commit();

      const updated = await this.findById(id);
      await this.runNotificationSafely(() => this.notifyCancelamentoSolicitacao(updated));
      return updated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateStatus(id, data = {}) {
    await this.ensureSchema(pool);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const request = await this.findById(id, connection);
      if (!request) {
        throw this.createBusinessError('Solicitacao nao encontrada.');
      }

      if (['ATENDIDA', 'CANCELADA'].includes(String(request.status || '').toUpperCase())) {
        throw this.createBusinessError('Solicitacoes encerradas nao podem ter o status alterado.');
      }

      const status = this.normalizeStatus(data.status);
      if (!status) {
        throw this.createBusinessError('Status invalido para a solicitacao.');
      }

      await connection.query(
        `
          UPDATE solicitacoes_estoque
          SET
            status = ?,
            data_previsao = ?,
            data_inicio_separacao = CASE
              WHEN ? = 'EM_SEPARACAO' THEN COALESCE(data_inicio_separacao, NOW())
              ELSE data_inicio_separacao
            END,
            observacao = ?
          WHERE id = ?
        `,
        [
          status,
          data.data_previsao || null,
          status,
          data.observacao || request.observacao || null,
          id
        ]
      );

      await connection.commit();

      const updated = await this.findById(id);
      await this.runNotificationSafely(() => this.notifyStatusSolicitacao(updated, request.status));
      return updated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = SolicitacaoEstoqueModel;
