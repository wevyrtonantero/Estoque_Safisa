// Model do cadastro de fornecedores do SAFISA.
const { pool } = require('../../database/connection');

class FornecedorModel {
  // Lista fornecedores com filtros leves para a grade principal.
  static async findAll(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.nome) {
      conditions.push('f.nome LIKE ?');
      values.push(`%${filters.nome}%`);
    }

    if (filters.contato) {
      conditions.push('f.contato LIKE ?');
      values.push(`%${filters.contato}%`);
    }

    if (filters.cidade) {
      conditions.push('f.cidade LIKE ?');
      values.push(`%${filters.cidade}%`);
    }

    if (filters.peca) {
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM (
            SELECT
              pf.id_fornecedor,
              p.codigo,
              p.descricao
            FROM peca_fornecedor pf
            INNER JOIN pecas p ON p.id = pf.id_peca

            UNION

            SELECT
              p.id_fornecedor AS id_fornecedor,
              p.codigo,
              p.descricao
            FROM pecas p
            WHERE p.id_fornecedor IS NOT NULL
          ) pecas_vinculadas_filtro
          WHERE pecas_vinculadas_filtro.id_fornecedor = f.id
            AND (
              pecas_vinculadas_filtro.codigo LIKE ?
              OR pecas_vinculadas_filtro.descricao LIKE ?
              OR CONCAT(pecas_vinculadas_filtro.codigo, ' ', pecas_vinculadas_filtro.descricao) LIKE ?
            )
        )
      `);
      values.push(`%${filters.peca}%`, `%${filters.peca}%`, `%${filters.peca}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          f.id,
          f.nome,
          f.telefone,
          f.contato,
          f.email,
          f.cep,
          f.endereco,
          f.cidade,
          f.observacao,
          f.created_at,
          f.updated_at,
          COALESCE(pecas_resumo.pecas_codigos, '') AS pecas_codigos,
          COALESCE(pecas_resumo.pecas_vinculadas, '') AS pecas_vinculadas,
          COALESCE(pecas_resumo.total_pecas, 0) AS total_pecas
        FROM fornecedores f
        LEFT JOIN (
          SELECT
            pecas_vinculadas.id_fornecedor,
            GROUP_CONCAT(DISTINCT pecas_vinculadas.codigo ORDER BY pecas_vinculadas.codigo SEPARATOR ' | ') AS pecas_codigos,
            GROUP_CONCAT(
              DISTINCT CONCAT(pecas_vinculadas.codigo, ' - ', pecas_vinculadas.descricao)
              ORDER BY pecas_vinculadas.codigo
              SEPARATOR ' | '
            ) AS pecas_vinculadas,
            COUNT(DISTINCT pecas_vinculadas.id_peca) AS total_pecas
          FROM (
            SELECT
              pf.id_fornecedor,
              p.id AS id_peca,
              p.codigo,
              p.descricao
            FROM peca_fornecedor pf
            INNER JOIN pecas p ON p.id = pf.id_peca

            UNION

            SELECT
              p.id_fornecedor AS id_fornecedor,
              p.id AS id_peca,
              p.codigo,
              p.descricao
            FROM pecas p
            WHERE p.id_fornecedor IS NOT NULL
          ) pecas_vinculadas
          GROUP BY pecas_vinculadas.id_fornecedor
        ) pecas_resumo ON pecas_resumo.id_fornecedor = f.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY f.nome ASC
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
