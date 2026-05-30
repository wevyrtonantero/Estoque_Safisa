const { pool } = require('../../database/connection');
const { ALL_ROLES, isValidRole, normalizeRole, ROLES } = require('../security/roles');
const { normalizeSetor, isValidSetor } = require('../security/setores');

class UsuarioModel {
  static normalizeLogin(login) {
    return String(login || '').trim().toLowerCase();
  }

  static sanitize(row) {
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      nome: row.nome,
      login: row.login,
      role: normalizeRole(row.role),
      setor: normalizeSetor(row.setor) || null,
      ativo: Boolean(row.ativo),
      ultimo_login_em: row.ultimo_login_em || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  }

  static async ensureSchema(db = pool) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT NOT NULL AUTO_INCREMENT,
        nome VARCHAR(120) NOT NULL,
        login VARCHAR(80) NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        role ENUM('${ALL_ROLES.join("','")}') NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        ultimo_login_em DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_usuarios_login (login)
      )
    `);

    await this.ensureSetorColumn(db);
  }

  static async ensureSetorColumn(db = pool) {
    const [columns] = await db.query(
      `
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'usuarios'
          AND COLUMN_NAME = 'setor'
        LIMIT 1
      `
    );

    if (!columns.length) {
      await db.query(`
        ALTER TABLE usuarios
        ADD COLUMN setor VARCHAR(40) NULL AFTER role
      `);
    }

    const [indexes] = await db.query(
      `
        SELECT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'usuarios'
          AND INDEX_NAME = 'idx_usuarios_setor'
        LIMIT 1
      `
    );

    if (!indexes.length) {
      await db.query(`
        ALTER TABLE usuarios
        ADD INDEX idx_usuarios_setor (setor)
      `);
    }
  }

  static async hasActiveUsers(db = pool) {
    await this.ensureSchema(db);
    const [rows] = await db.query(`
      SELECT COUNT(*) AS total
      FROM usuarios
      WHERE ativo = 1
    `);

    return Number(rows[0]?.total || 0) > 0;
  }

  static async findById(id, db = pool) {
    await this.ensureSchema(db);
    const [rows] = await db.query(
      `
        SELECT
          id,
          nome,
          login,
          senha_hash,
          role,
          setor,
          ativo,
          ultimo_login_em,
          created_at,
          updated_at
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    return rows[0] ? {
      ...this.sanitize(rows[0]),
      senha_hash: rows[0].senha_hash
    } : null;
  }

  static async findByLogin(login, db = pool) {
    await this.ensureSchema(db);
    const normalizedLogin = this.normalizeLogin(login);
    if (!normalizedLogin) {
      return null;
    }

    const [rows] = await db.query(
      `
        SELECT
          id,
          nome,
          login,
          senha_hash,
          role,
          setor,
          ativo,
          ultimo_login_em,
          created_at,
          updated_at
        FROM usuarios
        WHERE login = ?
        LIMIT 1
      `,
      [normalizedLogin]
    );

    return rows[0] ? {
      ...this.sanitize(rows[0]),
      senha_hash: rows[0].senha_hash
    } : null;
  }

  static async touchLastLogin(id, db = pool) {
    await this.ensureSchema(db);
    await db.query(
      `
        UPDATE usuarios
        SET ultimo_login_em = NOW()
        WHERE id = ?
      `,
      [id]
    );
  }

  static async findAll(filters = {}, db = pool) {
    await this.ensureSchema(db);

    const conditions = [];
    const params = [];

    if (filters.nome) {
      conditions.push('nome LIKE ?');
      params.push(`%${String(filters.nome).trim()}%`);
    }

    if (filters.login) {
      conditions.push('login LIKE ?');
      params.push(`%${this.normalizeLogin(filters.login)}%`);
    }

    if (filters.role) {
      const normalizedRole = normalizeRole(filters.role);
      if (isValidRole(normalizedRole)) {
        conditions.push('role = ?');
        params.push(normalizedRole);
      }
    }

    if (filters.setor) {
      const normalizedSetor = normalizeSetor(filters.setor);
      if (normalizedSetor) {
        conditions.push('setor = ?');
        params.push(normalizedSetor);
      }
    }

    if (filters.ativo === true || filters.ativo === false) {
      conditions.push('ativo = ?');
      params.push(filters.ativo ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db.query(
      `
        SELECT
          id,
          nome,
          login,
          role,
          setor,
          ativo,
          ultimo_login_em,
          created_at,
          updated_at
        FROM usuarios
        ${whereClause}
        ORDER BY nome ASC, login ASC
      `,
      params
    );

    return rows.map((row) => this.sanitize(row));
  }

  static async countActiveSuperadmins(db = pool) {
    await this.ensureSchema(db);
    const [rows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM usuarios
        WHERE ativo = 1
          AND role = ?
      `,
      [ROLES.SUPERADMIN]
    );

    return Number(rows[0]?.total || 0);
  }

  static async findActiveBySetor(setor, db = pool) {
    await this.ensureSchema(db);

    const normalizedSetor = normalizeSetor(setor);
    if (!normalizedSetor) {
      return [];
    }

    const [rows] = await db.query(
      `
        SELECT
          id,
          nome,
          login,
          role,
          setor,
          ativo,
          ultimo_login_em,
          created_at,
          updated_at
        FROM usuarios
        WHERE ativo = 1
          AND setor = ?
        ORDER BY nome ASC, login ASC
      `,
      [normalizedSetor]
    );

    return rows.map((row) => this.sanitize(row));
  }

  static async create({ nome, login, senhaHash, role, setor = null, ativo = true }, db = pool) {
    await this.ensureSchema(db);

    const safeName = String(nome || '').trim();
    const normalizedLogin = this.normalizeLogin(login);
    const normalizedRole = normalizeRole(role);
    const normalizedSetor = setor ? normalizeSetor(setor) : null;

    if (!safeName) {
      throw new Error('O nome do usuario e obrigatorio.');
    }

    if (!normalizedLogin) {
      throw new Error('O login do usuario e obrigatorio.');
    }

    if (!senhaHash) {
      throw new Error('O hash de senha do usuario e obrigatorio.');
    }

    if (!isValidRole(normalizedRole)) {
      throw new Error(`Perfil invalido. Use um destes: ${ALL_ROLES.join(', ')}.`);
    }

    if (setor && !isValidSetor(setor)) {
      throw new Error('Setor invalido para o usuario.');
    }

    const existingUser = await this.findByLogin(normalizedLogin, db);
    if (existingUser) {
      const error = new Error('Ja existe um usuario com este login.');
      error.statusCode = 409;
      throw error;
    }

    const [result] = await db.query(
      `
        INSERT INTO usuarios (
          nome,
          login,
          senha_hash,
          role,
          setor,
          ativo
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [safeName, normalizedLogin, senhaHash, normalizedRole, normalizedSetor, ativo ? 1 : 0]
    );

    return this.findById(result.insertId, db);
  }

  static async update(id, { nome, login, senhaHash, role, setor = null, ativo }, db = pool) {
    await this.ensureSchema(db);
    const existingUser = await this.findById(id, db);

    if (!existingUser) {
      return null;
    }

    const safeName = String(nome || '').trim();
    const normalizedLogin = this.normalizeLogin(login);
    const normalizedRole = normalizeRole(role);
    const normalizedSetor = setor ? normalizeSetor(setor) : null;

    if (!safeName) {
      throw new Error('O nome do usuario e obrigatorio.');
    }

    if (!normalizedLogin) {
      throw new Error('O login do usuario e obrigatorio.');
    }

    if (!isValidRole(normalizedRole)) {
      throw new Error(`Perfil invalido. Use um destes: ${ALL_ROLES.join(', ')}.`);
    }

    if (setor && !isValidSetor(setor)) {
      throw new Error('Setor invalido para o usuario.');
    }

    const loginOwner = await this.findByLogin(normalizedLogin, db);
    if (loginOwner && loginOwner.id !== Number(id)) {
      const error = new Error('Ja existe um usuario com este login.');
      error.statusCode = 409;
      throw error;
    }

    await db.query(
      `
        UPDATE usuarios
        SET nome = ?, login = ?, senha_hash = ?, role = ?, setor = ?, ativo = ?
        WHERE id = ?
      `,
      [
        safeName,
        normalizedLogin,
        senhaHash || existingUser.senha_hash,
        normalizedRole,
        normalizedSetor,
        ativo ? 1 : 0,
        id
      ]
    );

    return this.findById(id, db);
  }

  static async delete(id, db = pool) {
    await this.ensureSchema(db);
    const [result] = await db.query(
      `
        DELETE FROM usuarios
        WHERE id = ?
      `,
      [id]
    );

    return result.affectedRows > 0;
  }

  static async upsertUser({ nome, login, senhaHash, role, setor = null, ativo = true }, db = pool) {
    await this.ensureSchema(db);

    const normalizedLogin = this.normalizeLogin(login);
    const normalizedRole = normalizeRole(role);
    const normalizedSetor = setor ? normalizeSetor(setor) : null;
    const safeName = String(nome || '').trim();

    if (!safeName) {
      throw new Error('O nome do usuario e obrigatorio.');
    }

    if (!normalizedLogin) {
      throw new Error('O login do usuario e obrigatorio.');
    }

    if (!senhaHash) {
      throw new Error('O hash de senha do usuario e obrigatorio.');
    }

    if (!isValidRole(normalizedRole)) {
      throw new Error(`Perfil invalido. Use um destes: ${ALL_ROLES.join(', ')}.`);
    }

    if (setor && !isValidSetor(setor)) {
      throw new Error('Setor invalido para o usuario.');
    }

    const [existingRows] = await db.query(
      `
        SELECT id
        FROM usuarios
        WHERE login = ?
        LIMIT 1
      `,
      [normalizedLogin]
    );

    if (existingRows.length > 0) {
      await db.query(
        `
          UPDATE usuarios
          SET nome = ?, senha_hash = ?, role = ?, setor = ?, ativo = ?
          WHERE id = ?
        `,
        [safeName, senhaHash, normalizedRole, normalizedSetor, ativo ? 1 : 0, existingRows[0].id]
      );

      return Number(existingRows[0].id);
    }

    const [result] = await db.query(
      `
        INSERT INTO usuarios (
          nome,
          login,
          senha_hash,
          role,
          setor,
          ativo
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [safeName, normalizedLogin, senhaHash, normalizedRole, normalizedSetor, ativo ? 1 : 0]
    );

    return Number(result.insertId);
  }
}

module.exports = UsuarioModel;
