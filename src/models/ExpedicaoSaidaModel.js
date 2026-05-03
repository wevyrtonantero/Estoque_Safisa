const { pool } = require('../../database/connection');

const TIPOS_SAIDA = Object.freeze([
  'VENDA',
  'GARANTIA',
  'CORTESIA',
  'USO_INTERNO',
  'OUTROS'
]);

const FORMAS_ATENDIMENTO = Object.freeze([
  'PRONTO',
  'COMPOSICAO_VENDA',
  'COMPONENTE_SUBMONTAGEM'
]);

class ExpedicaoSaidaModel {
  static normalizeTipoSaida(value) {
    const normalized = String(value || 'VENDA').trim().toUpperCase().replace(/\s+/g, '_');
    return TIPOS_SAIDA.includes(normalized) ? normalized : 'VENDA';
  }

  static normalizeFormaAtendimento(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return FORMAS_ATENDIMENTO.includes(normalized) ? normalized : 'PRONTO';
  }

  static async ensureSchema(db = pool) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS expedicao_saidas (
        id BIGINT NOT NULL AUTO_INCREMENT,
        tipo_saida VARCHAR(30) NOT NULL DEFAULT 'VENDA',
        observacao VARCHAR(255) NULL,
        id_usuario INT NULL,
        usuario_login VARCHAR(80) NULL,
        usuario_nome VARCHAR(120) NULL,
        data_saida TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_exp_saidas_data (data_saida),
        KEY idx_exp_saidas_tipo (tipo_saida)
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8mb4
        COLLATE = utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS expedicao_saida_itens (
        id BIGINT NOT NULL AUTO_INCREMENT,
        id_saida BIGINT NOT NULL,
        solicitacao_ref INT NOT NULL,
        id_peca_solicitada INT NOT NULL,
        codigo_solicitado VARCHAR(80) NOT NULL,
        descricao_solicitada VARCHAR(255) NOT NULL,
        classificacao_solicitada VARCHAR(30) NOT NULL,
        quantidade_solicitada DECIMAL(10, 2) NOT NULL,
        quantidade_pronta DECIMAL(10, 2) NOT NULL DEFAULT 0,
        quantidade_composicao_venda DECIMAL(10, 2) NOT NULL DEFAULT 0,
        quantidade_componentes DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_exp_saida_itens_saida (id_saida),
        KEY idx_exp_saida_itens_ref (id_saida, solicitacao_ref),
        KEY idx_exp_saida_itens_peca (id_peca_solicitada),
        CONSTRAINT fk_exp_saida_itens_saida
          FOREIGN KEY (id_saida) REFERENCES expedicao_saidas (id)
          ON DELETE CASCADE
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8mb4
        COLLATE = utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS expedicao_saida_baixas (
        id BIGINT NOT NULL AUTO_INCREMENT,
        id_saida BIGINT NOT NULL,
        id_saida_item BIGINT NOT NULL,
        id_movimentacao_estoque INT NULL,
        id_peca_baixada INT NOT NULL,
        codigo_baixado VARCHAR(80) NOT NULL,
        descricao_baixado VARCHAR(255) NOT NULL,
        classificacao_baixada VARCHAR(30) NOT NULL,
        quantidade_baixada DECIMAL(10, 2) NOT NULL,
        forma_atendimento VARCHAR(40) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_exp_saida_baixas_saida (id_saida),
        KEY idx_exp_saida_baixas_item (id_saida_item),
        KEY idx_exp_saida_baixas_peca (id_peca_baixada),
        KEY idx_exp_saida_baixas_forma (forma_atendimento),
        CONSTRAINT fk_exp_saida_baixas_saida
          FOREIGN KEY (id_saida) REFERENCES expedicao_saidas (id)
          ON DELETE CASCADE,
        CONSTRAINT fk_exp_saida_baixas_item
          FOREIGN KEY (id_saida_item) REFERENCES expedicao_saida_itens (id)
          ON DELETE CASCADE
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8mb4
        COLLATE = utf8mb4_unicode_ci
    `);
  }

  static async findItemSnapshot(db, idPeca) {
    const [rows] = await db.query(
      `
        SELECT
          id,
          codigo,
          descricao,
          classificacao
        FROM pecas
        WHERE id = ?
      `,
      [idPeca]
    );

    return rows[0] || {
      id: idPeca,
      codigo: '-',
      descricao: 'Peca nao encontrada',
      classificacao: '-'
    };
  }

  static async createFromProcess(connection, data = {}) {
    const actor = data.usuario || {};
    const tipoSaida = this.normalizeTipoSaida(data.tipo_saida);
    const [saidaResult] = await connection.query(
      `
        INSERT INTO expedicao_saidas (
          tipo_saida,
          observacao,
          id_usuario,
          usuario_login,
          usuario_nome
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        tipoSaida,
        data.observacao || null,
        actor.id ?? null,
        actor.login || null,
        actor.nome || null
      ]
    );

    const idSaida = saidaResult.insertId;
    const itensPorRef = new Map();

    for (const solicitacao of data.solicitacoes || []) {
      const [itemResult] = await connection.query(
        `
          INSERT INTO expedicao_saida_itens (
            id_saida,
            solicitacao_ref,
            id_peca_solicitada,
            codigo_solicitado,
            descricao_solicitada,
            classificacao_solicitada,
            quantidade_solicitada,
            quantidade_pronta,
            quantidade_composicao_venda,
            quantidade_componentes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idSaida,
          Number(solicitacao.solicitacao_ref),
          solicitacao.id_peca,
          solicitacao.codigo,
          solicitacao.descricao,
          solicitacao.classificacao,
          solicitacao.quantidade_solicitada,
          solicitacao.quantidade_submontagem_pronta || 0,
          solicitacao.quantidade_composicao_venda || 0,
          solicitacao.quantidade_componentes || 0
        ]
      );

      itensPorRef.set(Number(solicitacao.solicitacao_ref), itemResult.insertId);
    }

    for (const movimento of data.movimentos || []) {
      const idSaidaItem = itensPorRef.get(Number(movimento.solicitacao_ref));

      if (!idSaidaItem) {
        throw this.createBusinessError('Nao foi possivel vincular a baixa ao item da saida.');
      }

      const itemBaixado = await this.findItemSnapshot(connection, movimento.id_peca);

      await connection.query(
        `
          INSERT INTO expedicao_saida_baixas (
            id_saida,
            id_saida_item,
            id_movimentacao_estoque,
            id_peca_baixada,
            codigo_baixado,
            descricao_baixado,
            classificacao_baixada,
            quantidade_baixada,
            forma_atendimento
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idSaida,
          idSaidaItem,
          movimento.id_movimentacao_estoque || null,
          movimento.id_peca,
          itemBaixado.codigo,
          itemBaixado.descricao,
          itemBaixado.classificacao,
          movimento.quantidade,
          this.normalizeFormaAtendimento(movimento.forma_atendimento)
        ]
      );
    }

    return {
      id: Number(idSaida),
      tipo_saida: tipoSaida
    };
  }

  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static buildWhereClause(filters = {}) {
    const conditions = ['1 = 1'];
    const params = [];

    if (filters.data_inicio) {
      conditions.push('s.data_saida >= ?');
      params.push(`${filters.data_inicio} 00:00:00`);
    }

    if (filters.data_fim) {
      conditions.push('s.data_saida < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(filters.data_fim);
    }

    if (filters.tipo_saida) {
      conditions.push('s.tipo_saida = ?');
      params.push(filters.tipo_saida);
    }

    if (filters.forma_atendimento) {
      conditions.push('b.forma_atendimento = ?');
      params.push(filters.forma_atendimento);
    }

    if (filters.classificacao) {
      conditions.push('i.classificacao_solicitada = ?');
      params.push(filters.classificacao);
    }

    if (filters.codigo) {
      conditions.push('(i.codigo_solicitado LIKE ? OR b.codigo_baixado LIKE ?)');
      params.push(`%${filters.codigo}%`, `%${filters.codigo}%`);
    }

    if (filters.descricao) {
      conditions.push('(i.descricao_solicitada LIKE ? OR b.descricao_baixado LIKE ?)');
      params.push(`%${filters.descricao}%`, `%${filters.descricao}%`);
    }

    if (filters.observacao) {
      conditions.push("COALESCE(s.observacao, '') LIKE ?");
      params.push(`%${filters.observacao}%`);
    }

    return {
      whereClause: conditions.join(' AND '),
      params
    };
  }

  static mapReportRow(row) {
    return {
      id_saida: Number(row.id_saida),
      data_saida: row.data_saida || null,
      tipo_saida: row.tipo_saida,
      observacao: row.observacao || null,
      usuario_nome: row.usuario_nome || null,
      usuario_login: row.usuario_login || null,
      id_saida_item: Number(row.id_saida_item),
      id_peca_solicitada: Number(row.id_peca_solicitada),
      codigo_solicitado: row.codigo_solicitado,
      descricao_solicitada: row.descricao_solicitada,
      classificacao_solicitada: row.classificacao_solicitada,
      quantidade_solicitada: Number(row.quantidade_solicitada || 0),
      quantidade_pronta: Number(row.quantidade_pronta || 0),
      quantidade_composicao_venda: Number(row.quantidade_composicao_venda || 0),
      quantidade_componentes: Number(row.quantidade_componentes || 0),
      id_peca_baixada: Number(row.id_peca_baixada),
      codigo_baixado: row.codigo_baixado,
      descricao_baixado: row.descricao_baixado,
      classificacao_baixada: row.classificacao_baixada,
      quantidade_baixada: Number(row.quantidade_baixada || 0),
      forma_atendimento: row.forma_atendimento,
      id_movimentacao_estoque: row.id_movimentacao_estoque === null
        ? null
        : Number(row.id_movimentacao_estoque)
    };
  }

  static async findAll(filters = {}, db = pool) {
    await this.ensureSchema(db);

    const { whereClause, params } = this.buildWhereClause(filters);
    const limit = Number.isInteger(filters.limit) && filters.limit > 0
      ? Math.min(filters.limit, 1000)
      : 500;

    const [rows] = await db.query(
      `
        SELECT
          s.id AS id_saida,
          s.data_saida,
          s.tipo_saida,
          s.observacao,
          s.usuario_nome,
          s.usuario_login,
          i.id AS id_saida_item,
          i.id_peca_solicitada,
          i.codigo_solicitado,
          i.descricao_solicitada,
          i.classificacao_solicitada,
          i.quantidade_solicitada,
          i.quantidade_pronta,
          i.quantidade_composicao_venda,
          i.quantidade_componentes,
          b.id_peca_baixada,
          b.codigo_baixado,
          b.descricao_baixado,
          b.classificacao_baixada,
          b.quantidade_baixada,
          b.forma_atendimento,
          b.id_movimentacao_estoque
        FROM expedicao_saidas s
        INNER JOIN expedicao_saida_itens i ON i.id_saida = s.id
        INNER JOIN expedicao_saida_baixas b ON b.id_saida_item = i.id
        WHERE ${whereClause}
        ORDER BY s.data_saida DESC, s.id DESC, i.id ASC, b.id ASC
        LIMIT ${limit}
      `,
      params
    );

    return rows.map((row) => this.mapReportRow(row));
  }
}

ExpedicaoSaidaModel.TIPOS_SAIDA = TIPOS_SAIDA;
ExpedicaoSaidaModel.FORMAS_ATENDIMENTO = FORMAS_ATENDIMENTO;

module.exports = ExpedicaoSaidaModel;
