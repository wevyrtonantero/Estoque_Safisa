// Model responsavel pelas operacoes de pecas classificadas como SUBMONTAGEM.
const { pool } = require('../../database/connection');
const EstruturaSubmontagemModel = require('./EstruturaSubmontagemModel');

class SubmontagemModel {
  static async replaceComponents(connection, submontagemId, componentes = []) {
    await connection.query(
      `
        DELETE FROM estrutura_submontagem
        WHERE id_submontagem = ?
      `,
      [submontagemId]
    );

    if (componentes.length === 0) {
      return;
    }

    await connection.query(
      `
        INSERT INTO estrutura_submontagem (
          id_submontagem,
          id_item_componente,
          quantidade,
          observacao
        ) VALUES ?
      `,
      [
        componentes.map((componente) => ([
          submontagemId,
          componente.id_item_componente,
          componente.quantidade,
          componente.observacao
        ]))
      ]
    );
  }

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
  static async create(submontagemData, componentes = []) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
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
          'PRODUZIDA',
          'SUBMONTAGEM',
          submontagemData.id_materia_prima,
          submontagemData.id_fornecedor,
          submontagemData.id_maquina,
          submontagemData.estoque_minimo,
          submontagemData.estoque_seguranca,
          submontagemData.consumo_mensal,
          0
        ]
      );

      await this.replaceComponents(connection, result.insertId, componentes);
      await EstruturaSubmontagemModel.recalculateSubmontagemMass(result.insertId, connection);
      await connection.commit();

      return this.findById(result.insertId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Atualiza uma submontagem mantendo a classificacao fixa.
  static async update(id, submontagemData, componentes = null) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `
          UPDATE pecas
          SET
            codigo = ?,
            descricao = ?,
            comprimento_mm = ?,
            tipo = 'PRODUZIDA',
            classificacao = 'SUBMONTAGEM',
            id_materia_prima = ?,
            id_fornecedor = ?,
            id_maquina = ?,
            estoque_minimo = ?,
            estoque_seguranca = ?,
            consumo_mensal = ?
          WHERE id = ? AND classificacao = 'SUBMONTAGEM'
        `,
        [
          submontagemData.codigo,
          submontagemData.descricao,
          submontagemData.comprimento_mm,
          submontagemData.id_materia_prima,
          submontagemData.id_fornecedor,
          submontagemData.id_maquina,
          submontagemData.estoque_minimo,
          submontagemData.estoque_seguranca,
          submontagemData.consumo_mensal,
          id
        ]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return null;
      }

      if (Array.isArray(componentes)) {
        await this.replaceComponents(connection, id, componentes);
      }

      await EstruturaSubmontagemModel.recalculateSubmontagemMass(id, connection);
      await connection.commit();

      return this.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
