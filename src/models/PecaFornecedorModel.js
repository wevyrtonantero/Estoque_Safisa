// Estrutura preparada para vinculo de multiplos fornecedores por peca.
const { pool } = require('../../database/connection');

class PecaFornecedorModel {
  // Lista os fornecedores vinculados a uma peca.
  static async findByPecaId(pecaId) {
    const [rows] = await pool.query(
      `
        SELECT
          pf.id,
          pf.id_peca,
          pf.id_fornecedor,
          pf.observacao,
          pf.created_at,
          pf.updated_at,
          f.nome AS fornecedor_nome,
          f.contato AS fornecedor_contato,
          f.telefone AS fornecedor_telefone,
          f.email AS fornecedor_email
        FROM peca_fornecedor pf
        INNER JOIN fornecedores f ON f.id = pf.id_fornecedor
        WHERE pf.id_peca = ?
        ORDER BY f.nome ASC
      `,
      [pecaId]
    );

    return rows;
  }

  // Busca um vinculo de peca por ID.
  static async findById(id) {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          id_peca,
          id_fornecedor,
          observacao
        FROM peca_fornecedor
        WHERE id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  // Verifica se a peca existe.
  static async pecaExists(pecaId) {
    const [rows] = await pool.query(
      'SELECT id, codigo, descricao FROM pecas WHERE id = ?',
      [pecaId]
    );

    return rows[0] || null;
  }

  // Verifica se o fornecedor existe.
  static async fornecedorExists(fornecedorId) {
    const [rows] = await pool.query(
      'SELECT id, nome FROM fornecedores WHERE id = ?',
      [fornecedorId]
    );

    return rows[0] || null;
  }

  // Evita duplicidade do mesmo fornecedor para a mesma peca.
  static async findDuplicate(pecaId, fornecedorId) {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          id_peca,
          id_fornecedor
        FROM peca_fornecedor
        WHERE id_peca = ? AND id_fornecedor = ?
      `,
      [pecaId, fornecedorId]
    );

    return rows[0] || null;
  }

  // Cria um novo vinculo de fornecedor na peca.
  static async create(pecaId, data) {
    const [result] = await pool.query(
      `
        INSERT INTO peca_fornecedor (
          id_peca,
          id_fornecedor,
          observacao
        ) VALUES (?, ?, ?)
      `,
      [pecaId, data.id_fornecedor, data.observacao]
    );

    return this.findById(result.insertId);
  }

  // Atualiza um vinculo de fornecedor da peca.
  static async update(id, data) {
    const [result] = await pool.query(
      `
        UPDATE peca_fornecedor
        SET
          id_fornecedor = ?,
          observacao = ?
        WHERE id = ?
      `,
      [data.id_fornecedor, data.observacao, id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  // Exclui um vinculo de fornecedor da peca.
  static async delete(id) {
    const [result] = await pool.query(
      'DELETE FROM peca_fornecedor WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }

  // Sincroniza a lista de fornecedores vinculados a uma peca.
  static async replaceAll(pecaId, fornecedorIds = []) {
    const normalizedIds = fornecedorIds
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value));

    const [currentRows] = await pool.query(
      `
        SELECT
          id,
          id_fornecedor
        FROM peca_fornecedor
        WHERE id_peca = ?
      `,
      [pecaId]
    );

    const currentIds = currentRows.map((row) => Number(row.id_fornecedor));
    const idsToDelete = currentRows
      .filter((row) => !normalizedIds.includes(Number(row.id_fornecedor)))
      .map((row) => row.id);
    const idsToCreate = normalizedIds.filter((fornecedorId) => !currentIds.includes(fornecedorId));

    if (idsToDelete.length > 0) {
      await pool.query(
        `DELETE FROM peca_fornecedor WHERE id IN (${idsToDelete.map(() => '?').join(', ')})`,
        idsToDelete
      );
    }

    if (idsToCreate.length > 0) {
      await pool.query(
        `
          INSERT INTO peca_fornecedor (
            id_peca,
            id_fornecedor,
            observacao
          ) VALUES ?
        `,
        [idsToCreate.map((fornecedorId) => [pecaId, fornecedorId, null])]
      );
    }

    return this.findByPecaId(pecaId);
  }
}

module.exports = PecaFornecedorModel;
