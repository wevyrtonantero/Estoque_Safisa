const { pool } = require('../../database/connection');

class ComposicaoVendaModel {
  static async ensureSchema(db = pool) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS composicoes_venda (
        id INT NOT NULL AUTO_INCREMENT,
        id_item_venda INT NOT NULL,
        id_item_atende INT NOT NULL,
        quantidade DECIMAL(10,2) NOT NULL DEFAULT 1,
        ordem INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_composicoes_venda_item (id_item_venda, id_item_atende),
        KEY idx_composicoes_venda_item_venda (id_item_venda),
        KEY idx_composicoes_venda_item_atende (id_item_atende)
      )
    `);
  }

  static buildWhereClause(filters = {}) {
    const conditions = [];
    const params = [];

    if (Number.isInteger(filters.id_item_venda)) {
      conditions.push('cv.id_item_venda = ?');
      params.push(filters.id_item_venda);
    }

    if (Array.isArray(filters.ids_item_venda) && filters.ids_item_venda.length > 0) {
      const ids = filters.ids_item_venda
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value));

      if (ids.length > 0) {
        conditions.push(`cv.id_item_venda IN (${ids.map(() => '?').join(', ')})`);
        params.push(...ids);
      }
    }

    if (filters.q) {
      conditions.push(`(
        pv.codigo LIKE ?
        OR pv.descricao LIKE ?
        OR pa.codigo LIKE ?
        OR pa.descricao LIKE ?
      )`);
      params.push(
        `%${filters.q}%`,
        `%${filters.q}%`,
        `%${filters.q}%`,
        `%${filters.q}%`
      );
    }

    return {
      whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }

  static mapRow(row) {
    return {
      id: Number(row.id),
      id_item_venda: Number(row.id_item_venda),
      item_venda_codigo: row.item_venda_codigo,
      item_venda_descricao: row.item_venda_descricao,
      id_item_atende: Number(row.id_item_atende),
      item_atende_codigo: row.item_atende_codigo,
      item_atende_descricao: row.item_atende_descricao,
      quantidade: Number(row.quantidade),
      ordem: Number(row.ordem || 0),
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  }

  static async findAll(filters = {}, db = pool) {
    const { whereClause, params } = this.buildWhereClause(filters);
    const [rows] = await db.query(
      `
        SELECT
          cv.id,
          cv.id_item_venda,
          cv.id_item_atende,
          cv.quantidade,
          cv.ordem,
          cv.created_at,
          cv.updated_at,
          pv.codigo AS item_venda_codigo,
          pv.descricao AS item_venda_descricao,
          pa.codigo AS item_atende_codigo,
          pa.descricao AS item_atende_descricao
        FROM composicoes_venda cv
        INNER JOIN pecas pv ON pv.id = cv.id_item_venda
        INNER JOIN pecas pa ON pa.id = cv.id_item_atende
        ${whereClause}
        ORDER BY
          pv.codigo ASC,
          cv.ordem ASC,
          pa.codigo ASC
      `,
      params
    );

    return rows.map((row) => this.mapRow(row));
  }

  static async findByItemVenda(idItemVenda, db = pool) {
    return this.findAll({ id_item_venda: Number.parseInt(idItemVenda, 10) }, db);
  }

  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static normalizeInteger(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  static normalizeDecimal(value) {
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  static async findPecaById(id, db = pool) {
    const [rows] = await db.query(
      `
        SELECT id, codigo, descricao, classificacao
        FROM pecas
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async create(data = {}, db = pool) {
    await this.ensureSchema(db);

    const idItemVenda = this.normalizeInteger(data.id_item_venda);
    const idItemAtende = this.normalizeInteger(data.id_item_atende);
    const quantidade = this.normalizeDecimal(data.quantidade);
    const ordem = this.normalizeInteger(data.ordem) ?? 0;

    if (!Number.isInteger(idItemVenda)) {
      throw this.createBusinessError('Selecione um item de venda valido.');
    }

    if (!Number.isInteger(idItemAtende)) {
      throw this.createBusinessError('Selecione um item atendido valido.');
    }

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw this.createBusinessError('Informe uma quantidade valida maior que zero.');
    }

    const [itemVenda, itemAtende] = await Promise.all([
      this.findPecaById(idItemVenda, db),
      this.findPecaById(idItemAtende, db)
    ]);

    if (!itemVenda) {
      throw this.createBusinessError('O item de venda informado nao existe.');
    }

    if (!itemAtende) {
      throw this.createBusinessError('O item atendido informado nao existe.');
    }

    try {
      const [result] = await db.query(
        `
          INSERT INTO composicoes_venda (
            id_item_venda,
            id_item_atende,
            quantidade,
            ordem
          ) VALUES (?, ?, ?, ?)
        `,
        [idItemVenda, idItemAtende, quantidade, ordem]
      );

      const [rows] = await db.query(
        `
          SELECT
            cv.id,
            cv.id_item_venda,
            cv.id_item_atende,
            cv.quantidade,
            cv.ordem,
            cv.created_at,
            cv.updated_at,
            pv.codigo AS item_venda_codigo,
            pv.descricao AS item_venda_descricao,
            pa.codigo AS item_atende_codigo,
            pa.descricao AS item_atende_descricao
          FROM composicoes_venda cv
          INNER JOIN pecas pv ON pv.id = cv.id_item_venda
          INNER JOIN pecas pa ON pa.id = cv.id_item_atende
          WHERE cv.id = ?
          LIMIT 1
        `,
        [result.insertId]
      );

      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        throw this.createBusinessError('Essa composicao ja existe para esse item de venda.');
      }
      throw error;
    }
  }

  static async update(id, data = {}, db = pool) {
    await this.ensureSchema(db);

    const composicaoId = this.normalizeInteger(id);
    const idItemVenda = this.normalizeInteger(data.id_item_venda);
    const idItemAtende = this.normalizeInteger(data.id_item_atende);
    const quantidade = this.normalizeDecimal(data.quantidade);
    const ordem = this.normalizeInteger(data.ordem) ?? 0;

    if (!Number.isInteger(composicaoId)) {
      throw this.createBusinessError('A composicao informada e invalida.');
    }

    if (!Number.isInteger(idItemVenda)) {
      throw this.createBusinessError('Selecione um item de venda valido.');
    }

    if (!Number.isInteger(idItemAtende)) {
      throw this.createBusinessError('Selecione um item atendido valido.');
    }

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw this.createBusinessError('Informe uma quantidade valida maior que zero.');
    }

    const [itemVenda, itemAtende, [existsRows]] = await Promise.all([
      this.findPecaById(idItemVenda, db),
      this.findPecaById(idItemAtende, db),
      db.query('SELECT id FROM composicoes_venda WHERE id = ? LIMIT 1', [composicaoId])
    ]);

    if (!existsRows[0]) {
      throw this.createBusinessError('Composicao de venda nao encontrada.');
    }

    if (!itemVenda) {
      throw this.createBusinessError('O item de venda informado nao existe.');
    }

    if (!itemAtende) {
      throw this.createBusinessError('O item atendido informado nao existe.');
    }

    try {
      await db.query(
        `
          UPDATE composicoes_venda
          SET
            id_item_venda = ?,
            id_item_atende = ?,
            quantidade = ?,
            ordem = ?
          WHERE id = ?
        `,
        [idItemVenda, idItemAtende, quantidade, ordem, composicaoId]
      );

      const [rows] = await db.query(
        `
          SELECT
            cv.id,
            cv.id_item_venda,
            cv.id_item_atende,
            cv.quantidade,
            cv.ordem,
            cv.created_at,
            cv.updated_at,
            pv.codigo AS item_venda_codigo,
            pv.descricao AS item_venda_descricao,
            pa.codigo AS item_atende_codigo,
            pa.descricao AS item_atende_descricao
          FROM composicoes_venda cv
          INNER JOIN pecas pv ON pv.id = cv.id_item_venda
          INNER JOIN pecas pa ON pa.id = cv.id_item_atende
          WHERE cv.id = ?
          LIMIT 1
        `,
        [composicaoId]
      );

      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        throw this.createBusinessError('Essa composicao ja existe para esse item de venda.');
      }
      throw error;
    }
  }

  static async delete(id, db = pool) {
    await this.ensureSchema(db);

    const composicaoId = this.normalizeInteger(id);
    if (!Number.isInteger(composicaoId)) {
      throw this.createBusinessError('A composicao informada e invalida.');
    }

    const [rows] = await db.query(
      `
        SELECT
          cv.id,
          pv.codigo AS item_venda_codigo,
          pa.codigo AS item_atende_codigo
        FROM composicoes_venda cv
        INNER JOIN pecas pv ON pv.id = cv.id_item_venda
        INNER JOIN pecas pa ON pa.id = cv.id_item_atende
        WHERE cv.id = ?
        LIMIT 1
      `,
      [composicaoId]
    );

    const composicao = rows[0] || null;
    if (!composicao) {
      throw this.createBusinessError('Composicao de venda nao encontrada.');
    }

    await db.query('DELETE FROM composicoes_venda WHERE id = ?', [composicaoId]);
    return {
      id: Number(composicao.id),
      item_venda_codigo: composicao.item_venda_codigo,
      item_atende_codigo: composicao.item_atende_codigo
    };
  }
}

module.exports = ComposicaoVendaModel;
