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
}

module.exports = ComposicaoVendaModel;
