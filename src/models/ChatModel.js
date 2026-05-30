const { pool } = require('../../database/connection');
const UsuarioModel = require('./UsuarioModel');

class ChatModel {
  static MAX_MESSAGE_LENGTH = 1000;
  static PRESENCE_WINDOW_SECONDS = 120;

  static async ensureSchema(db = pool) {
    await UsuarioModel.ensureSchema(db);
    await this.ensurePresenceSchema(db);

    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_conversas (
        id INT NOT NULL AUTO_INCREMENT,
        usuario_a_id INT NOT NULL,
        usuario_b_id INT NOT NULL,
        ultima_mensagem_em DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT chk_chat_conversas_participantes CHECK (usuario_a_id <> usuario_b_id),
        CONSTRAINT fk_chat_conversas_usuario_a
          FOREIGN KEY (usuario_a_id) REFERENCES usuarios(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_chat_conversas_usuario_b
          FOREIGN KEY (usuario_b_id) REFERENCES usuarios(id)
          ON DELETE CASCADE,
        UNIQUE KEY uniq_chat_conversas_participantes (usuario_a_id, usuario_b_id),
        KEY idx_chat_conversas_ultima_mensagem (ultima_mensagem_em)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_mensagens (
        id INT NOT NULL AUTO_INCREMENT,
        conversa_id INT NOT NULL,
        remetente_id INT NOT NULL,
        destinatario_id INT NOT NULL,
        conteudo TEXT NOT NULL,
        lida_em DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_chat_mensagens_conversa
          FOREIGN KEY (conversa_id) REFERENCES chat_conversas(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_chat_mensagens_remetente
          FOREIGN KEY (remetente_id) REFERENCES usuarios(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_chat_mensagens_destinatario
          FOREIGN KEY (destinatario_id) REFERENCES usuarios(id)
          ON DELETE CASCADE,
        KEY idx_chat_mensagens_conversa (conversa_id, created_at, id),
        KEY idx_chat_mensagens_destinatario_lida (destinatario_id, lida_em, created_at),
        KEY idx_chat_mensagens_remetente (remetente_id, created_at)
      )
    `);
  }

  static async ensurePresenceSchema(db = pool) {
    const [columns] = await db.query(
      `
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'usuarios'
          AND COLUMN_NAME = 'chat_online_em'
        LIMIT 1
      `
    );

    if (!columns.length) {
      await db.query(`
        ALTER TABLE usuarios
        ADD COLUMN chat_online_em DATETIME NULL
      `);
    }

    const [indexes] = await db.query(
      `
        SELECT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'usuarios'
          AND INDEX_NAME = 'idx_usuarios_chat_online_em'
        LIMIT 1
      `
    );

    if (!indexes.length) {
      await db.query(`
        ALTER TABLE usuarios
        ADD INDEX idx_usuarios_chat_online_em (chat_online_em)
      `);
    }
  }

  static createBusinessError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  }

  static normalizeUserId(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
  }

  static normalizeMessageContent(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, this.MAX_MESSAGE_LENGTH);
  }

  static orderParticipants(userIdA, userIdB) {
    return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
  }

  static async ensureTargetUser(currentUserId, otherUserId, db = pool) {
    const normalizedCurrent = this.normalizeUserId(currentUserId);
    const normalizedOther = this.normalizeUserId(otherUserId);

    if (!Number.isInteger(normalizedCurrent)) {
      throw this.createBusinessError('Usuario atual invalido.', 401);
    }

    if (!Number.isInteger(normalizedOther)) {
      throw this.createBusinessError('Usuario de conversa invalido.');
    }

    if (normalizedCurrent === normalizedOther) {
      throw this.createBusinessError('Nao e permitido criar conversa com o proprio usuario.');
    }

    const targetUser = await UsuarioModel.findById(normalizedOther, db);
    if (!targetUser || !targetUser.ativo) {
      throw this.createBusinessError('O usuario selecionado nao esta disponivel.', 404);
    }

    return targetUser;
  }

  static async getConversationId(userIdA, userIdB, db = pool) {
    const [participantA, participantB] = this.orderParticipants(userIdA, userIdB);
    const [rows] = await db.query(
      `
        SELECT id
        FROM chat_conversas
        WHERE usuario_a_id = ?
          AND usuario_b_id = ?
        LIMIT 1
      `,
      [participantA, participantB]
    );

    return rows[0] ? Number(rows[0].id) : null;
  }

  static async ensureConversation(currentUserId, otherUserId, connection) {
    const [participantA, participantB] = this.orderParticipants(currentUserId, otherUserId);

    await connection.query(
      `
        INSERT IGNORE INTO chat_conversas (
          usuario_a_id,
          usuario_b_id
        ) VALUES (?, ?)
      `,
      [participantA, participantB]
    );

    const [rows] = await connection.query(
      `
        SELECT id
        FROM chat_conversas
        WHERE usuario_a_id = ?
          AND usuario_b_id = ?
        LIMIT 1
      `,
      [participantA, participantB]
    );

    if (!rows[0]?.id) {
      throw this.createBusinessError('Nao foi possivel preparar a conversa.', 500);
    }

    return Number(rows[0].id);
  }

  static mapMessage(row, currentUserId) {
    return {
      id: Number(row.id),
      conversa_id: Number(row.conversa_id),
      remetente_id: Number(row.remetente_id),
      destinatario_id: Number(row.destinatario_id),
      conteudo: row.conteudo,
      lida_em: row.lida_em || null,
      created_at: row.created_at || null,
      mine: Number(row.remetente_id) === Number(currentUserId)
    };
  }

  static async listUsers(currentUserId, db = pool) {
    await this.ensureSchema(db);

    const [rows] = await db.query(
      `
        SELECT
          u.id,
          u.nome,
          u.login,
          u.role,
          u.chat_online_em,
          CASE
            WHEN u.chat_online_em IS NOT NULL
              AND u.chat_online_em >= DATE_SUB(NOW(), INTERVAL ${this.PRESENCE_WINDOW_SECONDS} SECOND)
            THEN 1
            ELSE 0
          END AS chat_online,
          c.id AS conversa_id,
          (
            SELECT m.id
            FROM chat_mensagens m
            WHERE m.conversa_id = c.id
            ORDER BY m.id DESC
            LIMIT 1
          ) AS ultima_mensagem_id,
          (
            SELECT m.conteudo
            FROM chat_mensagens m
            WHERE m.conversa_id = c.id
            ORDER BY m.id DESC
            LIMIT 1
          ) AS ultima_mensagem_preview,
          (
            SELECT m.created_at
            FROM chat_mensagens m
            WHERE m.conversa_id = c.id
            ORDER BY m.id DESC
            LIMIT 1
          ) AS ultima_mensagem_em,
          (
            SELECT m.remetente_id
            FROM chat_mensagens m
            WHERE m.conversa_id = c.id
            ORDER BY m.id DESC
            LIMIT 1
          ) AS ultima_mensagem_remetente_id,
          (
            SELECT COUNT(*)
            FROM chat_mensagens m
            WHERE m.conversa_id = c.id
              AND m.destinatario_id = ?
              AND m.lida_em IS NULL
          ) AS nao_lidas
        FROM usuarios u
        LEFT JOIN chat_conversas c
          ON (
            (c.usuario_a_id = ? AND c.usuario_b_id = u.id)
            OR (c.usuario_b_id = ? AND c.usuario_a_id = u.id)
          )
        WHERE u.ativo = 1
          AND u.id <> ?
        ORDER BY
          nao_lidas DESC,
          chat_online DESC,
          ultima_mensagem_em DESC,
          u.nome ASC,
          u.login ASC
      `,
      [currentUserId, currentUserId, currentUserId, currentUserId]
    );

    return rows.map((row) => ({
      id: Number(row.id),
      nome: row.nome,
      login: row.login,
      role: row.role,
      chat_online_em: row.chat_online_em || null,
      chat_online: Number(row.chat_online || 0) === 1,
      conversa_id: row.conversa_id ? Number(row.conversa_id) : null,
      ultima_mensagem_id: row.ultima_mensagem_id ? Number(row.ultima_mensagem_id) : null,
      ultima_mensagem_preview: row.ultima_mensagem_preview || null,
      ultima_mensagem_em: row.ultima_mensagem_em || null,
      ultima_mensagem_remetente_id: row.ultima_mensagem_remetente_id ? Number(row.ultima_mensagem_remetente_id) : null,
      nao_lidas: Number(row.nao_lidas || 0)
    }));
  }

  static async touchPresence(currentUserId, db = pool) {
    await this.ensureSchema(db);

    const normalizedUserId = this.normalizeUserId(currentUserId);
    if (!Number.isInteger(normalizedUserId)) {
      throw this.createBusinessError('Usuario atual invalido.', 401);
    }

    await db.query(
      `
        UPDATE usuarios
        SET chat_online_em = NOW()
        WHERE id = ?
          AND ativo = 1
      `,
      [normalizedUserId]
    );

    return { online: true };
  }

  static async getConversation(currentUserId, otherUserId, db = pool) {
    await this.ensureSchema(db);

    const targetUser = await this.ensureTargetUser(currentUserId, otherUserId, db);
    const conversationId = await this.getConversationId(currentUserId, otherUserId, db);

    if (!conversationId) {
      return {
        usuario: {
          id: targetUser.id,
          nome: targetUser.nome,
          login: targetUser.login,
          role: targetUser.role
        },
        conversa_id: null,
        mensagens: []
      };
    }

    const [rows] = await db.query(
      `
        SELECT
          id,
          conversa_id,
          remetente_id,
          destinatario_id,
          conteudo,
          lida_em,
          created_at
        FROM chat_mensagens
        WHERE conversa_id = ?
        ORDER BY created_at ASC, id ASC
      `,
      [conversationId]
    );

    return {
      usuario: {
        id: targetUser.id,
        nome: targetUser.nome,
        login: targetUser.login,
        role: targetUser.role
      },
      conversa_id: conversationId,
      mensagens: rows.map((row) => this.mapMessage(row, currentUserId))
    };
  }

  static async sendMessage(currentUserId, otherUserId, content) {
    await this.ensureSchema();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const targetUser = await this.ensureTargetUser(currentUserId, otherUserId, connection);
      const normalizedContent = this.normalizeMessageContent(content);

      if (!normalizedContent) {
        throw this.createBusinessError('A mensagem nao pode estar vazia.');
      }

      const conversationId = await this.ensureConversation(currentUserId, otherUserId, connection);

      const [result] = await connection.query(
        `
          INSERT INTO chat_mensagens (
            conversa_id,
            remetente_id,
            destinatario_id,
            conteudo
          ) VALUES (?, ?, ?, ?)
        `,
        [conversationId, currentUserId, targetUser.id, normalizedContent]
      );

      await connection.query(
        `
          UPDATE chat_conversas
          SET ultima_mensagem_em = NOW()
          WHERE id = ?
        `,
        [conversationId]
      );

      const [messageRows] = await connection.query(
        `
          SELECT
            id,
            conversa_id,
            remetente_id,
            destinatario_id,
            conteudo,
            lida_em,
            created_at
          FROM chat_mensagens
          WHERE id = ?
          LIMIT 1
        `,
        [result.insertId]
      );

      await connection.commit();

      return {
        usuario: {
          id: targetUser.id,
          nome: targetUser.nome,
          login: targetUser.login,
          role: targetUser.role
        },
        mensagem: this.mapMessage(messageRows[0], currentUserId)
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async markConversationAsRead(currentUserId, otherUserId, db = pool) {
    await this.ensureSchema(db);
    await this.ensureTargetUser(currentUserId, otherUserId, db);

    const conversationId = await this.getConversationId(currentUserId, otherUserId, db);
    if (!conversationId) {
      return { updated: 0 };
    }

    const [result] = await db.query(
      `
        UPDATE chat_mensagens
        SET lida_em = NOW()
        WHERE conversa_id = ?
          AND remetente_id = ?
          AND destinatario_id = ?
          AND lida_em IS NULL
      `,
      [conversationId, otherUserId, currentUserId]
    );

    return {
      updated: Number(result.affectedRows || 0)
    };
  }
}

module.exports = ChatModel;
