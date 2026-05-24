const { pool } = require('../../database/connection');

class EtiquetaHistoricoModel {
  static async ensureSchema(db = pool) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS etiqueta_historico_impressao (
        id BIGINT NOT NULL AUTO_INCREMENT,
        id_etiqueta INT NULL,
        id_peca INT NULL,
        codigo_item VARCHAR(80) NOT NULL,
        codigo_pedido VARCHAR(80) NULL,
        numero_serie VARCHAR(40) NULL,
        impressora_nome VARCHAR(160) NULL,
        id_usuario INT NULL,
        usuario_nome VARCHAR(120) NULL,
        dados_pedido_json JSON NULL,
        zpl_gerado MEDIUMTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_etiqueta_historico_etiqueta (id_etiqueta),
        KEY idx_etiqueta_historico_codigo_item (codigo_item),
        KEY idx_etiqueta_historico_pedido (codigo_pedido),
        KEY idx_etiqueta_historico_numero_serie (numero_serie),
        CONSTRAINT fk_etiqueta_historico_etiqueta
          FOREIGN KEY (id_etiqueta) REFERENCES etiquetas (id)
          ON DELETE RESTRICT
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8mb4
        COLLATE = utf8mb4_unicode_ci
    `);

    await db.query(`
      ALTER TABLE etiqueta_historico_impressao
      MODIFY COLUMN id_etiqueta INT NULL,
      MODIFY COLUMN id_peca INT NULL,
      MODIFY COLUMN numero_serie VARCHAR(40) NULL
    `);
  }

  static mapRow(row) {
    return {
      id: Number(row.id),
      id_etiqueta: row.id_etiqueta === null ? null : Number(row.id_etiqueta),
      id_peca: row.id_peca === null ? null : Number(row.id_peca),
      codigo_item: row.codigo_item,
      codigo_pedido: row.codigo_pedido || null,
      numero_serie: row.numero_serie || null,
      impressora_nome: row.impressora_nome || null,
      id_usuario: row.id_usuario === null ? null : Number(row.id_usuario),
      usuario_nome: row.usuario_nome || null,
      dados_pedido_json: typeof row.dados_pedido_json === 'string'
        ? JSON.parse(row.dados_pedido_json)
        : row.dados_pedido_json,
      zpl_gerado: row.zpl_gerado,
      created_at: row.created_at || null
    };
  }

  static async create(data = {}, db = pool) {
    await this.ensureSchema(db);

    const [result] = await db.query(
      `
        INSERT INTO etiqueta_historico_impressao (
          id_etiqueta,
          id_peca,
          codigo_item,
          codigo_pedido,
          numero_serie,
          impressora_nome,
          id_usuario,
          usuario_nome,
          dados_pedido_json,
          zpl_gerado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.id_etiqueta,
        data.id_peca,
        data.codigo_item,
        data.codigo_pedido || null,
        data.numero_serie,
        data.impressora_nome || null,
        data.id_usuario || null,
        data.usuario_nome || null,
        data.dados_pedido_json ? JSON.stringify(data.dados_pedido_json) : null,
        data.zpl_gerado
      ]
    );

    return this.findById(result.insertId, db);
  }

  static async findById(id, db = pool) {
    await this.ensureSchema(db);

    const [rows] = await db.query(
      `
        SELECT *
        FROM etiqueta_historico_impressao
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    return rows[0] ? this.mapRow(rows[0]) : null;
  }
}

module.exports = EtiquetaHistoricoModel;
