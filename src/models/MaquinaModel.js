// Model do cadastro de maquinas.
const { pool } = require('../../database/connection');

class MaquinaModel {
  // Lista maquinas para a grade principal.
  static async findAll(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.nome) {
      conditions.push('nome LIKE ?');
      values.push(`%${filters.nome}%`);
    }

    if (filters.tipo) {
      conditions.push('tipo LIKE ?');
      values.push(`%${filters.tipo}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          id,
          nome,
          tipo,
          created_at,
          updated_at
        FROM maquinas
        WHERE ${conditions.join(' AND ')}
        ORDER BY nome ASC
      `,
      values
    );

    return rows;
  }

  // Busca uma maquina por ID.
  static async findById(id) {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          nome,
          tipo,
          created_at,
          updated_at
        FROM maquinas
        WHERE id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  // Lista maquinas para o campo de busca da peca.
  static async findAutocompleteList() {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          nome,
          tipo
        FROM maquinas
        ORDER BY nome ASC
      `
    );

    return rows;
  }

  // Insere uma nova maquina.
  static async create(data) {
    const [result] = await pool.query(
      `
        INSERT INTO maquinas (
          nome,
          tipo
        ) VALUES (?, ?)
      `,
      [data.nome, data.tipo]
    );

    return this.findById(result.insertId);
  }

  // Atualiza uma maquina existente.
  static async update(id, data) {
    const [result] = await pool.query(
      `
        UPDATE maquinas
        SET
          nome = ?,
          tipo = ?
        WHERE id = ?
      `,
      [data.nome, data.tipo, id]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  // Remove uma maquina.
  static async delete(id) {
    const [result] = await pool.query(
      'DELETE FROM maquinas WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }
}

module.exports = MaquinaModel;
