const { pool } = require('../../database/connection');
const EstoqueModel = require('./EstoqueModel');

class SolicitacaoEstoqueModel {
  static AREAS_DESTINO = {
    EXPEDICAO: 'Expedição',
    MONTAGEM: 'Montagem'
  };

  static ORIGENS_ATENDIMENTO = {
    ALMOXARIFADO: 'Almoxarifado',
    MONTAGEM: 'Montagem'
  };

  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static normalizeArea(area) {
    const normalized = String(area || '').trim().toUpperCase();
    return ['EXPEDICAO', 'MONTAGEM'].includes(normalized) ? normalized : '';
  }

  static normalizeOrigin(origin) {
    const normalized = String(origin || '').trim().toUpperCase();
    return ['ALMOXARIFADO', 'MONTAGEM'].includes(normalized) ? normalized : '';
  }

  static buildAreaLabel(area) {
    return area === 'EXPEDICAO' ? 'Expedição' : 'Montagem';
  }

  static buildOriginLabel(origin) {
    return origin === 'MONTAGEM' ? 'Montagem' : 'Almoxarifado';
  }

  static async findDestinationStock(connection, area) {
    const stockName = this.AREAS_DESTINO[area];
    if (!stockName) {
      throw this.createBusinessError('Area de destino invalida para a solicitacao.');
    }

    const stock = await EstoqueModel.findStockByName(stockName, connection);
    if (!stock || Number(stock.ativo) !== 1) {
      throw this.createBusinessError(`O estoque de ${this.buildAreaLabel(area)} nao esta disponivel.`);
    }

    return stock;
  }

  static async findAlmoxStock(connection) {
    const stock = await EstoqueModel.findStockByName('Almoxarifado', connection);
    if (!stock || Number(stock.ativo) !== 1) {
      throw this.createBusinessError('O estoque do Almoxarifado nao esta disponivel.');
    }

    return stock;
  }

  static async findSourceStock(connection, origin) {
    const stockName = this.ORIGENS_ATENDIMENTO[origin];
    if (!stockName) {
      throw this.createBusinessError('Origem de atendimento invalida para a solicitacao.');
    }

    const stock = await EstoqueModel.findStockByName(stockName, connection);
    if (!stock || Number(stock.ativo) !== 1) {
      throw this.createBusinessError(`O estoque de ${this.buildOriginLabel(origin)} nao esta disponivel.`);
    }

    return stock;
  }

  static async findById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          s.id,
          s.area_origem,
          s.origem_atendimento,
          s.id_peca,
          s.quantidade_solicitada,
          s.quantidade_atendida,
          GREATEST(s.quantidade_solicitada - s.quantidade_atendida, 0) AS quantidade_pendente,
          s.status,
          s.observacao,
          s.data_solicitacao,
          s.data_inicio_separacao,
          s.data_atendimento,
          p.codigo,
          p.descricao,
          p.classificacao,
          p.tipo,
          p.estoque_minimo AS quantidade_pacote,
          COALESCE(m.nome, '-') AS maquina_nome,
          COALESCE(sa.quantidade, 0) AS saldo_almoxarifado,
          CASE
            WHEN s.area_origem = 'EXPEDICAO' THEN 'Expedição'
            ELSE 'Montagem'
          END AS destino_nome,
          CASE
            WHEN s.origem_atendimento = 'MONTAGEM' THEN 'Montagem'
            ELSE 'Almoxarifado'
          END AS origem_atendimento_nome
        FROM solicitacoes_estoque s
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        LEFT JOIN estoque_saldos sa ON sa.id_peca = s.id_peca
          AND sa.id_estoque = (
            SELECT id FROM estoques WHERE nome = 'Almoxarifado' LIMIT 1
          )
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

    if (filters.origem_atendimento) {
      conditions.push('s.origem_atendimento = ?');
      values.push(filters.origem_atendimento);
    }

    if (filters.status) {
      conditions.push('s.status = ?');
      values.push(filters.status);
    }

    if (filters.abertas) {
      conditions.push("s.status IN ('PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL')");
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
          s.origem_atendimento,
          s.id_peca,
          s.quantidade_solicitada,
          s.quantidade_atendida,
          GREATEST(s.quantidade_solicitada - s.quantidade_atendida, 0) AS quantidade_pendente,
          s.status,
          s.observacao,
          s.data_solicitacao,
          s.data_inicio_separacao,
          s.data_atendimento,
          p.codigo,
          p.descricao,
          p.classificacao,
          p.tipo,
          p.estoque_minimo AS quantidade_pacote,
          COALESCE(m.nome, '-') AS maquina_nome,
          COALESCE(sa.quantidade, 0) AS saldo_almoxarifado,
          CASE
            WHEN s.area_origem = 'EXPEDICAO' THEN 'Expedição'
            ELSE 'Montagem'
          END AS destino_nome,
          CASE
            WHEN s.origem_atendimento = 'MONTAGEM' THEN 'Montagem'
            ELSE 'Almoxarifado'
          END AS origem_atendimento_nome
        FROM solicitacoes_estoque s
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        LEFT JOIN estoque_saldos sa ON sa.id_peca = s.id_peca
          AND sa.id_estoque = (
            SELECT id FROM estoques WHERE nome = 'Almoxarifado' LIMIT 1
          )
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          CASE s.status
            WHEN 'PENDENTE' THEN 1
            WHEN 'EM_SEPARACAO' THEN 2
            WHEN 'ATENDIDA_PARCIAL' THEN 3
            WHEN 'ATENDIDA' THEN 4
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
        throw this.createBusinessError('A area de origem da solicitacao deve ser valida.');
      }

      const origemAtendimento = this.normalizeOrigin(data.origem_atendimento || 'ALMOXARIFADO');
      if (!origemAtendimento) {
        throw this.createBusinessError('A origem de atendimento da solicitacao deve ser valida.');
      }

      if (area === 'MONTAGEM' && origemAtendimento !== 'ALMOXARIFADO') {
        throw this.createBusinessError('A Montagem deve solicitar pecas ao Almoxarifado.');
      }

      const item = await EstoqueModel.findItemById(data.id_peca, connection);
      if (!item) {
        throw this.createBusinessError('O item solicitado nao foi encontrado.');
      }

      const [result] = await connection.query(
        `
          INSERT INTO solicitacoes_estoque (
            area_origem,
            origem_atendimento,
            id_peca,
            quantidade_solicitada,
            observacao
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          area,
          origemAtendimento,
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

  static async startSeparation(id) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const request = await this.findById(id, connection);
      if (!request) {
        throw this.createBusinessError('Solicitacao nao encontrada.');
      }

      if (!['PENDENTE', 'ATENDIDA_PARCIAL'].includes(request.status)) {
        throw this.createBusinessError('Somente solicitacoes pendentes podem entrar em separacao.');
      }

      await connection.query(
        `
          UPDATE solicitacoes_estoque
          SET
            status = 'EM_SEPARACAO',
            data_inicio_separacao = NOW()
          WHERE id = ?
        `,
        [id]
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

  static async fulfill(id, data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [requestRows] = await connection.query(
        `
          SELECT
            id,
            area_origem,
            origem_atendimento,
            id_peca,
            quantidade_solicitada,
            quantidade_atendida,
            status,
            observacao
          FROM solicitacoes_estoque
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

      const request = requestRows[0] || null;
      if (!request) {
        throw this.createBusinessError('Solicitacao nao encontrada.');
      }

      if (!['PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL'].includes(request.status)) {
        throw this.createBusinessError('Esta solicitacao nao pode mais ser atendida.');
      }

      const item = await EstoqueModel.findItemById(request.id_peca, connection);
      if (!item) {
        throw this.createBusinessError('O item solicitado nao foi encontrado para atendimento.');
      }

      const quantidadePendente = Number(
        (Number(request.quantidade_solicitada) - Number(request.quantidade_atendida)).toFixed(2)
      );
      const quantidadeAtender = Number(Number(data.quantidade_atendida).toFixed(2));

      if (!Number.isFinite(quantidadeAtender) || quantidadeAtender <= 0) {
        throw this.createBusinessError('A quantidade atendida deve ser maior que zero.');
      }

      if (quantidadeAtender > quantidadePendente) {
        throw this.createBusinessError('A quantidade atendida nao pode ser maior que o saldo pendente da solicitacao.');
      }

      const origemAtendimento = this.normalizeOrigin(request.origem_atendimento);
      const estoqueOrigem = await this.findSourceStock(connection, origemAtendimento);
      const destino = await this.findDestinationStock(connection, request.area_origem);

      const saldoOrigem = await EstoqueModel.findSaldoForUpdate(connection, estoqueOrigem.id, request.id_peca);
      const quantidadeOrigem = saldoOrigem ? Number(saldoOrigem.quantidade) : 0;

      if (quantidadeAtender > quantidadeOrigem) {
        throw this.createBusinessError(`Saldo insuficiente em ${estoqueOrigem.nome} para ${item.codigo}.`);
      }

      const saldoDestino = await EstoqueModel.findSaldoForUpdate(connection, destino.id, request.id_peca);
      const quantidadeDestino = saldoDestino ? Number(saldoDestino.quantidade) : 0;

      const novoSaldoOrigem = Number((quantidadeOrigem - quantidadeAtender).toFixed(2));
      const novoSaldoDestino = Number((quantidadeDestino + quantidadeAtender).toFixed(2));

      await EstoqueModel.persistSaldo(connection, estoqueOrigem.id, request.id_peca, novoSaldoOrigem, saldoOrigem);
      await EstoqueModel.persistSaldo(connection, destino.id, request.id_peca, novoSaldoDestino, saldoDestino);
      await EstoqueModel.createMovimentacao(connection, {
        id_peca: request.id_peca,
        id_estoque_origem: estoqueOrigem.id,
        id_estoque_destino: destino.id,
        tipo_movimentacao: 'TRANSFERENCIA',
        quantidade: quantidadeAtender,
        observacao: `${data.observacao || 'Atendimento de solicitacao interna.'} Solicitação #${request.id} de ${estoqueOrigem.nome} para ${destino.nome}.`.slice(0, 255)
      });

      const quantidadeAtendidaTotal = Number((Number(request.quantidade_atendida) + quantidadeAtender).toFixed(2));
      const novoStatus = quantidadeAtendidaTotal >= Number(request.quantidade_solicitada)
        ? 'ATENDIDA'
        : 'ATENDIDA_PARCIAL';

      await connection.query(
        `
          UPDATE solicitacoes_estoque
          SET
            quantidade_atendida = ?,
            status = ?,
            data_atendimento = NOW(),
            observacao = ?
          WHERE id = ?
        `,
        [
          quantidadeAtendidaTotal,
          novoStatus,
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

  static async cancel(id, data = {}) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const request = await this.findById(id, connection);
      if (!request) {
        throw this.createBusinessError('Solicitacao nao encontrada.');
      }

      if (request.status === 'ATENDIDA') {
        throw this.createBusinessError('Solicitacoes atendidas nao podem ser canceladas.');
      }

      await connection.query(
        `
          UPDATE solicitacoes_estoque
          SET
            status = 'CANCELADA',
            observacao = ?
          WHERE id = ?
        `,
        [data.observacao || request.observacao || null, id]
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

module.exports = SolicitacaoEstoqueModel;
