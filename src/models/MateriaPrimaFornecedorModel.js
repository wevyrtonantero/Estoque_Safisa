// Model do vinculo de multiplos fornecedores por materia-prima.
const { pool } = require('../../database/connection');

class MateriaPrimaFornecedorModel {
  // Lista fornecedores vinculados a uma materia-prima.
  static async findByMateriaPrimaId(materiaPrimaId) {
    const [rows] = await pool.query(
      `
        SELECT
          mpf.id,
          mpf.id_materia_prima,
          mpf.id_fornecedor,
          mpf.observacao,
          mpf.created_at,
          mpf.updated_at,
          f.nome AS fornecedor_nome,
          f.contato AS fornecedor_contato,
          f.telefone AS fornecedor_telefone,
          f.email AS fornecedor_email,
          f.cidade AS fornecedor_cidade
        FROM materia_prima_fornecedor mpf
        INNER JOIN fornecedores f ON f.id = mpf.id_fornecedor
        WHERE mpf.id_materia_prima = ?
        ORDER BY f.nome ASC
      `,
      [materiaPrimaId]
    );

    return rows;
  }

  // Busca um vinculo especifico.
  static async findById(vinculoId) {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          id_materia_prima,
          id_fornecedor,
          observacao
        FROM materia_prima_fornecedor
        WHERE id = ?
      `,
      [vinculoId]
    );

    return rows[0] || null;
  }

  // Verifica se a materia-prima existe.
  static async materiaPrimaExists(materiaPrimaId) {
    const [rows] = await pool.query(
      'SELECT id, nome FROM materias_primas WHERE id = ?',
      [materiaPrimaId]
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

  // Evita duplicidade do mesmo fornecedor para a mesma materia-prima.
  static async findDuplicate(materiaPrimaId, fornecedorId) {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          id_materia_prima,
          id_fornecedor
        FROM materia_prima_fornecedor
        WHERE id_materia_prima = ? AND id_fornecedor = ?
      `,
      [materiaPrimaId, fornecedorId]
    );

    return rows[0] || null;
  }

  // Cria um novo vinculo materia-prima x fornecedor.
  static async create(materiaPrimaId, data) {
    const [result] = await pool.query(
      `
        INSERT INTO materia_prima_fornecedor (
          id_materia_prima,
          id_fornecedor,
          observacao
        ) VALUES (?, ?, ?)
      `,
      [materiaPrimaId, data.id_fornecedor, data.observacao]
    );

    return this.findById(result.insertId);
  }

  // Atualiza um vinculo existente.
  static async update(vinculoId, data) {
    const [result] = await pool.query(
      `
        UPDATE materia_prima_fornecedor
        SET
          id_fornecedor = ?,
          observacao = ?
        WHERE id = ?
      `,
      [data.id_fornecedor, data.observacao, vinculoId]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(vinculoId);
  }

  // Remove um vinculo.
  static async delete(vinculoId) {
    const [result] = await pool.query(
      'DELETE FROM materia_prima_fornecedor WHERE id = ?',
      [vinculoId]
    );

    return result.affectedRows > 0;
  }

  // Sincroniza a lista de fornecedores vinculados a uma materia-prima.
  static async replaceAll(materiaPrimaId, fornecedorIds = []) {
    const normalizedIds = fornecedorIds
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value));

    const [currentRows] = await pool.query(
      `
        SELECT
          id,
          id_fornecedor
        FROM materia_prima_fornecedor
        WHERE id_materia_prima = ?
      `,
      [materiaPrimaId]
    );

    const currentIds = currentRows.map((row) => Number(row.id_fornecedor));
    const idsToDelete = currentRows
      .filter((row) => !normalizedIds.includes(Number(row.id_fornecedor)))
      .map((row) => row.id);
    const idsToCreate = normalizedIds.filter((fornecedorId) => !currentIds.includes(fornecedorId));

    if (idsToDelete.length > 0) {
      await pool.query(
        `DELETE FROM materia_prima_fornecedor WHERE id IN (${idsToDelete.map(() => '?').join(', ')})`,
        idsToDelete
      );
    }

    if (idsToCreate.length > 0) {
      await pool.query(
        `
          INSERT INTO materia_prima_fornecedor (
            id_materia_prima,
            id_fornecedor,
            observacao
          ) VALUES ?
        `,
        [idsToCreate.map((fornecedorId) => [materiaPrimaId, fornecedorId, null])]
      );
    }

    return this.findByMateriaPrimaId(materiaPrimaId);
  }
}

module.exports = MateriaPrimaFornecedorModel;
