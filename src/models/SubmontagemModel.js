// Model responsavel pelas operacoes de pecas classificadas como SUBMONTAGEM.
const { pool } = require('../../database/connection');

class SubmontagemModel {
  // Lista as submontagens com contagem de componentes para a grade principal.
  static async findAll(filters = {}) {
    const conditions = ["p.classificacao = 'SUBMONTAGEM'"];
    const values = [];
    let filterJoin = '';

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

    if (filters.id_item_componente) {
      filterJoin = 'INNER JOIN estrutura_submontagem esf ON esf.id_submontagem = p.id';
      conditions.push('esf.id_item_componente = ?');
      values.push(filters.id_item_componente);
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
          COUNT(DISTINCT es.id) AS total_componentes,
          GROUP_CONCAT(DISTINCT CONCAT(pc.codigo, ' - ', pc.descricao) ORDER BY pc.codigo SEPARATOR ' || ') AS componentes_resumo
        FROM pecas p
        ${filterJoin}
        LEFT JOIN estrutura_submontagem es ON es.id_submontagem = p.id
        LEFT JOIN pecas pc ON pc.id = es.id_item_componente
        WHERE ${conditions.join(' AND ')}
        GROUP BY p.id
        ORDER BY p.id DESC
      `,
      values
    );

    return rows;
  }

  // Busca uma submontagem pelo ID, com total de componentes agregados.
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
          COUNT(es.id) AS total_componentes
        FROM pecas p
        LEFT JOIN estrutura_submontagem es ON es.id_submontagem = p.id
        WHERE p.id = ? AND p.classificacao = 'SUBMONTAGEM'
        GROUP BY p.id
      `,
      [id]
    );

    return rows[0] || null;
  }

  // Insere uma nova submontagem na mesma tabela de pecas.
  static async create(submontagemData) {
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
        submontagemData.codigo,
        submontagemData.descricao,
        submontagemData.comprimento_mm,
        submontagemData.tipo,
        'SUBMONTAGEM',
        submontagemData.id_materia_prima,
        submontagemData.id_fornecedor,
        submontagemData.id_maquina,
        submontagemData.estoque_minimo,
        submontagemData.estoque_seguranca,
        submontagemData.consumo_mensal,
        submontagemData.massa_kg
      ]
    );

    return this.findById(result.insertId);
  }

  // Atualiza uma submontagem mantendo a classificacao fixa.
  static async update(id, submontagemData) {
    const [result] = await pool.query(
      `
        UPDATE pecas
        SET
          codigo = ?,
          descricao = ?,
          comprimento_mm = ?,
          tipo = ?,
          classificacao = 'SUBMONTAGEM',
          id_materia_prima = ?,
          id_fornecedor = ?,
          id_maquina = ?,
          estoque_minimo = ?,
          estoque_seguranca = ?,
          consumo_mensal = ?,
          massa_kg = ?
        WHERE id = ? AND classificacao = 'SUBMONTAGEM'
      `,
      [
        submontagemData.codigo,
        submontagemData.descricao,
        submontagemData.comprimento_mm,
        submontagemData.tipo,
        submontagemData.id_materia_prima,
        submontagemData.id_fornecedor,
        submontagemData.id_maquina,
        submontagemData.estoque_minimo,
        submontagemData.estoque_seguranca,
        submontagemData.consumo_mensal,
        submontagemData.massa_kg,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  // Remove uma submontagem; a estrutura sai junto pela FK com cascade.
  static async delete(id) {
    const [result] = await pool.query(
      "DELETE FROM pecas WHERE id = ? AND classificacao = 'SUBMONTAGEM'",
      [id]
    );

    return result.affectedRows > 0;
  }
}

module.exports = SubmontagemModel;
