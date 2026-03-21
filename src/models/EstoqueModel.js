// Model principal do controle de estoque de pecas e submontagens.
const { pool } = require('../../database/connection');

class EstoqueModel {
  static EXPEDICAO_NOME = 'Expedição';

  // Cria um erro de negocio padronizado para as validacoes do fluxo.
  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  // Lista os estoques ativos para popular filtros e selects.
  static async findStocks() {
    const [rows] = await pool.query(
      `
        SELECT
          id,
          nome,
          descricao,
          ativo,
          created_at,
          updated_at
        FROM estoques
        WHERE ativo = 1
        ORDER BY
          CASE
            WHEN nome = 'Almoxarifado' THEN 1
            WHEN nome = 'Montagem' THEN 2
            WHEN nome = 'Expedição' THEN 3
            ELSE 99
          END,
          nome ASC
      `
    );

    return rows;
  }

  // Lista itens simples e submontagens para os modais de movimentacao.
  static async findItemsForStock() {
    const [rows] = await pool.query(
      `
        SELECT
          p.id,
          p.codigo,
          p.descricao,
          COALESCE(p.tipo, '-') AS tipo,
          p.classificacao,
          p.id_maquina,
          COALESCE(m.nome, '-') AS maquina_nome
        FROM pecas p
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        WHERE p.classificacao IN ('ITEM', 'SUBMONTAGEM')
        ORDER BY p.codigo ASC
      `
    );

    return rows;
  }

  // Lista os saldos com filtros dinamicos por estoque, item e atributos da peca.
  static async findSaldos(filters = {}) {
    const conditions = ['s.quantidade >= 0'];
    const values = [];
    const orderBy = filters.ordem_quantidade
      ? `s.quantidade ${filters.ordem_quantidade}, p.codigo ASC`
      : `
          CASE
            WHEN e.nome = 'Almoxarifado' THEN 1
            WHEN e.nome = 'Montagem' THEN 2
            WHEN e.nome = 'Expedição' THEN 3
            ELSE 99
          END,
          p.codigo ASC
        `;

    if (filters.estoque) {
      conditions.push('e.id = ?');
      values.push(filters.estoque);
    }

    if (filters.codigo) {
      conditions.push('p.codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.descricao) {
      conditions.push('p.descricao LIKE ?');
      values.push(`%${filters.descricao}%`);
    }

    if (filters.tipo) {
      conditions.push('p.tipo = ?');
      values.push(filters.tipo);
    }

    if (filters.maquina) {
      conditions.push("COALESCE(m.nome, '') LIKE ?");
      values.push(`%${filters.maquina}%`);
    }

    if (filters.classificacao) {
      conditions.push('p.classificacao = ?');
      values.push(filters.classificacao);
    }

    if (filters.q) {
      conditions.push(`
        (
          p.codigo LIKE ?
          OR p.descricao LIKE ?
          OR e.nome LIKE ?
          OR COALESCE(m.nome, '') LIKE ?
        )
      `);
      values.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.id_estoque,
          s.id_peca,
          s.quantidade,
          s.created_at,
          s.updated_at,
          e.nome AS estoque_nome,
          e.descricao AS estoque_descricao,
          p.codigo,
          p.descricao,
          COALESCE(p.tipo, '-') AS tipo,
          p.classificacao,
          p.id_maquina,
          COALESCE(m.nome, '-') AS maquina_nome
        FROM estoque_saldos s
        INNER JOIN estoques e ON e.id = s.id_estoque
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${orderBy}
      `,
      values
    );

    return rows;
  }

  // Busca um saldo especifico com os joins da tela de estoque.
  static async findSaldoById(id) {
    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.id_estoque,
          s.id_peca,
          s.quantidade,
          s.created_at,
          s.updated_at,
          e.nome AS estoque_nome,
          p.codigo,
          p.descricao,
          COALESCE(p.tipo, '-') AS tipo,
          p.classificacao,
          p.id_maquina,
          COALESCE(m.nome, '-') AS maquina_nome
        FROM estoque_saldos s
        INNER JOIN estoques e ON e.id = s.id_estoque
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        WHERE s.id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  // Lista o historico das movimentacoes para auditoria e consulta.
  static async findMovimentacoes(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.idPeca) {
      conditions.push('em.id_peca = ?');
      values.push(filters.idPeca);
    }

    if (filters.estoque) {
      conditions.push('(em.id_estoque_origem = ? OR em.id_estoque_destino = ?)');
      values.push(filters.estoque, filters.estoque);
    }

    const [rows] = await pool.query(
      `
        SELECT
          em.id,
          em.id_peca,
          em.id_estoque_origem,
          em.id_estoque_destino,
          em.tipo_movimentacao,
          em.quantidade,
          em.observacao,
          em.data_movimentacao,
          p.codigo,
          p.descricao,
          p.classificacao,
          COALESCE(eo.nome, '-') AS estoque_origem_nome,
          COALESCE(ed.nome, '-') AS estoque_destino_nome
        FROM estoque_movimentacoes em
        INNER JOIN pecas p ON p.id = em.id_peca
        LEFT JOIN estoques eo ON eo.id = em.id_estoque_origem
        LEFT JOIN estoques ed ON ed.id = em.id_estoque_destino
        WHERE ${conditions.join(' AND ')}
        ORDER BY em.data_movimentacao DESC, em.id DESC
      `,
      values
    );

    return rows;
  }

  // Busca um item da tabela pecas para validar movimentacoes.
  static async findItemById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          p.id,
          p.codigo,
          p.descricao,
          COALESCE(p.tipo, '-') AS tipo,
          p.classificacao,
          p.id_maquina,
          COALESCE(m.nome, '-') AS maquina_nome
        FROM pecas p
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        WHERE p.id = ? AND p.classificacao IN ('ITEM', 'SUBMONTAGEM')
      `,
      [id]
    );

    return rows[0] || null;
  }

  // Busca um estoque pelo ID para validar origem e destino.
  static async findStockById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          nome,
          descricao,
          ativo
        FROM estoques
        WHERE id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  // Busca um estoque pelo nome para regras fixas, como a saida final pela expedicao.
  static async findStockByName(nome, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          nome,
          descricao,
          ativo
        FROM estoques
        WHERE nome = ?
      `,
      [nome]
    );

    return rows[0] || null;
  }

  // Le o saldo atual travando a linha durante a transacao.
  static async findSaldoForUpdate(connection, idEstoque, idPeca) {
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

  // Persiste o novo saldo removendo a linha quando a quantidade chega a zero.
  static async persistSaldo(connection, idEstoque, idPeca, novaQuantidade, saldoAtual = null) {
    if (novaQuantidade < 0) {
      throw this.createBusinessError('O saldo nao pode ficar negativo.');
    }

    const saldoExistente = saldoAtual || await this.findSaldoForUpdate(connection, idEstoque, idPeca);

    if (saldoExistente && Number(novaQuantidade) === 0) {
      await connection.query(
        `
          DELETE FROM estoque_saldos
          WHERE id = ?
        `,
        [saldoExistente.id]
      );
    } else if (saldoExistente) {
      await connection.query(
        `
          UPDATE estoque_saldos
          SET quantidade = ?
          WHERE id = ?
        `,
        [novaQuantidade, saldoExistente.id]
      );
    } else if (Number(novaQuantidade) > 0) {
      await connection.query(
        `
          INSERT INTO estoque_saldos (
            id_estoque,
            id_peca,
            quantidade
          ) VALUES (?, ?, ?)
        `,
        [idEstoque, idPeca, novaQuantidade]
      );
    }
  }

  // Grava uma movimentacao no historico do estoque.
  static async createMovimentacao(connection, data) {
    const [result] = await connection.query(
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
        data.id_estoque_origem,
        data.id_estoque_destino,
        data.tipo_movimentacao,
        data.quantidade,
        data.observacao
      ]
    );

    return result.insertId;
  }

  // Realiza uma entrada inicial somando o saldo no estoque escolhido.
  static async processEntradaInicial(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const item = await this.findItemById(data.id_peca, connection);
      if (!item) {
        throw this.createBusinessError('Item nao encontrado para a entrada inicial.');
      }

      const estoqueDestino = await this.findStockById(data.id_estoque_destino, connection);
      if (!estoqueDestino || Number(estoqueDestino.ativo) !== 1) {
        throw this.createBusinessError('Estoque de destino nao encontrado ou inativo.');
      }

      const saldoAtual = await this.findSaldoForUpdate(
        connection,
        data.id_estoque_destino,
        data.id_peca
      );

      const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
      const novoSaldo = quantidadeAtual + Number(data.quantidade);

      await this.persistSaldo(
        connection,
        data.id_estoque_destino,
        data.id_peca,
        novoSaldo,
        saldoAtual
      );

      await this.createMovimentacao(connection, {
        id_peca: data.id_peca,
        id_estoque_origem: null,
        id_estoque_destino: data.id_estoque_destino,
        tipo_movimentacao: 'ENTRADA_INICIAL',
        quantidade: data.quantidade,
        observacao: data.observacao || 'Entrada inicial registrada manualmente.'
      });

      await connection.commit();

      return {
        item,
        estoque_destino: estoqueDestino,
        saldo_anterior: quantidadeAtual,
        saldo_atual: novoSaldo
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Realiza transferencia entre dois estoques atualizando origem e destino.
  static async processTransferencia(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      if (data.id_estoque_origem === data.id_estoque_destino) {
        throw this.createBusinessError('O estoque de origem deve ser diferente do estoque de destino.');
      }

      const item = await this.findItemById(data.id_peca, connection);
      if (!item) {
        throw this.createBusinessError('Item nao encontrado para a transferencia.');
      }

      const estoqueOrigem = await this.findStockById(data.id_estoque_origem, connection);
      const estoqueDestino = await this.findStockById(data.id_estoque_destino, connection);

      if (!estoqueOrigem || Number(estoqueOrigem.ativo) !== 1) {
        throw this.createBusinessError('Estoque de origem nao encontrado ou inativo.');
      }

      if (!estoqueDestino || Number(estoqueDestino.ativo) !== 1) {
        throw this.createBusinessError('Estoque de destino nao encontrado ou inativo.');
      }

      const saldoOrigem = await this.findSaldoForUpdate(
        connection,
        data.id_estoque_origem,
        data.id_peca
      );

      const quantidadeOrigem = saldoOrigem ? Number(saldoOrigem.quantidade) : 0;
      const quantidadeTransferida = Number(data.quantidade);

      if (quantidadeTransferida > quantidadeOrigem) {
        throw this.createBusinessError('A quantidade informada e maior que o saldo disponivel no estoque de origem.');
      }

      const saldoDestino = await this.findSaldoForUpdate(
        connection,
        data.id_estoque_destino,
        data.id_peca
      );

      const quantidadeDestino = saldoDestino ? Number(saldoDestino.quantidade) : 0;

      await this.persistSaldo(
        connection,
        data.id_estoque_origem,
        data.id_peca,
        quantidadeOrigem - quantidadeTransferida,
        saldoOrigem
      );

      await this.persistSaldo(
        connection,
        data.id_estoque_destino,
        data.id_peca,
        quantidadeDestino + quantidadeTransferida,
        saldoDestino
      );

      await this.createMovimentacao(connection, {
        id_peca: data.id_peca,
        id_estoque_origem: data.id_estoque_origem,
        id_estoque_destino: data.id_estoque_destino,
        tipo_movimentacao: 'TRANSFERENCIA',
        quantidade: data.quantidade,
        observacao: data.observacao || 'Transferencia entre estoques.'
      });

      await connection.commit();

      return {
        item,
        estoque_origem: estoqueOrigem,
        estoque_destino: estoqueDestino,
        saldo_origem_atual: quantidadeOrigem - quantidadeTransferida,
        saldo_destino_atual: quantidadeDestino + quantidadeTransferida
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Ajusta o saldo final do estoque a partir de um novo valor informado no modal.
  static async processAjuste(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const item = await this.findItemById(data.id_peca, connection);
      if (!item) {
        throw this.createBusinessError('Item nao encontrado para o ajuste de saldo.');
      }

      const estoque = await this.findStockById(data.id_estoque, connection);
      if (!estoque || Number(estoque.ativo) !== 1) {
        throw this.createBusinessError('Estoque nao encontrado ou inativo.');
      }

      const saldoAtual = await this.findSaldoForUpdate(
        connection,
        data.id_estoque,
        data.id_peca
      );

      const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
      const novoSaldo = Number(data.novo_saldo);
      const diferenca = Number((novoSaldo - quantidadeAtual).toFixed(2));

      if (diferenca === 0) {
        throw this.createBusinessError('O novo saldo informado e igual ao saldo atual do estoque.');
      }

      await this.persistSaldo(
        connection,
        data.id_estoque,
        data.id_peca,
        novoSaldo,
        saldoAtual
      );

      await this.createMovimentacao(connection, {
        id_peca: data.id_peca,
        id_estoque_origem: diferenca < 0 ? data.id_estoque : null,
        id_estoque_destino: diferenca > 0 ? data.id_estoque : null,
        tipo_movimentacao: 'AJUSTE',
        quantidade: Math.abs(diferenca),
        observacao: data.observacao || 'Ajuste manual de saldo.'
      });

      await connection.commit();

      return {
        item,
        estoque,
        saldo_anterior: quantidadeAtual,
        saldo_atual: novoSaldo
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Realiza a saida de venda sempre a partir do estoque final de expedicao.
  static async processSaidaLote(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const expedicao = await this.findStockByName(this.EXPEDICAO_NOME, connection);

      if (!expedicao || Number(expedicao.ativo) !== 1) {
        throw this.createBusinessError('O estoque de Expedição nao esta disponivel para realizar a baixa de venda.');
      }

      const itensAgrupados = new Map();

      data.itens.forEach((item) => {
        const idPeca = Number(item.id_peca);
        const quantidade = Number(item.quantidade);

        if (!itensAgrupados.has(idPeca)) {
          itensAgrupados.set(idPeca, 0);
        }

        itensAgrupados.set(idPeca, Number((itensAgrupados.get(idPeca) + quantidade).toFixed(2)));
      });

      const resultados = [];

      for (const [idPeca, quantidade] of itensAgrupados.entries()) {
        const item = await this.findItemById(idPeca, connection);

        if (!item) {
          throw this.createBusinessError('Um dos itens informados nao foi encontrado para a baixa de venda.');
        }

        const saldoExpedicao = await this.findSaldoForUpdate(connection, expedicao.id, idPeca);
        const quantidadeAtual = saldoExpedicao ? Number(saldoExpedicao.quantidade) : 0;

        if (quantidade > quantidadeAtual) {
          throw this.createBusinessError(`Saldo insuficiente na Expedição para ${item.codigo}.`);
        }

        const novoSaldo = Number((quantidadeAtual - quantidade).toFixed(2));

        await this.persistSaldo(connection, expedicao.id, idPeca, novoSaldo, saldoExpedicao);

        await this.createMovimentacao(connection, {
          id_peca: idPeca,
          id_estoque_origem: expedicao.id,
          id_estoque_destino: null,
          tipo_movimentacao: 'SAIDA',
          quantidade,
          observacao: data.observacao || 'Baixa de venda pela Expedição.'
        });

        resultados.push({
          id_peca: idPeca,
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade_baixada: quantidade,
          saldo_restante: novoSaldo
        });
      }

      await connection.commit();

      return {
        estoque_origem: expedicao,
        itens: resultados
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = EstoqueModel;
