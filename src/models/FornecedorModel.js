// Model do cadastro de fornecedores do SAFISA.
const { pool } = require('../../database/connection');

class FornecedorModel {
  // Lista fornecedores com filtros leves para a grade principal.
  static async findAll(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.nome) {
      conditions.push('nome LIKE ?');
      values.push(`%${filters.nome}%`);
    }

    if (filters.contato) {
      conditions.push('contato LIKE ?');
      values.push(`%${filters.contato}%`);
    }

    if (filters.cidade) {
      conditions.push('cidade LIKE ?');
      values.push(`%${filters.cidade}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          id,
          nome,
          telefone,
          contato,
          email,
          cep,
          endereco,
          cidade,
          observacao,
          created_at,
          updated_at
        FROM fornecedores
        WHERE ${conditions.join(' AND ')}
        ORDER BY nome ASC
      `,
      values
    );

    return rows;
  }

  // Busca um fornecedor especifico pelo ID.
  static async findById(id) {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          nome,
          telefone,
          contato,
          email,
          cep,
          endereco,
          cidade,
          observacao,
          created_at,
          updated_at
        FROM fornecedores
        WHERE id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  // Lista fornecedores de forma leve para campos de busca/autocomplete.
  static async findAutocompleteList() {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          nome,
          contato,
          telefone,
          cidade
        FROM fornecedores
        ORDER BY nome ASC
      `
    );

    return rows;
  }

  // Busca o primeiro fornecedor que combine com um ou mais termos de nome.
  static async findFirstByNameTerms(terms = []) {
    const normalizedTerms = terms
      .map((term) => String(term || '').trim())
      .filter(Boolean);

    if (normalizedTerms.length === 0) {
      return null;
    }

    const conditions = normalizedTerms.map(() => 'nome LIKE ?').join(' OR ');
    const values = normalizedTerms.map((term) => `%${term}%`);

    const [rows] = await pool.query(
      `
        SELECT
          id,
          nome
        FROM fornecedores
        WHERE ${conditions}
        ORDER BY nome ASC
        LIMIT 1
      `,
      values
    );

    return rows[0] || null;
  }

  // Insere um novo fornecedor.
  static async create(data) {
    const [result] = await pool.query(
      `
        INSERT INTO fornecedores (
          nome,
          telefone,
          contato,
          email,
          cep,
          endereco,
          cidade,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.nome,
        data.telefone,
        data.contato,
        data.email,
        data.cep,
        data.endereco,
        data.cidade,
        data.observacao
      ]
    );

    return this.findById(result.insertId);
  }

  // Atualiza um fornecedor existente.
  static async update(id, data) {
    const [result] = await pool.query(
      `
        UPDATE fornecedores
        SET
          nome = ?,
          telefone = ?,
          contato = ?,
          email = ?,
          cep = ?,
          endereco = ?,
          cidade = ?,
          observacao = ?
        WHERE id = ?
      `,
      [
        data.nome,
        data.telefone,
        data.contato,
        data.email,
        data.cep,
        data.endereco,
        data.cidade,
        data.observacao,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  // Remove um fornecedor.
  static async delete(id) {
    const [result] = await pool.query(
      'DELETE FROM fornecedores WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }
}

module.exports = FornecedorModel;
