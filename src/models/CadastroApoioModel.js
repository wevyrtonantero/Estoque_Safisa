// Model das listas auxiliares usadas para popular selects do cadastro.
const { pool } = require('../../database/connection');

class CadastroApoioModel {
  // Lista as materias-primas disponiveis para vinculacao.
  static async findMateriasPrimas() {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          codigo,
          nome,
          geometria,
          bitola
        FROM materias_primas
        ORDER BY codigo ASC
      `
    );

    return rows;
  }

  // Lista os fornecedores disponiveis para vinculacao.
  static async findFornecedores() {
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

  // Lista as maquinas disponiveis para vinculacao.
  static async findMaquinas() {
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
}

module.exports = CadastroApoioModel;
