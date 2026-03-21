// Model responsavel pelas operacoes de pecas classificadas como ITEM.
const { pool } = require('../../database/connection');

class PecaModel {
  // Lista somente itens simples, com filtros opcionais para a tela de pecas.
  static async findAll(filters = {}) {
    const conditions = ["classificacao = 'ITEM'"];
    const values = [];

    if (filters.codigo) {
      conditions.push('codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.descricao) {
      conditions.push('descricao LIKE ?');
      values.push(`%${filters.descricao}%`);
    }

    if (filters.tipo) {
      conditions.push('tipo = ?');
      values.push(filters.tipo);
    }

    const [rows] = await pool.query(
      `
        SELECT
          id,
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
          massa_kg,
          created_at,
          updated_at
        FROM pecas
        WHERE ${conditions.join(' AND ')}
        ORDER BY id DESC
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
          id,
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
          massa_kg,
          created_at,
          updated_at
        FROM pecas
        WHERE id = ? AND classificacao = 'ITEM'
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
