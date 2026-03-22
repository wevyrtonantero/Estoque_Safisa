// Model do cadastro de materias-primas.
const { pool } = require('../../database/connection');

class MateriaPrimaModel {
  // Lista materias-primas com filtros para a tela principal.
  static async findAll(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.codigo) {
      conditions.push('mp.codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.nome) {
      conditions.push('mp.nome LIKE ?');
      values.push(`%${filters.nome}%`);
    }

    if (filters.material) {
      conditions.push('COALESCE(mp.material, \'\') LIKE ?');
      values.push(`%${filters.material}%`);
    }

    if (filters.categoria) {
      conditions.push('mp.categoria = ?');
      values.push(filters.categoria);
    }

    if (filters.geometria) {
      conditions.push('mp.geometria LIKE ?');
      values.push(`%${filters.geometria}%`);
    }

    if (filters.bitola) {
      conditions.push('mp.bitola LIKE ?');
      values.push(`%${filters.bitola}%`);
    }

    if (filters.id_fornecedor_principal) {
      conditions.push('mp.id_fornecedor_principal = ?');
      values.push(filters.id_fornecedor_principal);
    }

    const [rows] = await pool.query(
      `
        SELECT
          mp.id,
          mp.codigo,
          mp.nome,
          mp.categoria,
          mp.material,
          mp.geometria,
          mp.bitola,
          mp.bitola_mm,
          mp.comprimento_padrao_mm,
          mp.peso_por_metro,
          mp.peso_unitario_kg,
          mp.densidade_g_cm3,
          mp.estoque_minimo,
          mp.unidade_estoque,
          mp.id_fornecedor_principal,
          fp.nome AS fornecedor_principal_nome,
          mp.observacao,
          mp.created_at,
          mp.updated_at
        FROM materias_primas mp
        LEFT JOIN fornecedores fp ON fp.id = mp.id_fornecedor_principal
        WHERE ${conditions.join(' AND ')}
        ORDER BY mp.nome ASC
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
          mp.id,
          mp.codigo,
          mp.nome,
          mp.categoria,
          mp.material,
          mp.geometria,
          mp.bitola,
          mp.bitola_mm,
          mp.comprimento_padrao_mm,
          mp.peso_por_metro,
          mp.peso_unitario_kg,
          mp.densidade_g_cm3,
          mp.estoque_minimo,
          mp.unidade_estoque,
          mp.id_fornecedor_principal,
          fp.nome AS fornecedor_principal_nome,
          mp.observacao,
          mp.created_at,
          mp.updated_at
        FROM materias_primas mp
        LEFT JOIN fornecedores fp ON fp.id = mp.id_fornecedor_principal
        WHERE mp.id = ?
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
          categoria,
          material,
          geometria,
          bitola,
          bitola_mm,
          id_fornecedor_principal
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
          categoria,
          material,
          geometria,
          bitola,
          bitola_mm,
          comprimento_padrao_mm,
          peso_por_metro,
          peso_unitario_kg,
          densidade_g_cm3,
          estoque_minimo,
          unidade_estoque,
          id_fornecedor_principal,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.codigo,
        data.nome,
        data.categoria,
        data.material,
        data.geometria,
        data.bitola,
        data.bitola_mm,
        data.comprimento_padrao_mm,
        data.peso_por_metro,
        data.peso_unitario_kg,
        data.densidade_g_cm3,
        data.estoque_minimo,
        data.unidade_estoque,
        data.id_fornecedor_principal,
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
          categoria = ?,
          material = ?,
          geometria = ?,
          bitola = ?,
          bitola_mm = ?,
          comprimento_padrao_mm = ?,
          peso_por_metro = ?,
          peso_unitario_kg = ?,
          densidade_g_cm3 = ?,
          estoque_minimo = ?,
          unidade_estoque = ?,
          id_fornecedor_principal = ?,
          observacao = ?
        WHERE id = ?
      `,
      [
        data.codigo,
        data.nome,
        data.categoria,
        data.material,
        data.geometria,
        data.bitola,
        data.bitola_mm,
        data.comprimento_padrao_mm,
        data.peso_por_metro,
        data.peso_unitario_kg,
        data.densidade_g_cm3,
        data.estoque_minimo,
        data.unidade_estoque,
        data.id_fornecedor_principal,
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
