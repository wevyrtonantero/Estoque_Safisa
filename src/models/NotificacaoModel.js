const { pool } = require('../../database/connection');
const UsuarioModel = require('./UsuarioModel');
const { normalizeSetor } = require('../security/setores');

class NotificacaoModel {
  static DEFAULT_LIMIT = 20;
  static MAX_LIMIT = 50;

  static async ensureSchema(db = pool) {
    await UsuarioModel.ensureSchema(db);

    await db.query(`
      CREATE TABLE IF NOT EXISTS notificacoes (
        id INT NOT NULL AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        tipo VARCHAR(60) NOT NULL,
        titulo VARCHAR(160) NOT NULL,
        mensagem VARCHAR(500) NOT NULL,
        link VARCHAR(255) NULL,
        payload_json TEXT NULL,
        lida_em DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_notificacoes_usuario
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
          ON DELETE CASCADE,
        KEY idx_notificacoes_usuario_lida (usuario_id, lida_em, id),
        KEY idx_notificacoes_usuario_created (usuario_id, created_at, id)
      )
    `);
  }

  static normalizeUserId(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
  }

  static normalizeLimit(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return this.DEFAULT_LIMIT;
    }

    return Math.min(parsed, this.MAX_LIMIT);
  }

  static mapNotification(row) {
    let payload = null;

    if (row.payload_json) {
      try {
        payload = JSON.parse(row.payload_json);
      } catch (error) {
        payload = null;
      }
    }

    return {
      id: Number(row.id),
      usuario_id: Number(row.usuario_id),
      tipo: row.tipo,
      titulo: row.titulo,
      mensagem: row.mensagem,
      link: row.link || null,
      payload,
      lida_em: row.lida_em || null,
      created_at: row.created_at || null,
      lida: Boolean(row.lida_em)
    };
  }

  static async createForUser(usuarioId, data, db = pool) {
    await this.ensureSchema(db);

    const normalizedUserId = this.normalizeUserId(usuarioId);
    if (!Number.isInteger(normalizedUserId)) {
      return null;
    }

    const tipo = String(data.tipo || 'SISTEMA').trim().toUpperCase().slice(0, 60);
    const titulo = String(data.titulo || 'Notificacao').trim().slice(0, 160);
    const mensagem = String(data.mensagem || '').trim().slice(0, 500);

    if (!mensagem) {
      return null;
    }

    const payloadJson = data.payload ? JSON.stringify(data.payload).slice(0, 4000) : null;

    const [result] = await db.query(
      `
        INSERT INTO notificacoes (
          usuario_id,
          tipo,
          titulo,
          mensagem,
          link,
          payload_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        normalizedUserId,
        tipo,
        titulo || 'Notificacao',
        mensagem,
        data.link ? String(data.link).slice(0, 255) : null,
        payloadJson
      ]
    );

    return this.findByIdForUser(result.insertId, normalizedUserId, db);
  }

  static async createForUsers(usuarioIds, data, db = pool) {
    const uniqueIds = [...new Set(
      (Array.isArray(usuarioIds) ? usuarioIds : [usuarioIds])
        .map((id) => this.normalizeUserId(id))
        .filter((id) => Number.isInteger(id))
    )];

    const created = [];

    for (const usuarioId of uniqueIds) {
      const notification = await this.createForUser(usuarioId, data, db);
      if (notification) {
        created.push(notification);
      }
    }

    return created;
  }

  static async createForSetor(setor, data, options = {}, db = pool) {
    await this.ensureSchema(db);

    const normalizedSetor = normalizeSetor(setor);
    if (!normalizedSetor) {
      return [];
    }

    const ignoredIds = new Set(
      (options.excludeUserIds || [])
        .map((id) => this.normalizeUserId(id))
        .filter((id) => Number.isInteger(id))
    );

    const users = await UsuarioModel.findActiveBySetor(normalizedSetor, db);
    const targetIds = users
      .map((user) => Number(user.id))
      .filter((id) => !ignoredIds.has(id));

    return this.createForUsers(targetIds, data, db);
  }

  static async findByIdForUser(notificationId, usuarioId, db = pool) {
    await this.ensureSchema(db);

    const [rows] = await db.query(
      `
        SELECT
          id,
          usuario_id,
          tipo,
          titulo,
          mensagem,
          link,
          payload_json,
          lida_em,
          created_at
        FROM notificacoes
        WHERE id = ?
          AND usuario_id = ?
        LIMIT 1
      `,
      [notificationId, usuarioId]
    );

    return rows[0] ? this.mapNotification(rows[0]) : null;
  }

  static async listForUser(usuarioId, options = {}, db = pool) {
    await this.ensureSchema(db);

    const normalizedUserId = this.normalizeUserId(usuarioId);
    if (!Number.isInteger(normalizedUserId)) {
      return { notificacoes: [], nao_lidas: 0 };
    }

    const limit = this.normalizeLimit(options.limit);
    const [notifications] = await db.query(
      `
        SELECT
          id,
          usuario_id,
          tipo,
          titulo,
          mensagem,
          link,
          payload_json,
          lida_em,
          created_at
        FROM notificacoes
        WHERE usuario_id = ?
        ORDER BY id DESC
        LIMIT ${limit}
      `,
      [normalizedUserId]
    );

    const [counterRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM notificacoes
        WHERE usuario_id = ?
          AND lida_em IS NULL
      `,
      [normalizedUserId]
    );

    return {
      notificacoes: notifications.map((row) => this.mapNotification(row)),
      nao_lidas: Number(counterRows[0]?.total || 0)
    };
  }

  static async markAsRead(notificationId, usuarioId, db = pool) {
    await this.ensureSchema(db);

    const normalizedUserId = this.normalizeUserId(usuarioId);
    const normalizedNotificationId = this.normalizeUserId(notificationId);
    if (!Number.isInteger(normalizedUserId) || !Number.isInteger(normalizedNotificationId)) {
      return { updated: 0 };
    }

    const [result] = await db.query(
      `
        UPDATE notificacoes
        SET lida_em = COALESCE(lida_em, NOW())
        WHERE id = ?
          AND usuario_id = ?
      `,
      [normalizedNotificationId, normalizedUserId]
    );

    return { updated: Number(result.affectedRows || 0) };
  }

  static async markAllAsRead(usuarioId, db = pool) {
    await this.ensureSchema(db);

    const normalizedUserId = this.normalizeUserId(usuarioId);
    if (!Number.isInteger(normalizedUserId)) {
      return { updated: 0 };
    }

    const [result] = await db.query(
      `
        UPDATE notificacoes
        SET lida_em = COALESCE(lida_em, NOW())
        WHERE usuario_id = ?
          AND lida_em IS NULL
      `,
      [normalizedUserId]
    );

    return { updated: Number(result.affectedRows || 0) };
  }
}

module.exports = NotificacaoModel;
