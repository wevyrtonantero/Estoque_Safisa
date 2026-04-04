const { pool } = require('../../database/connection');

class AuditLogModel {
  static async ensureSchema(db = pool) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS auditoria_logs (
        id BIGINT NOT NULL AUTO_INCREMENT,
        id_usuario INT NULL,
        usuario_login VARCHAR(80) NULL,
        usuario_nome VARCHAR(120) NULL,
        usuario_role VARCHAR(30) NULL,
        modulo VARCHAR(60) NOT NULL,
        acao VARCHAR(60) NOT NULL,
        entidade_tipo VARCHAR(80) NULL,
        entidade_id VARCHAR(80) NULL,
        descricao VARCHAR(255) NULL,
        detalhes_antes JSON NULL,
        detalhes_depois JSON NULL,
        ip VARCHAR(100) NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_auditoria_created_at (created_at),
        KEY idx_auditoria_usuario (id_usuario),
        KEY idx_auditoria_modulo (modulo),
        KEY idx_auditoria_acao (acao)
      )
    `);
  }

  static parseJsonField(value) {
    if (!value) {
      return null;
    }

    if (typeof value === 'object') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  static mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      id_usuario: row.id_usuario === null ? null : Number(row.id_usuario),
      usuario_login: row.usuario_login || null,
      usuario_nome: row.usuario_nome || null,
      usuario_role: row.usuario_role || null,
      modulo: row.modulo,
      acao: row.acao,
      entidade_tipo: row.entidade_tipo || null,
      entidade_id: row.entidade_id || null,
      descricao: row.descricao || null,
      detalhes_antes: this.parseJsonField(row.detalhes_antes),
      detalhes_depois: this.parseJsonField(row.detalhes_depois),
      ip: row.ip || null,
      user_agent: row.user_agent || null,
      created_at: row.created_at || null
    };
  }

  static async record(data, db = pool) {
    await this.ensureSchema(db);

    const payload = {
      id_usuario: data.id_usuario ?? null,
      usuario_login: data.usuario_login ? String(data.usuario_login).trim() : null,
      usuario_nome: data.usuario_nome ? String(data.usuario_nome).trim() : null,
      usuario_role: data.usuario_role ? String(data.usuario_role).trim() : null,
      modulo: String(data.modulo || '').trim().toUpperCase(),
      acao: String(data.acao || '').trim().toUpperCase(),
      entidade_tipo: data.entidade_tipo ? String(data.entidade_tipo).trim().toUpperCase() : null,
      entidade_id: data.entidade_id === undefined || data.entidade_id === null
        ? null
        : String(data.entidade_id).trim(),
      descricao: data.descricao ? String(data.descricao).trim().slice(0, 255) : null,
      detalhes_antes: data.detalhes_antes ?? null,
      detalhes_depois: data.detalhes_depois ?? null,
      ip: data.ip ? String(data.ip).trim().slice(0, 100) : null,
      user_agent: data.user_agent ? String(data.user_agent).trim().slice(0, 255) : null
    };

    await db.query(
      `
        INSERT INTO auditoria_logs (
          id_usuario,
          usuario_login,
          usuario_nome,
          usuario_role,
          modulo,
          acao,
          entidade_tipo,
          entidade_id,
          descricao,
          detalhes_antes,
          detalhes_depois,
          ip,
          user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.id_usuario,
        payload.usuario_login,
        payload.usuario_nome,
        payload.usuario_role,
        payload.modulo,
        payload.acao,
        payload.entidade_tipo,
        payload.entidade_id,
        payload.descricao,
        payload.detalhes_antes ? JSON.stringify(payload.detalhes_antes) : null,
        payload.detalhes_depois ? JSON.stringify(payload.detalhes_depois) : null,
        payload.ip,
        payload.user_agent
      ]
    );
  }

  static async findAll(filters = {}, db = pool) {
    await this.ensureSchema(db);

    const conditions = [];
    const params = [];

    if (filters.data_inicio) {
      conditions.push('created_at >= ?');
      params.push(`${filters.data_inicio} 00:00:00`);
    }

    if (filters.data_fim) {
      conditions.push('created_at <= ?');
      params.push(`${filters.data_fim} 23:59:59`);
    }

    if (filters.usuario) {
      conditions.push('(usuario_nome LIKE ? OR usuario_login LIKE ?)');
      params.push(`%${filters.usuario}%`, `%${filters.usuario}%`);
    }

    if (filters.modulo) {
      conditions.push('modulo = ?');
      params.push(String(filters.modulo).trim().toUpperCase());
    }

    if (filters.acao) {
      conditions.push('acao LIKE ?');
      params.push(`%${String(filters.acao).trim().toUpperCase()}%`);
    }

    if (filters.q) {
      conditions.push(`(
        descricao LIKE ?
        OR entidade_tipo LIKE ?
        OR entidade_id LIKE ?
        OR ip LIKE ?
      )`);
      params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Number.isInteger(filters.limit) && filters.limit > 0
      ? Math.min(filters.limit, 2000)
      : 500;

    const [rows] = await db.query(
      `
        SELECT
          id,
          id_usuario,
          usuario_login,
          usuario_nome,
          usuario_role,
          modulo,
          acao,
          entidade_tipo,
          entidade_id,
          descricao,
          detalhes_antes,
          detalhes_depois,
          ip,
          user_agent,
          created_at
        FROM auditoria_logs
        ${whereClause}
        ORDER BY created_at DESC, id DESC
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
        SELECT
          id,
          id_usuario,
          usuario_login,
          usuario_nome,
          usuario_role,
          modulo,
          acao,
          entidade_tipo,
          entidade_id,
          descricao,
          detalhes_antes,
          detalhes_depois,
          ip,
          user_agent,
          created_at
        FROM auditoria_logs
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    return this.mapRow(rows[0]);
  }
}

module.exports = AuditLogModel;
