const { pool } = require('../../database/connection');
const { getDefaultLayoutJson, getDefaultSemKitLayoutJson } = require('../services/EtiquetaZplService');

class EtiquetaModel {
  static getCategories() {
    return {
      SERVO_COM_KIT: 'SERVO_COM_KIT',
      SERVO_SEM_KIT: 'SERVO_SEM_KIT',
      ITEM_AVULSO: 'ITEM_AVULSO',
      CAIXA: 'CAIXA'
    };
  }

  static inferCategory(data = {}) {
    const categories = this.getCategories();
    const explicit = String(data.categoria || '').trim().toUpperCase();
    if (Object.values(categories).includes(explicit)) {
      return explicit;
    }

    const linha2 = String(data.aplicacao_linha_2 || '').trim().toUpperCase();
    if (linha2 === 'SEM KIT DE INSTALACAO') {
      return categories.SERVO_SEM_KIT;
    }

    return categories.SERVO_COM_KIT;
  }

  static async ensureSchema(db = pool) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS etiquetas (
        id INT NOT NULL AUTO_INCREMENT,
        id_peca INT NOT NULL,
        codigo_item VARCHAR(80) NOT NULL,
        categoria VARCHAR(40) NOT NULL DEFAULT 'SERVO_COM_KIT',
        titulo VARCHAR(160) NOT NULL,
        aplicacao_linha_1 VARCHAR(255) NOT NULL,
        aplicacao_linha_2 VARCHAR(255) NULL,
        aplicacao_linha_3 VARCHAR(255) NULL,
        codigo_barras VARCHAR(160) NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        layout_json JSON NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_etiquetas_id_peca (id_peca),
        UNIQUE KEY uq_etiquetas_codigo_item (codigo_item),
        KEY idx_etiquetas_categoria (categoria),
        KEY idx_etiquetas_ativo (ativo),
        CONSTRAINT fk_etiquetas_peca
          FOREIGN KEY (id_peca) REFERENCES pecas (id)
          ON DELETE RESTRICT
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8mb4
        COLLATE = utf8mb4_unicode_ci
    `);

    const [categoriaColumns] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'etiquetas'
          AND COLUMN_NAME = 'categoria'
      `
    );

    if (Number(categoriaColumns[0]?.total || 0) === 0) {
      await db.query(`
        ALTER TABLE etiquetas
        ADD COLUMN categoria VARCHAR(40) NOT NULL DEFAULT 'SERVO_COM_KIT' AFTER codigo_item
      `);
    }

    const [categoriaIndexes] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'etiquetas'
          AND INDEX_NAME = 'idx_etiquetas_categoria'
      `
    );

    if (Number(categoriaIndexes[0]?.total || 0) === 0) {
      await db.query(`
        ALTER TABLE etiquetas
        ADD INDEX idx_etiquetas_categoria (categoria)
      `);
    }

    await db.query(`
      UPDATE etiquetas
      SET categoria = CASE
        WHEN UPPER(COALESCE(aplicacao_linha_2, '')) = 'SEM KIT DE INSTALACAO' THEN 'SERVO_SEM_KIT'
        ELSE 'SERVO_COM_KIT'
      END
      WHERE categoria IS NULL
         OR categoria = ''
         OR categoria = 'SERVO_COM_KIT'
    `);

    await this.seedDefaults(db);
  }

  static mapRow(row) {
    return {
      id: Number(row.id),
      id_peca: Number(row.id_peca),
      codigo_item: row.codigo_item,
      categoria: row.categoria || this.getCategories().SERVO_COM_KIT,
      titulo: row.titulo,
      aplicacao_linha_1: row.aplicacao_linha_1,
      aplicacao_linha_2: row.aplicacao_linha_2 || '',
      aplicacao_linha_3: row.aplicacao_linha_3 || '',
      codigo_barras: row.codigo_barras,
      ativo: Number(row.ativo || 0) === 1,
      layout_json: typeof row.layout_json === 'string' ? JSON.parse(row.layout_json) : row.layout_json,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  }

  static async findPecaByCodigo(codigoItem, db = pool) {
    const codigoNormalizado = String(codigoItem || '').trim().toUpperCase();
    const tentativas = [codigoNormalizado];
    if (codigoNormalizado && !codigoNormalizado.startsWith('SM-')) {
      tentativas.push(`SM-${codigoNormalizado}`);
    }

    for (const tentativa of tentativas) {
      const [rows] = await db.query(
        `
          SELECT
            id,
            codigo,
            descricao,
            classificacao
          FROM pecas
          WHERE codigo = ?
            AND classificacao IN ('ITEM', 'SUBMONTAGEM')
          LIMIT 1
        `,
        [tentativa]
      );

      const row = rows[0] || null;
      if (!row) {
        continue;
      }

      return {
        id: Number(row.id),
        codigo: row.codigo,
        descricao: row.descricao,
        classificacao: row.classificacao
      };
    }

    return null;
  }

  static async findAll(filters = {}, db = pool) {
    await this.ensureSchema(db);

    const conditions = ['1 = 1'];
    const params = [];

    if (filters.codigo_item) {
      conditions.push('e.codigo_item LIKE ?');
      params.push(`%${filters.codigo_item}%`);
    }

    if (filters.categoria) {
      conditions.push('e.categoria = ?');
      params.push(String(filters.categoria).trim().toUpperCase());
    }

    if (filters.ativo === true) {
      conditions.push('e.ativo = 1');
    } else if (filters.ativo === false) {
      conditions.push('e.ativo = 0');
    }

    const [rows] = await db.query(
      `
        SELECT
          e.*
        FROM etiquetas e
        WHERE ${conditions.join(' AND ')}
        ORDER BY e.codigo_item ASC
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
        FROM etiquetas
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  static async findByCodigo(codigoItem, db = pool) {
    await this.ensureSchema(db);
    const codigoNormalizado = String(codigoItem || '').trim().toUpperCase();
    const tentativas = [codigoNormalizado];
    if (codigoNormalizado && !codigoNormalizado.startsWith('SM-')) {
      tentativas.push(`SM-${codigoNormalizado}`);
    }

    for (const tentativa of tentativas) {
      const [rows] = await db.query(
        `
          SELECT *
          FROM etiquetas
          WHERE codigo_item = ?
          LIMIT 1
        `,
        [tentativa]
      );

      if (rows[0]) {
        return this.mapRow(rows[0]);
      }
    }

    return null;
  }

  static async findActiveByCodigo(codigoItem, db = pool) {
    await this.ensureSchema(db);
    const codigoNormalizado = String(codigoItem || '').trim().toUpperCase();
    const tentativas = [codigoNormalizado];
    if (codigoNormalizado && !codigoNormalizado.startsWith('SM-')) {
      tentativas.push(`SM-${codigoNormalizado}`);
    }

    for (const tentativa of tentativas) {
      const [rows] = await db.query(
        `
          SELECT *
          FROM etiquetas
          WHERE codigo_item = ?
            AND ativo = 1
          LIMIT 1
        `,
        [tentativa]
      );

      if (rows[0]) {
        return this.mapRow(rows[0]);
      }
    }

    return null;
  }

  static normalizePayload(data = {}) {
    const layoutJson = typeof data.layout_json === 'object' && data.layout_json !== null
      ? data.layout_json
      : getDefaultLayoutJson();

    return {
      codigo_item: String(data.codigo_item || '').trim().toUpperCase(),
      categoria: this.inferCategory(data),
      titulo: String(data.titulo || '').trim(),
      aplicacao_linha_1: String(data.aplicacao_linha_1 || '').trim(),
      aplicacao_linha_2: String(data.aplicacao_linha_2 || '').trim(),
      aplicacao_linha_3: String(data.aplicacao_linha_3 || '').trim(),
      codigo_barras: String(data.codigo_barras || '').trim(),
      ativo: data.ativo === undefined ? true : Boolean(data.ativo),
      layout_json: layoutJson
    };
  }

  static validatePayload(payload) {
    const errors = [];

    if (!payload.codigo_item) {
      errors.push('O codigo_item e obrigatorio.');
    }

    if (!payload.titulo) {
      errors.push('O titulo da etiqueta e obrigatorio.');
    }

    if (!Object.values(this.getCategories()).includes(payload.categoria)) {
      errors.push('A categoria da etiqueta e invalida.');
    }

    if (!payload.codigo_barras) {
      errors.push('O codigo de barras e obrigatorio.');
    }

    if (!payload.layout_json || typeof payload.layout_json !== 'object') {
      errors.push('O layout_json deve ser um objeto valido.');
    }

    return errors;
  }

  static async create(data = {}, db = pool) {
    await this.ensureSchema(db);

    const payload = this.normalizePayload(data);
    const errors = this.validatePayload(payload);
    if (errors.length > 0) {
      const error = new Error('Dados invalidos para criar a etiqueta.');
      error.statusCode = 400;
      error.details = errors;
      throw error;
    }

    const peca = await this.findPecaByCodigo(payload.codigo_item, db);
    if (!peca) {
      const error = new Error('O codigo_item informado nao existe no cadastro de pecas/submontagens.');
      error.statusCode = 400;
      throw error;
    }

    const [result] = await db.query(
      `
        INSERT INTO etiquetas (
          id_peca,
          codigo_item,
          categoria,
          titulo,
          aplicacao_linha_1,
          aplicacao_linha_2,
          aplicacao_linha_3,
          codigo_barras,
          ativo,
          layout_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        peca.id,
        peca.codigo,
        payload.categoria,
        payload.titulo,
        payload.aplicacao_linha_1,
        payload.aplicacao_linha_2 || null,
        payload.aplicacao_linha_3 || null,
        payload.codigo_barras,
        payload.ativo ? 1 : 0,
        JSON.stringify(payload.layout_json)
      ]
    );

    return this.findById(result.insertId, db);
  }

  static async update(id, data = {}, db = pool) {
    await this.ensureSchema(db);

    const atual = await this.findById(id, db);
    if (!atual) {
      return null;
    }

    const payload = this.normalizePayload({
      ...atual,
      ...data
    });
    const errors = this.validatePayload(payload);
    if (errors.length > 0) {
      const error = new Error('Dados invalidos para atualizar a etiqueta.');
      error.statusCode = 400;
      error.details = errors;
      throw error;
    }

    const peca = await this.findPecaByCodigo(payload.codigo_item, db);
    if (!peca) {
      const error = new Error('O codigo_item informado nao existe no cadastro de pecas/submontagens.');
      error.statusCode = 400;
      throw error;
    }

    await db.query(
      `
        UPDATE etiquetas
        SET
          id_peca = ?,
          codigo_item = ?,
          categoria = ?,
          titulo = ?,
          aplicacao_linha_1 = ?,
          aplicacao_linha_2 = ?,
          aplicacao_linha_3 = ?,
          codigo_barras = ?,
          ativo = ?,
          layout_json = ?
        WHERE id = ?
      `,
      [
        peca.id,
        peca.codigo,
        payload.categoria,
        payload.titulo,
        payload.aplicacao_linha_1,
        payload.aplicacao_linha_2 || null,
        payload.aplicacao_linha_3 || null,
        payload.codigo_barras,
        payload.ativo ? 1 : 0,
        JSON.stringify(payload.layout_json),
        id
      ]
    );

    return this.findById(id, db);
  }

  static async updateStatus(id, ativo, db = pool) {
    await this.ensureSchema(db);

    await db.query(
      `
        UPDATE etiquetas
        SET ativo = ?
        WHERE id = ?
      `,
      [ativo ? 1 : 0, id]
    );

    return this.findById(id, db);
  }

  static async upsertByCodigo(data = {}, db = pool) {
    await this.ensureSchema(db);

    const payload = this.normalizePayload(data);
    const existente = await this.findByCodigo(payload.codigo_item, db);
    if (existente) {
      return this.update(existente.id, {
        ...existente,
        ...payload,
        layout_json: data.layout_json || existente.layout_json
      }, db);
    }

    return this.create(payload, db);
  }

  static async replicateLayoutToCategory(sourceId, db = pool) {
    await this.ensureSchema(db);

    const origem = await this.findById(sourceId, db);
    if (!origem) {
      return null;
    }

    await db.query(
      `
        UPDATE etiquetas
        SET layout_json = ?
        WHERE id <> ?
          AND categoria = ?
      `,
      [JSON.stringify(origem.layout_json), sourceId, origem.categoria]
    );

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM etiquetas
        WHERE id <> ?
          AND categoria = ?
      `,
      [sourceId, origem.categoria]
    );

    return {
      origem,
      replicated_count: Number(countRows[0]?.total || 0)
    };
  }

  static async seedDefaults(db = pool) {
    const seeds = [
      {
        codigo_item: '1F',
        categoria: this.getCategories().SERVO_COM_KIT,
        titulo: 'MBF015 - 1F',
        aplicacao_linha_1: 'Mercedes Benz - Caminhao',
        aplicacao_linha_2: 'Cara Chata 1214/1218/1418/1714/1718',
        aplicacao_linha_3: '2318/2418',
        codigo_barras: '789976744814',
        ativo: true,
        layout_json: getDefaultLayoutJson()
      },
      {
        codigo_item: 'MBF015',
        categoria: this.getCategories().SERVO_SEM_KIT,
        titulo: 'MBF015',
        aplicacao_linha_1: '',
        aplicacao_linha_2: 'SEM KIT DE INSTALACAO',
        aplicacao_linha_3: '',
        codigo_barras: '789976744892',
        ativo: true,
        layout_json: getDefaultSemKitLayoutJson()
      }
    ];

    let firstSeed = null;
    for (const seed of seeds) {
      const [existingRows] = await db.query(
        `
          SELECT *
          FROM etiquetas
          WHERE codigo_item = ?
          LIMIT 1
        `,
        [seed.codigo_item]
      );

      if (existingRows[0]) {
        firstSeed ||= this.mapRow(existingRows[0]);
        continue;
      }

      const peca = await this.findPecaByCodigo(seed.codigo_item, db);
      if (!peca) {
        continue;
      }

      const [result] = await db.query(
        `
          INSERT INTO etiquetas (
            id_peca,
            codigo_item,
            titulo,
            aplicacao_linha_1,
            aplicacao_linha_2,
            aplicacao_linha_3,
            codigo_barras,
            ativo,
            layout_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          peca.id,
          seed.codigo_item,
          seed.titulo,
          seed.aplicacao_linha_1 ?? '',
          seed.aplicacao_linha_2 || null,
          seed.aplicacao_linha_3 || null,
          seed.codigo_barras,
          seed.ativo ? 1 : 0,
          JSON.stringify(seed.layout_json)
        ]
      );

      const created = await this.findById(result.insertId, db);
      firstSeed ||= created;
    }

    return firstSeed;
  }
}

module.exports = EtiquetaModel;
