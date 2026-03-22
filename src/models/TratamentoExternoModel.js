const { pool } = require('../../database/connection');

class TratamentoExternoModel {
  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static async findSaldos(filters = {}) {
    const conditions = ['s.quantidade > 0'];
    const values = [];

    if (filters.codigo) {
      conditions.push('p.codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.descricao) {
      conditions.push('p.descricao LIKE ?');
      values.push(`%${filters.descricao}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.id_peca,
          s.quantidade,
          s.created_at,
          s.updated_at,
          p.codigo,
          p.descricao,
          p.tipo,
          p.classificacao,
          COALESCE(m.nome, '-') AS maquina_nome
        FROM tratamento_externo_saldos s
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.codigo ASC
      `,
      values
    );

    return rows;
  }

  static async findMovimentacoes(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.id_peca) {
      conditions.push('mov.id_peca = ?');
      values.push(filters.id_peca);
    }

    const [rows] = await pool.query(
      `
        SELECT
          mov.id,
          mov.id_peca,
          mov.id_producao_ordem,
          mov.tipo_movimentacao,
          mov.quantidade,
          mov.saldo_resultante,
          mov.observacao,
          mov.data_movimentacao,
          p.codigo,
          p.descricao,
          COALESCE(m.nome, '-') AS maquina_nome
        FROM tratamento_externo_movimentacoes mov
        INNER JOIN pecas p ON p.id = mov.id_peca
        LEFT JOIN producao_ordens po ON po.id = mov.id_producao_ordem
        LEFT JOIN maquinas m ON m.id = po.id_maquina
        WHERE ${conditions.join(' AND ')}
        ORDER BY mov.data_movimentacao DESC, mov.id DESC
      `,
      values
    );

    return rows;
  }

  static async findSaldoForUpdate(connection, idPeca) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          id_peca,
          quantidade
        FROM tratamento_externo_saldos
        WHERE id_peca = ?
        FOR UPDATE
      `,
      [idPeca]
    );

    return rows[0] || null;
  }

  static async persistSaldo(connection, idPeca, quantidade, saldoAtual) {
    if (saldoAtual) {
      await connection.query(
        `
          UPDATE tratamento_externo_saldos
          SET quantidade = ?
          WHERE id = ?
        `,
        [quantidade, saldoAtual.id]
      );
      return;
    }

    await connection.query(
      `
        INSERT INTO tratamento_externo_saldos (
          id_peca,
          quantidade
        ) VALUES (?, ?)
      `,
      [idPeca, quantidade]
    );
  }

  static async createMovimentacao(connection, data) {
    await connection.query(
      `
        INSERT INTO tratamento_externo_movimentacoes (
          id_peca,
          id_producao_ordem,
          tipo_movimentacao,
          quantidade,
          saldo_resultante,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        data.id_peca,
        data.id_producao_ordem || null,
        data.tipo_movimentacao,
        data.quantidade,
        data.saldo_resultante ?? null,
        data.observacao || null
      ]
    );
  }

  static async registerEntradaProducao(connection, data) {
    const quantidadeEntrada = Number(Number(data.quantidade).toFixed(2));

    if (quantidadeEntrada <= 0) {
      return null;
    }

    const saldoAtual = await this.findSaldoForUpdate(connection, data.id_peca);
    const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
    const novoSaldo = Number((quantidadeAtual + quantidadeEntrada).toFixed(2));

    await this.persistSaldo(connection, data.id_peca, novoSaldo, saldoAtual);
    await this.createMovimentacao(connection, {
      id_peca: data.id_peca,
      id_producao_ordem: data.id_producao_ordem || null,
      tipo_movimentacao: 'ENTRADA_PRODUCAO',
      quantidade: quantidadeEntrada,
      saldo_resultante: novoSaldo,
      observacao: data.observacao || 'Entrada automatica vinda da producao.'
    });

    return {
      quantidade_entrada: quantidadeEntrada,
      saldo_resultante: novoSaldo
    };
  }
}

module.exports = TratamentoExternoModel;
