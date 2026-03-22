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
    if (quantidade < 0) {
      throw this.createBusinessError('O saldo de tratamento externo nao pode ficar negativo.');
    }

    if (saldoAtual && Number(quantidade) === 0) {
      await connection.query(
        `
          DELETE FROM tratamento_externo_saldos
          WHERE id = ?
        `,
        [saldoAtual.id]
      );
      return;
    }

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

  static async consumeForDispatch(connection, data) {
    const saldoAtual = await this.findSaldoForUpdate(connection, data.id_peca);
    const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
    const quantidadeSaida = Number(Number(data.quantidade).toFixed(2));

    if (quantidadeSaida <= 0) {
      throw this.createBusinessError('A quantidade de saida do tratamento externo deve ser maior que zero.');
    }

    if (quantidadeSaida > quantidadeAtual) {
      throw this.createBusinessError('Saldo insuficiente no tratamento externo para o encaminhamento.');
    }

    const novoSaldo = Number((quantidadeAtual - quantidadeSaida).toFixed(2));

    await this.persistSaldo(connection, data.id_peca, novoSaldo, saldoAtual);
    await this.createMovimentacao(connection, {
      id_peca: data.id_peca,
      tipo_movimentacao: 'SAIDA',
      quantidade: quantidadeSaida,
      saldo_resultante: novoSaldo,
      observacao: data.observacao || 'Saida do tratamento externo.'
    });

    return {
      quantidade_saida: quantidadeSaida,
      saldo_resultante: novoSaldo
    };
  }

  static async removeProducedEntry(connection, data) {
    const saldoAtual = await this.findSaldoForUpdate(connection, data.id_peca);
    const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
    const quantidadeRemover = Number(Number(data.quantidade).toFixed(2));

    if (quantidadeRemover > quantidadeAtual) {
      throw this.createBusinessError(
        'Nao foi possivel excluir a producao porque a quantidade produzida ja foi movimentada no tratamento externo.'
      );
    }

    const novoSaldo = Number((quantidadeAtual - quantidadeRemover).toFixed(2));

    await this.persistSaldo(connection, data.id_peca, novoSaldo, saldoAtual);
    await this.createMovimentacao(connection, {
      id_peca: data.id_peca,
      id_producao_ordem: data.id_producao_ordem || null,
      tipo_movimentacao: 'AJUSTE',
      quantidade: quantidadeRemover,
      saldo_resultante: novoSaldo,
      observacao: data.observacao || 'Estorno da producao no tratamento externo.'
    });
  }

  static async findStockById(connection, idEstoque) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          nome,
          ativo
        FROM estoques
        WHERE id = ?
      `,
      [idEstoque]
    );

    return rows[0] || null;
  }

  static async findStockSaldoForUpdate(connection, idEstoque, idPeca) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          quantidade
        FROM estoque_saldos
        WHERE id_estoque = ? AND id_peca = ?
        FOR UPDATE
      `,
      [idEstoque, idPeca]
    );

    return rows[0] || null;
  }

  static async persistStockSaldo(connection, idEstoque, idPeca, quantidade, saldoAtual) {
    if (quantidade < 0) {
      throw this.createBusinessError('O saldo do estoque nao pode ficar negativo.');
    }

    if (saldoAtual && Number(quantidade) === 0) {
      await connection.query(
        `
          DELETE FROM estoque_saldos
          WHERE id = ?
        `,
        [saldoAtual.id]
      );
      return;
    }

    if (saldoAtual) {
      await connection.query(
        `
          UPDATE estoque_saldos
          SET quantidade = ?
          WHERE id = ?
        `,
        [quantidade, saldoAtual.id]
      );
      return;
    }

    await connection.query(
      `
        INSERT INTO estoque_saldos (
          id_estoque,
          id_peca,
          quantidade
        ) VALUES (?, ?, ?)
      `,
      [idEstoque, idPeca, quantidade]
    );
  }

  static async createStockMovimentacao(connection, data) {
    await connection.query(
      `
        INSERT INTO estoque_movimentacoes (
          id_peca,
          id_estoque_origem,
          id_estoque_destino,
          tipo_movimentacao,
          quantidade,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        data.id_peca,
        data.id_estoque_origem || null,
        data.id_estoque_destino || null,
        data.tipo_movimentacao,
        data.quantidade,
        data.observacao || null
      ]
    );
  }

  static async sendToStock(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const estoqueDestino = await this.findStockById(connection, data.id_estoque_destino);
      if (!estoqueDestino || Number(estoqueDestino.ativo) !== 1) {
        throw this.createBusinessError('Estoque de destino nao encontrado ou inativo.');
      }

      await this.consumeForDispatch(connection, {
        id_peca: data.id_peca,
        quantidade: data.quantidade,
        observacao: `Envio direto ao estoque ${estoqueDestino.nome}.`
      });

      const saldoDestino = await this.findStockSaldoForUpdate(connection, data.id_estoque_destino, data.id_peca);
      const quantidadeDestino = saldoDestino ? Number(saldoDestino.quantidade) : 0;
      const novoSaldoDestino = Number((quantidadeDestino + Number(data.quantidade)).toFixed(2));

      await this.persistStockSaldo(connection, data.id_estoque_destino, data.id_peca, novoSaldoDestino, saldoDestino);
      await this.createStockMovimentacao(connection, {
        id_peca: data.id_peca,
        id_estoque_destino: data.id_estoque_destino,
        tipo_movimentacao: 'ENTRADA_INICIAL',
        quantidade: Number(data.quantidade),
        observacao: data.observacao || `Entrada vinda do tratamento externo para ${estoqueDestino.nome}.`
      });

      await connection.commit();
      return {
        estoque_destino: estoqueDestino,
        saldo_destino_atual: novoSaldoDestino
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async receiveFromThirdParty(connection, data) {
    const estoqueDestino = await this.findStockById(connection, data.id_estoque_destino);
    if (!estoqueDestino || Number(estoqueDestino.ativo) !== 1) {
      throw this.createBusinessError('Estoque de destino nao encontrado ou inativo.');
    }

    const saldoDestino = await this.findStockSaldoForUpdate(connection, data.id_estoque_destino, data.id_peca);
    const quantidadeDestino = saldoDestino ? Number(saldoDestino.quantidade) : 0;
    const novoSaldoDestino = Number((quantidadeDestino + Number(data.quantidade)).toFixed(2));

    await this.persistStockSaldo(connection, data.id_estoque_destino, data.id_peca, novoSaldoDestino, saldoDestino);
    await this.createStockMovimentacao(connection, {
      id_peca: data.id_peca,
      id_estoque_destino: data.id_estoque_destino,
      tipo_movimentacao: 'ENTRADA_INICIAL',
      quantidade: Number(data.quantidade),
      observacao: data.observacao || `Retorno de terceirizacao recebido no estoque ${estoqueDestino.nome}.`
    });

    return {
      estoque_destino: estoqueDestino,
      saldo_destino_atual: novoSaldoDestino
    };
  }
}

module.exports = TratamentoExternoModel;
