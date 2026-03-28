const { pool } = require('../../database/connection');

class SolicitacaoProducaoModel {
  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static normalizeArea(area) {
    const normalized = String(area || '').trim().toUpperCase();
    return ['EXPEDICAO', 'MONTAGEM'].includes(normalized) ? normalized : '';
  }

  static normalizeStatus(status) {
    const normalized = String(status || '').trim().toUpperCase();
    return ['PENDENTE', 'EM_ANALISE', 'EM_PRODUCAO', 'CONCLUIDA', 'CANCELADA'].includes(normalized)
      ? normalized
      : '';
  }

  static buildAreaLabel(area) {
    return area === 'EXPEDICAO' ? 'Expedicao' : 'Montagem';
  }

  static async findById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          s.id,
          s.area_origem,
          s.id_peca,
          s.quantidade_solicitada,
          s.status,
          s.observacao,
          s.data_solicitacao,
          s.data_status,
          s.created_at,
          s.updated_at,
          p.codigo,
          p.descricao,
          p.classificacao,
          p.tipo,
          COALESCE(m.nome, '-') AS maquina_nome,
          CASE
            WHEN s.area_origem = 'EXPEDICAO' THEN 'Expedicao'
            ELSE 'Montagem'
          END AS origem_nome
        FROM solicitacoes_producao s
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        WHERE s.id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async findAll(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.area_origem) {
      conditions.push('s.area_origem = ?');
      values.push(filters.area_origem);
    }

    if (filters.status) {
      conditions.push('s.status = ?');
      values.push(filters.status);
    }

    if (filters.abertas) {
      conditions.push("s.status IN ('PENDENTE', 'EM_ANALISE', 'EM_PRODUCAO')");
    }

    if (filters.q) {
      conditions.push(`
        (
          p.codigo LIKE ?
          OR p.descricao LIKE ?
          OR s.observacao LIKE ?
        )
      `);
      values.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.area_origem,
          s.id_peca,
          s.quantidade_solicitada,
          s.status,
          s.observacao,
          s.data_solicitacao,
          s.data_status,
          s.created_at,
          s.updated_at,
          p.codigo,
          p.descricao,
          p.classificacao,
          p.tipo,
          COALESCE(m.nome, '-') AS maquina_nome,
          CASE
            WHEN s.area_origem = 'EXPEDICAO' THEN 'Expedicao'
            ELSE 'Montagem'
          END AS origem_nome
        FROM solicitacoes_producao s
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          CASE s.status
            WHEN 'PENDENTE' THEN 1
            WHEN 'EM_ANALISE' THEN 2
            WHEN 'EM_PRODUCAO' THEN 3
            WHEN 'CONCLUIDA' THEN 4
            ELSE 5
          END,
          s.id DESC
      `,
      values
    );

    return rows;
  }

  static async create(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const area = this.normalizeArea(data.area_origem);
      if (!area) {
        throw this.createBusinessError('A area de origem da solicitacao de producao deve ser valida.');
      }

      const [pieceRows] = await connection.query(
        `
          SELECT id, codigo, descricao, tipo, classificacao
          FROM pecas
          WHERE id = ?
        `,
        [data.id_peca]
      );

      const piece = pieceRows[0] || null;
      if (!piece) {
        throw this.createBusinessError('A peca solicitada para producao nao foi encontrada.');
      }

      if (piece.classificacao !== 'ITEM' || piece.tipo !== 'PRODUZIDA') {
        throw this.createBusinessError('Somente pecas produzidas podem gerar solicitacao para a Producao.');
      }

      const [result] = await connection.query(
        `
          INSERT INTO solicitacoes_producao (
            area_origem,
            id_peca,
            quantidade_solicitada,
            observacao
          ) VALUES (?, ?, ?, ?)
        `,
        [
          area,
          data.id_peca,
          data.quantidade_solicitada,
          data.observacao || null
        ]
      );

      await connection.commit();
      return this.findById(result.insertId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateStatus(id, data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const request = await this.findById(id, connection);
      if (!request) {
        throw this.createBusinessError('Solicitacao de producao nao encontrada.');
      }

      const status = this.normalizeStatus(data.status);
      if (!status) {
        throw this.createBusinessError('Status invalido para a solicitacao de producao.');
      }

      await connection.query(
        `
          UPDATE solicitacoes_producao
          SET
            status = ?,
            observacao = ?,
            data_status = NOW()
          WHERE id = ?
        `,
        [
          status,
          data.observacao || request.observacao || null,
          id
        ]
      );

      await connection.commit();
      return this.findById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = SolicitacaoProducaoModel;
