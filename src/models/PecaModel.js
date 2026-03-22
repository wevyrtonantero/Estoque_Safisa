// Model responsavel pelas operacoes de pecas classificadas como ITEM.
const { pool } = require('../../database/connection');

class PecaModel {
  static supplierSummarySubquery() {
    return `
      SELECT
        pf.id_peca,
        GROUP_CONCAT(DISTINCT f.nome ORDER BY f.nome SEPARATOR ', ') AS fornecedores_nomes
      FROM peca_fornecedor pf
      INNER JOIN fornecedores f ON f.id = pf.id_fornecedor
      GROUP BY pf.id_peca
    `;
  }

  // Lista somente itens simples, com filtros opcionais para a tela de pecas.
  static async findAll(filters = {}) {
    const conditions = ["p.classificacao = 'ITEM'"];
    const values = [];

    if (filters.codigo) {
      conditions.push('p.codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.descricao) {
      conditions.push('p.descricao LIKE ?');
      values.push(`%${filters.descricao}%`);
    }

    if (filters.tipo) {
      conditions.push('p.tipo = ?');
      values.push(filters.tipo);
    }

    if (filters.id_materia_prima) {
      conditions.push('p.id_materia_prima = ?');
      values.push(filters.id_materia_prima);
    }

    if (filters.id_fornecedor) {
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM peca_fornecedor pf_filter
          WHERE pf_filter.id_peca = p.id
            AND pf_filter.id_fornecedor = ?
        )
      `);
      values.push(filters.id_fornecedor);
    }

    if (filters.id_maquina) {
      conditions.push('p.id_maquina = ?');
      values.push(filters.id_maquina);
    }

    const [rows] = await pool.query(
      `
        SELECT
          p.id,
          p.codigo,
          p.descricao,
          p.comprimento_mm,
          p.tipo,
          p.classificacao,
          p.id_materia_prima,
          p.id_fornecedor,
          p.id_maquina,
          p.estoque_minimo,
          p.estoque_seguranca,
          p.consumo_mensal,
          p.massa_kg,
          p.created_at,
          p.updated_at,
          mp.codigo AS materia_prima_codigo,
          mp.nome AS materia_prima_nome,
          f.nome AS fornecedor_nome,
          COALESCE(fs.fornecedores_nomes, f.nome, '') AS fornecedores_nomes,
          m.nome AS maquina_nome
        FROM pecas p
        LEFT JOIN materias_primas mp ON mp.id = p.id_materia_prima
        LEFT JOIN fornecedores f ON f.id = p.id_fornecedor
        LEFT JOIN (${this.supplierSummarySubquery()}) fs ON fs.id_peca = p.id
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.id DESC
      `,
      values
    );

    return rows;
  }

  // Busca um item simples pelo ID.
  static async findById(id) {
    const [rows] = await pool.query(
      `
        SELECT
          p.id,
          p.codigo,
          p.descricao,
          p.comprimento_mm,
          p.tipo,
          p.classificacao,
          p.id_materia_prima,
          p.id_fornecedor,
          p.id_maquina,
          p.estoque_minimo,
          p.estoque_seguranca,
          p.consumo_mensal,
          p.massa_kg,
          p.created_at,
          p.updated_at,
          mp.codigo AS materia_prima_codigo,
          mp.nome AS materia_prima_nome,
          f.nome AS fornecedor_nome,
          COALESCE(fs.fornecedores_nomes, f.nome, '') AS fornecedores_nomes,
          m.nome AS maquina_nome
        FROM pecas p
        LEFT JOIN materias_primas mp ON mp.id = p.id_materia_prima
        LEFT JOIN fornecedores f ON f.id = p.id_fornecedor
        LEFT JOIN (${this.supplierSummarySubquery()}) fs ON fs.id_peca = p.id
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        WHERE p.id = ? AND p.classificacao = 'ITEM'
      `,
      [id]
    );

    return rows[0] || null;
  }

  // Lista os itens simples para popular o select de componentes.
  static async findSimpleItems() {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          codigo,
          descricao,
          tipo,
          comprimento_mm,
          massa_kg
        FROM pecas
        WHERE classificacao = 'ITEM'
        ORDER BY codigo ASC
      `
    );

    return rows;
  }

  // Lista as submontagens em que a peca esta sendo usada como componente.
  static async findSubmontagemUsages(id) {
    const [rows] = await pool.query(
      `
        SELECT
          es.id_submontagem,
          es.quantidade,
          p.codigo,
          p.descricao
        FROM estrutura_submontagem es
        INNER JOIN pecas p ON p.id = es.id_submontagem
        WHERE es.id_item_componente = ?
        ORDER BY p.codigo ASC
      `,
      [id]
    );

    return rows;
  }

  // Insere uma nova peca simples.
  static async create(pecaData) {
    const [result] = await pool.query(
      `
        INSERT INTO pecas (
          codigo,
          descricao,
          comprimento_mm,
          tipo,
          classificacao,
          id_materia_prima,
          id_fornecedor,
          id_maquina,
          estoque_minimo,
          estoque_seguranca,
          consumo_mensal,
          massa_kg
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        pecaData.codigo,
        pecaData.descricao,
        pecaData.comprimento_mm,
        pecaData.tipo,
        'ITEM',
        pecaData.id_materia_prima,
        pecaData.id_fornecedor,
        pecaData.id_maquina,
        pecaData.estoque_minimo,
        pecaData.estoque_seguranca,
        pecaData.consumo_mensal,
        pecaData.massa_kg
      ]
    );

    return this.findById(result.insertId);
  }

  // Atualiza uma peca simples sem alterar a classificacao.
  static async update(id, pecaData) {
    const [result] = await pool.query(
      `
        UPDATE pecas
        SET
          codigo = ?,
          descricao = ?,
          comprimento_mm = ?,
          tipo = ?,
          classificacao = 'ITEM',
          id_materia_prima = ?,
          id_fornecedor = ?,
          id_maquina = ?,
          estoque_minimo = ?,
          estoque_seguranca = ?,
          consumo_mensal = ?,
          massa_kg = ?
        WHERE id = ? AND classificacao = 'ITEM'
      `,
      [
        pecaData.codigo,
        pecaData.descricao,
        pecaData.comprimento_mm,
        pecaData.tipo,
        pecaData.id_materia_prima,
        pecaData.id_fornecedor,
        pecaData.id_maquina,
        pecaData.estoque_minimo,
        pecaData.estoque_seguranca,
        pecaData.consumo_mensal,
        pecaData.massa_kg,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  // Remove uma peca simples pelo ID.
  static async delete(id) {
    const [result] = await pool.query(
      "DELETE FROM pecas WHERE id = ? AND classificacao = 'ITEM'",
      [id]
    );

    return result.affectedRows > 0;
  }
}

module.exports = PecaModel;
