// Model da composicao interna de cada submontagem.
const { pool } = require('../../database/connection');

class EstruturaSubmontagemModel {
  // Recalcula a massa da submontagem pela soma das massas dos itens * quantidade.
  static async recalculateSubmontagemMass(submontagemId, connection = pool) {
    await connection.query(
      `
        UPDATE pecas sub
        LEFT JOIN (
          SELECT
            es.id_submontagem,
            COALESCE(SUM(es.quantidade * p.massa_kg), 0) AS massa_total
          FROM estrutura_submontagem es
          INNER JOIN pecas p ON p.id = es.id_item_componente
          WHERE es.id_submontagem = ?
          GROUP BY es.id_submontagem
        ) calculo ON calculo.id_submontagem = sub.id
        SET sub.massa_kg = COALESCE(calculo.massa_total, 0)
        WHERE sub.id = ? AND sub.classificacao = 'SUBMONTAGEM'
      `,
      [submontagemId, submontagemId]
    );
  }

  // Lista os componentes de uma submontagem ja com dados do item relacionado.
  static async findBySubmontagemId(submontagemId) {
    const [rows] = await pool.query(
      `
        SELECT
          es.id,
          es.id_submontagem,
          es.id_item_componente,
          es.quantidade,
          es.observacao,
          es.created_at,
          es.updated_at,
          p.codigo AS codigo_componente,
          p.descricao AS descricao_componente,
          p.tipo AS tipo_componente,
          p.comprimento_mm,
          p.massa_kg
        FROM estrutura_submontagem es
        INNER JOIN pecas p ON p.id = es.id_item_componente
        WHERE es.id_submontagem = ?
        ORDER BY p.codigo ASC
      `,
      [submontagemId]
    );

    return rows;
  }

  // Busca uma linha especifica da composicao usando submontagem + item componente.
  static async findComponent(submontagemId, componenteId) {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          id_submontagem,
          id_item_componente,
          quantidade,
          observacao
        FROM estrutura_submontagem
        WHERE id_submontagem = ? AND id_item_componente = ?
      `,
      [submontagemId, componenteId]
    );

    return rows[0] || null;
  }

  // Verifica se o ID realmente aponta para uma submontagem valida.
  static async submontagemExists(submontagemId) {
    const [rows] = await pool.query(
      "SELECT id, codigo, descricao FROM pecas WHERE id = ? AND classificacao = 'SUBMONTAGEM'",
      [submontagemId]
    );

    return rows[0] || null;
  }

  // Verifica se o item escolhido pode ser usado como componente.
  static async simpleItemExists(itemId) {
    const [rows] = await pool.query(
      "SELECT id, codigo, descricao FROM pecas WHERE id = ? AND classificacao = 'ITEM'",
      [itemId]
    );

    return rows[0] || null;
  }

  // Insere um novo componente dentro da estrutura da submontagem.
  static async create(submontagemId, componentData) {
    await pool.query(
      `
        INSERT INTO estrutura_submontagem (
          id_submontagem,
          id_item_componente,
          quantidade,
          observacao
        ) VALUES (?, ?, ?, ?)
      `,
      [
        submontagemId,
        componentData.id_item_componente,
        componentData.quantidade,
        componentData.observacao
      ]
    );

    await this.recalculateSubmontagemMass(submontagemId);
    return this.findComponent(submontagemId, componentData.id_item_componente);
  }

  // Atualiza um componente existente, inclusive trocando o item se preciso.
  static async update(submontagemId, componenteIdAtual, componentData) {
    const [result] = await pool.query(
      `
        UPDATE estrutura_submontagem
        SET
          id_item_componente = ?,
          quantidade = ?,
          observacao = ?
        WHERE id_submontagem = ? AND id_item_componente = ?
      `,
      [
        componentData.id_item_componente,
        componentData.quantidade,
        componentData.observacao,
        submontagemId,
        componenteIdAtual
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    await this.recalculateSubmontagemMass(submontagemId);
    return this.findComponent(submontagemId, componentData.id_item_componente);
  }

  // Exclui um componente da estrutura.
  static async delete(submontagemId, componenteId) {
    const [result] = await pool.query(
      `
        DELETE FROM estrutura_submontagem
        WHERE id_submontagem = ? AND id_item_componente = ?
      `,
      [submontagemId, componenteId]
    );

    if (result.affectedRows > 0) {
      await this.recalculateSubmontagemMass(submontagemId);
    }

    return result.affectedRows > 0;
  }
}

module.exports = EstruturaSubmontagemModel;
