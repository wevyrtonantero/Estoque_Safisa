// Model do cadastro de materias-primas.
const { pool } = require('../../database/connection');

class MateriaPrimaModel {
  // Lista materias-primas com filtros para a tela principal.
  static async findAll(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.codigo) {
      conditions.push('codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.nome) {
      conditions.push('nome LIKE ?');
      values.push(`%${filters.nome}%`);
    }

    if (filters.material) {
      conditions.push('COALESCE(material, \'\') LIKE ?');
      values.push(`%${filters.material}%`);
    }

    if (filters.geometria) {
      conditions.push('geometria LIKE ?');
      values.push(`%${filters.geometria}%`);
    }

    if (filters.bitola) {
      conditions.push('bitola LIKE ?');
      values.push(`%${filters.bitola}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          id,
          codigo,
          nome,
          material,
          geometria,
          bitola,
          bitola_mm,
          comprimento_padrao_mm,
          peso_por_metro,
          peso_unitario_kg,
          densidade_g_cm3,
          estoque_minimo,
          observacao,
          created_at,
          updated_at
        FROM materias_primas
        WHERE ${conditions.join(' AND ')}
        ORDER BY nome ASC
      `,
      values
    );

    return rows;
  }

  // Busca uma materia-prima especifica.
  static async findById(id) {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          codigo,
          nome,
          material,
          geometria,
          bitola,
          bitola_mm,
          comprimento_padrao_mm,
          peso_por_metro,
          peso_unitario_kg,
          densidade_g_cm3,
          estoque_minimo,
          observacao,
          created_at,
          updated_at
        FROM materias_primas
        WHERE id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  // Lista materias-primas para campos de busca/autocomplete.
  static async findAutocompleteList() {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          codigo,
          nome,
          material,
          geometria,
          bitola,
          bitola_mm
        FROM materias_primas
        ORDER BY codigo ASC
      `
    );

    return rows;
  }

  // Insere uma nova materia-prima com peso por metro em kg/m.
  static async create(data) {
    const [result] = await pool.query(
      `
        INSERT INTO materias_primas (
          codigo,
          nome,
          material,
          geometria,
          bitola,
          bitola_mm,
          comprimento_padrao_mm,
          peso_por_metro,
          peso_unitario_kg,
          densidade_g_cm3,
          estoque_minimo,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.codigo,
        data.nome,
        data.material,
        data.geometria,
        data.bitola,
        data.bitola_mm,
        data.comprimento_padrao_mm,
        data.peso_por_metro,
        data.peso_unitario_kg,
        data.densidade_g_cm3,
        data.estoque_minimo,
        data.observacao
      ]
    );

    return this.findById(result.insertId);
  }

  // Atualiza uma materia-prima existente.
  static async update(id, data) {
    const [result] = await pool.query(
      `
        UPDATE materias_primas
        SET
          codigo = ?,
          nome = ?,
          material = ?,
          geometria = ?,
          bitola = ?,
          bitola_mm = ?,
          comprimento_padrao_mm = ?,
          peso_por_metro = ?,
          peso_unitario_kg = ?,
          densidade_g_cm3 = ?,
          estoque_minimo = ?,
          observacao = ?
        WHERE id = ?
      `,
      [
        data.codigo,
        data.nome,
        data.material,
        data.geometria,
        data.bitola,
        data.bitola_mm,
        data.comprimento_padrao_mm,
        data.peso_por_metro,
        data.peso_unitario_kg,
        data.densidade_g_cm3,
        data.estoque_minimo,
        data.observacao,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  // Remove uma materia-prima.
  static async delete(id) {
    const [result] = await pool.query(
      'DELETE FROM materias_primas WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }
}

module.exports = MateriaPrimaModel;
