const { pool } = require('../../database/connection');

class KanbanEstoqueModel {
  static async ensureSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kanban_estoque_categorias (
        id INT NOT NULL AUTO_INCREMENT,
        nome VARCHAR(100) NOT NULL,
        ordem INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_kanban_categoria_nome (nome),
        KEY idx_kanban_categoria_ordem (ordem)
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8mb4
        COLLATE = utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS kanban_estoque_itens (
        id INT NOT NULL AUTO_INCREMENT,
        id_categoria INT NOT NULL,
        id_peca INT NOT NULL,
        quantidade_pacote DECIMAL(10, 2) NOT NULL DEFAULT 50,
        ordem INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_kanban_categoria_peca (id_categoria, id_peca),
        KEY idx_kanban_item_categoria_ordem (id_categoria, ordem),
        KEY idx_kanban_item_peca (id_peca),
        CONSTRAINT fk_kanban_item_categoria
          FOREIGN KEY (id_categoria) REFERENCES kanban_estoque_categorias (id)
          ON DELETE CASCADE,
        CONSTRAINT fk_kanban_item_peca
          FOREIGN KEY (id_peca) REFERENCES pecas (id)
          ON DELETE CASCADE,
        CONSTRAINT chk_kanban_quantidade_pacote CHECK (quantidade_pacote > 0)
      ) ENGINE = InnoDB
        DEFAULT CHARSET = utf8mb4
        COLLATE = utf8mb4_unicode_ci
    `);
  }

  static async listBoard() {
    const [categorias] = await pool.query(`
      SELECT id, nome, ordem, created_at, updated_at
      FROM kanban_estoque_categorias
      ORDER BY ordem ASC, nome ASC
    `);

    const [itens] = await pool.query(`
      SELECT
        ki.id,
        ki.id_categoria,
        ki.id_peca,
        ki.quantidade_pacote,
        ki.ordem,
        p.codigo,
        p.descricao,
        p.tipo,
        p.classificacao,
        p.estoque_minimo AS quantidade_pacote_cadastro,
        p.consumo_mensal AS consumo_mensal_cadastro,
        COALESCE(s.almoxarifado, 0) AS quantidade_almoxarifado,
        COALESCE(s.montagem, 0) AS quantidade_montagem,
        COALESCE(s.expedicao, 0) AS quantidade_expedicao,
        COALESCE(s.almoxarifado, 0) + COALESCE(s.montagem, 0) + COALESCE(s.expedicao, 0) AS quantidade_estoque_empresa,
        GREATEST(
          COALESCE(s.almoxarifado, 0)
          + COALESCE(s.montagem, 0)
          + COALESCE(s.expedicao, 0)
          - COALESCE(d.quantidade_pedidos_abertos, 0),
          0
        ) AS quantidade_saldo_disponivel,
        COALESCE(prod.quantidade_ordens, 0) AS quantidade_producao_ordens,
        COALESCE(te.quantidade_fila, 0) AS quantidade_fila_tratamento,
        COALESCE(prod.quantidade_ordens, 0) + COALESCE(te.quantidade_fila, 0) AS quantidade_producao,
        COALESCE(rem.quantidade_pendente, 0) AS quantidade_tratamento_externo,
        COALESCE(d.quantidade_pedidos_abertos, 0) AS quantidade_pedidos_abertos,
        CASE
          WHEN COALESCE(p.consumo_mensal, 0) > 0
            THEN ROUND(
              GREATEST(
                COALESCE(s.almoxarifado, 0)
                + COALESCE(s.montagem, 0)
                + COALESCE(s.expedicao, 0)
                - COALESCE(d.quantidade_pedidos_abertos, 0),
                0
              ) / (p.consumo_mensal / 30),
              0
            )
          ELSE NULL
        END AS duracao_estimada_dias
      FROM kanban_estoque_itens ki
      INNER JOIN pecas p ON p.id = ki.id_peca
      LEFT JOIN (
        SELECT
          es.id_peca,
          SUM(CASE WHEN e.nome = 'Almoxarifado' THEN es.quantidade ELSE 0 END) AS almoxarifado,
          SUM(CASE WHEN e.nome = 'Montagem' THEN es.quantidade ELSE 0 END) AS montagem,
          SUM(CASE WHEN e.nome = 'Expedição' THEN es.quantidade ELSE 0 END) AS expedicao
        FROM estoque_saldos es
        INNER JOIN estoques e ON e.id = es.id_estoque
        GROUP BY es.id_peca
      ) s ON s.id_peca = ki.id_peca
      LEFT JOIN (
        SELECT id_peca, SUM(quantidade_planejada) AS quantidade_ordens
        FROM producao_ordens
        WHERE status = 'EM_ANDAMENTO'
        GROUP BY id_peca
      ) prod ON prod.id_peca = ki.id_peca
      LEFT JOIN (
        SELECT id_peca, SUM(quantidade) AS quantidade_fila
        FROM tratamento_externo_saldos
        WHERE quantidade > 0
        GROUP BY id_peca
      ) te ON te.id_peca = ki.id_peca
      LEFT JOIN (
        SELECT
          ri.id_peca,
          SUM(GREATEST(ri.quantidade_enviada - ri.quantidade_retorno, 0)) AS quantidade_pendente
        FROM terceirizacao_remessa_itens ri
        INNER JOIN terceirizacao_remessas r ON r.id = ri.id_remessa
        WHERE r.status IN ('ENVIADA', 'RETORNO_PARCIAL')
          AND ri.status IN ('ENVIADO', 'RETORNO_PARCIAL')
          AND COALESCE(ri.encerrado_manualmente, 0) = 0
          AND ri.quantidade_enviada > ri.quantidade_retorno
        GROUP BY ri.id_peca
      ) rem ON rem.id_peca = ki.id_peca
      LEFT JOIN (
        SELECT
          demanda.id_peca,
          SUM(demanda.quantidade) AS quantidade_pedidos_abertos
        FROM (
          SELECT
            COALESCE(cv.id_item_atende, pei.id_peca) AS id_peca,
            pei.quantidade * COALESCE(cv.quantidade, 1) AS quantidade
          FROM pedidos_expedicao pe
          INNER JOIN pedido_expedicao_itens pei ON pei.id_pedido = pe.id
          LEFT JOIN composicoes_venda cv ON cv.id_item_venda = pei.id_peca
          WHERE pe.data_coleta IS NULL
        ) demanda
        GROUP BY demanda.id_peca
      ) d ON d.id_peca = ki.id_peca
      ORDER BY ki.id_categoria ASC, ki.ordem ASC, p.codigo ASC
    `);

    const itensPorCategoria = itens.reduce((mapa, item) => {
      const chave = Number(item.id_categoria);
      if (!mapa.has(chave)) {
        mapa.set(chave, []);
      }
      mapa.get(chave).push(item);
      return mapa;
    }, new Map());

    return categorias.map((categoria) => ({
      ...categoria,
      itens: itensPorCategoria.get(Number(categoria.id)) || []
    }));
  }

  static async listAvailablePieces() {
    const [rows] = await pool.query(`
      SELECT id, codigo, descricao, tipo, classificacao, estoque_minimo AS quantidade_pacote
      FROM pecas
      WHERE ativo = 1
      ORDER BY codigo ASC
    `);
    return rows;
  }

  static async findCategoryById(id, connection = pool) {
    const [rows] = await connection.query(
      'SELECT id, nome, ordem FROM kanban_estoque_categorias WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findItemById(id, connection = pool) {
    const [rows] = await connection.query(`
      SELECT ki.id, ki.id_categoria, ki.id_peca, ki.quantidade_pacote, ki.ordem,
        p.codigo, p.descricao
      FROM kanban_estoque_itens ki
      INNER JOIN pecas p ON p.id = ki.id_peca
      WHERE ki.id = ?
    `, [id]);
    return rows[0] || null;
  }

  static async createCategory(data) {
    const [result] = await pool.query(`
      INSERT INTO kanban_estoque_categorias (nome, ordem)
      VALUES (?, COALESCE((SELECT MAX(k.ordem) + 1 FROM kanban_estoque_categorias k), 0))
    `, [data.nome]);
    return this.findCategoryById(result.insertId);
  }

  static async updateCategory(id, data) {
    await pool.query(
      'UPDATE kanban_estoque_categorias SET nome = ? WHERE id = ?',
      [data.nome, id]
    );
    return this.findCategoryById(id);
  }

  static async deleteCategory(id) {
    const [result] = await pool.query(
      'DELETE FROM kanban_estoque_categorias WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async createItem(data) {
    const [result] = await pool.query(`
      INSERT INTO kanban_estoque_itens (id_categoria, id_peca, quantidade_pacote, ordem)
      VALUES (
        ?, ?, ?,
        COALESCE((SELECT MAX(k.ordem) + 1 FROM kanban_estoque_itens k WHERE k.id_categoria = ?), 0)
      )
    `, [data.id_categoria, data.id_peca, data.quantidade_pacote, data.id_categoria]);
    return this.findItemById(result.insertId);
  }

  static async updateItem(id, data) {
    await pool.query(`
      UPDATE kanban_estoque_itens
      SET id_categoria = ?, id_peca = ?, quantidade_pacote = ?
      WHERE id = ?
    `, [data.id_categoria, data.id_peca, data.quantidade_pacote, id]);
    return this.findItemById(id);
  }

  static async deleteItem(id) {
    const [result] = await pool.query('DELETE FROM kanban_estoque_itens WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = KanbanEstoqueModel;
