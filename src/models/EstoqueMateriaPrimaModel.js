const { pool } = require('../../database/connection');

class EstoqueMateriaPrimaModel {
  static supplierSummarySubquery() {
    return `
      SELECT
        mpf.id_materia_prima,
        GROUP_CONCAT(DISTINCT f.nome ORDER BY f.nome SEPARATOR ', ') AS fornecedores_nomes
      FROM materia_prima_fornecedor mpf
      INNER JOIN fornecedores f ON f.id = mpf.id_fornecedor
      GROUP BY mpf.id_materia_prima
    `;
  }

  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static async findMateriaPrimaById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          mp.id,
          mp.codigo,
          mp.nome,
          mp.categoria,
          mp.material,
          mp.liga,
          mp.geometria,
          mp.bitola,
          mp.bitola_mm,
          mp.comprimento_padrao_mm,
          mp.peso_por_metro,
          mp.peso_unitario_kg,
          mp.unidade_estoque,
          COALESCE(fs.fornecedores_nomes, fp.nome, '') AS fornecedores_nomes
        FROM materias_primas mp
        LEFT JOIN fornecedores fp ON fp.id = mp.id_fornecedor_principal
        LEFT JOIN (${this.supplierSummarySubquery()}) fs ON fs.id_materia_prima = mp.id
        WHERE mp.id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async findSaldoByMateriaPrimaId(idMateriaPrima) {
    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.id_materia_prima,
          s.quantidade,
          s.created_at,
          s.updated_at,
          mp.codigo,
          mp.nome,
          mp.categoria,
          mp.liga,
          mp.geometria,
          mp.bitola,
          mp.bitola_mm,
          mp.unidade_estoque,
          COALESCE(fs.fornecedores_nomes, fp.nome, '') AS fornecedores_nomes
        FROM estoque_materias_primas_saldos s
        INNER JOIN materias_primas mp ON mp.id = s.id_materia_prima
        LEFT JOIN fornecedores fp ON fp.id = mp.id_fornecedor_principal
        LEFT JOIN (${this.supplierSummarySubquery()}) fs ON fs.id_materia_prima = mp.id
        WHERE s.id_materia_prima = ?
      `,
      [idMateriaPrima]
    );

    return rows[0] || null;
  }

  static async findSaldoSnapshotByMateriaPrimaId(idMateriaPrima) {
    const [rows] = await pool.query(
      `
        SELECT
          mp.id AS id_materia_prima,
          mp.codigo,
          mp.nome,
          mp.categoria,
          mp.material,
          mp.liga,
          mp.geometria,
          mp.bitola,
          mp.bitola_mm,
          mp.comprimento_padrao_mm,
          mp.peso_por_metro,
          mp.peso_unitario_kg,
          mp.unidade_estoque,
          COALESCE(s.quantidade, 0) AS quantidade,
          COALESCE(fs.fornecedores_nomes, fp.nome, '') AS fornecedores_nomes
        FROM materias_primas mp
        LEFT JOIN estoque_materias_primas_saldos s ON s.id_materia_prima = mp.id
        LEFT JOIN fornecedores fp ON fp.id = mp.id_fornecedor_principal
        LEFT JOIN (${this.supplierSummarySubquery()}) fs ON fs.id_materia_prima = mp.id
        WHERE mp.id = ?
      `,
      [idMateriaPrima]
    );

    return rows[0] || null;
  }

  static async findSaldos(filters = {}) {
    const conditions = ['COALESCE(s.quantidade, 0) > 0'];
    const values = [];

    if (filters.codigo) {
      conditions.push('mp.codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.nome) {
      conditions.push('mp.nome LIKE ?');
      values.push(`%${filters.nome}%`);
    }

    if (filters.categoria) {
      conditions.push('mp.categoria = ?');
      values.push(filters.categoria);
    }

    if (filters.geometria) {
      conditions.push('mp.geometria = ?');
      values.push(filters.geometria);
    }

    if (filters.bitola) {
      conditions.push('(COALESCE(mp.bitola, \'\') LIKE ? OR CAST(mp.bitola_mm AS CHAR) LIKE ?)');
      values.push(`%${filters.bitola}%`, `%${filters.bitola}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          COALESCE(s.id, 0) AS id,
          mp.id AS id_materia_prima,
          mp.codigo,
          mp.nome,
          mp.categoria,
          mp.material,
          mp.liga,
          mp.geometria,
          mp.bitola,
          mp.bitola_mm,
          mp.comprimento_padrao_mm,
          mp.peso_por_metro,
          mp.peso_unitario_kg,
          mp.unidade_estoque,
          COALESCE(s.quantidade, 0) AS quantidade,
          COALESCE(fs.fornecedores_nomes, fp.nome, '') AS fornecedores_nomes,
          s.created_at,
          s.updated_at
        FROM materias_primas mp
        LEFT JOIN estoque_materias_primas_saldos s ON s.id_materia_prima = mp.id
        LEFT JOIN fornecedores fp ON fp.id = mp.id_fornecedor_principal
        LEFT JOIN (${this.supplierSummarySubquery()}) fs ON fs.id_materia_prima = mp.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY mp.codigo ASC
      `,
      values
    );

    return rows;
  }

  static async findMovimentacoes(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.id_materia_prima) {
      conditions.push('mov.id_materia_prima = ?');
      values.push(filters.id_materia_prima);
    }

    const [rows] = await pool.query(
      `
        SELECT
          mov.id,
          mov.id_materia_prima,
          mov.id_producao_ordem,
          mov.tipo_movimentacao,
          mov.quantidade,
          mov.unidade,
          mov.saldo_resultante,
          mov.observacao,
          mov.data_movimentacao,
          mp.codigo,
          mp.nome,
          mp.categoria,
          mp.unidade_estoque
        FROM estoque_materias_primas_movimentacoes mov
        INNER JOIN materias_primas mp ON mp.id = mov.id_materia_prima
        WHERE ${conditions.join(' AND ')}
        ORDER BY mov.data_movimentacao DESC, mov.id DESC
      `,
      values
    );

    return rows;
  }

  static async findSaldoForUpdate(connection, idMateriaPrima) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          id_materia_prima,
          quantidade
        FROM estoque_materias_primas_saldos
        WHERE id_materia_prima = ?
        FOR UPDATE
      `,
      [idMateriaPrima]
    );

    return rows[0] || null;
  }

  static async persistSaldo(connection, idMateriaPrima, quantidade, saldoAtual) {
    if (saldoAtual) {
      await connection.query(
        `
          UPDATE estoque_materias_primas_saldos
          SET quantidade = ?
          WHERE id = ?
        `,
        [quantidade, saldoAtual.id]
      );
      return;
    }

    await connection.query(
      `
        INSERT INTO estoque_materias_primas_saldos (
          id_materia_prima,
          quantidade
        ) VALUES (?, ?)
      `,
      [idMateriaPrima, quantidade]
    );
  }

  static async createMovimentacao(connection, data) {
    await connection.query(
      `
        INSERT INTO estoque_materias_primas_movimentacoes (
          id_materia_prima,
          id_producao_ordem,
          tipo_movimentacao,
          quantidade,
          unidade,
          saldo_resultante,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.id_materia_prima,
        data.id_producao_ordem || null,
        data.tipo_movimentacao,
        data.quantidade,
        data.unidade,
        data.saldo_resultante ?? null,
        data.observacao || null
      ]
    );
  }

  static async processEntrada(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const materiaPrima = await this.findMateriaPrimaById(data.id_materia_prima, connection);
      if (!materiaPrima) {
        throw this.createBusinessError('Materia-prima nao encontrada.');
      }

      const saldoAtual = await this.findSaldoForUpdate(connection, data.id_materia_prima);
      const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
      const novoSaldo = Number((quantidadeAtual + Number(data.quantidade)).toFixed(4));

      await this.persistSaldo(connection, data.id_materia_prima, novoSaldo, saldoAtual);
      await this.createMovimentacao(connection, {
        id_materia_prima: data.id_materia_prima,
        tipo_movimentacao: 'ENTRADA',
        quantidade: Number(data.quantidade),
        unidade: materiaPrima.unidade_estoque,
        saldo_resultante: novoSaldo,
        observacao: data.observacao || 'Entrada manual no estoque de materia-prima.'
      });

      await connection.commit();
      return this.findSaldoByMateriaPrimaId(data.id_materia_prima);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async processAjuste(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const materiaPrima = await this.findMateriaPrimaById(data.id_materia_prima, connection);
      if (!materiaPrima) {
        throw this.createBusinessError('Materia-prima nao encontrada.');
      }

      const saldoAtual = await this.findSaldoForUpdate(connection, data.id_materia_prima);
      const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
      const novoSaldo = Number(Number(data.novo_saldo).toFixed(4));

      await this.persistSaldo(connection, data.id_materia_prima, novoSaldo, saldoAtual);

      const diferenca = Number(Math.abs(novoSaldo - quantidadeAtual).toFixed(4));
      if (diferenca > 0) {
        await this.createMovimentacao(connection, {
          id_materia_prima: data.id_materia_prima,
          tipo_movimentacao: 'AJUSTE',
          quantidade: diferenca,
          unidade: materiaPrima.unidade_estoque,
          saldo_resultante: novoSaldo,
          observacao: data.observacao || 'Ajuste manual de saldo da materia-prima.'
        });
      }

      await connection.commit();
      return this.findSaldoByMateriaPrimaId(data.id_materia_prima);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async registerConsumption(connection, data) {
    const materiaPrima = await this.findMateriaPrimaById(data.id_materia_prima, connection);
    if (!materiaPrima) {
      throw this.createBusinessError('Materia-prima nao encontrada para consumo da producao.');
    }

    const saldoAtual = await this.findSaldoForUpdate(connection, data.id_materia_prima);
    const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
    const quantidadeConsumida = Number(Number(data.quantidade).toFixed(4));

    if (quantidadeConsumida <= 0) {
      return {
        quantidade_consumida: 0,
        saldo_resultante: quantidadeAtual,
        unidade: materiaPrima.unidade_estoque
      };
    }

    const novoSaldo = Number((quantidadeAtual - quantidadeConsumida).toFixed(4));

    await this.persistSaldo(connection, data.id_materia_prima, novoSaldo, saldoAtual);
    await this.createMovimentacao(connection, {
      id_materia_prima: data.id_materia_prima,
      id_producao_ordem: data.id_producao_ordem || null,
      tipo_movimentacao: 'CONSUMO_PRODUCAO',
      quantidade: quantidadeConsumida,
      unidade: data.unidade || materiaPrima.unidade_estoque,
      saldo_resultante: novoSaldo,
      observacao: data.observacao || 'Consumo automatico da materia-prima na producao.'
    });

    return {
      quantidade_consumida: quantidadeConsumida,
      saldo_resultante: novoSaldo,
      unidade: data.unidade || materiaPrima.unidade_estoque
    };
  }

  static async registerReturnFromProductionDelete(connection, data) {
    const materiaPrima = await this.findMateriaPrimaById(data.id_materia_prima, connection);
    if (!materiaPrima) {
      throw this.createBusinessError('Materia-prima nao encontrada para estorno.');
    }

    const saldoAtual = await this.findSaldoForUpdate(connection, data.id_materia_prima);
    const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
    const quantidadeEntrada = Number(Number(data.quantidade).toFixed(4));
    const novoSaldo = Number((quantidadeAtual + quantidadeEntrada).toFixed(4));

    await this.persistSaldo(connection, data.id_materia_prima, novoSaldo, saldoAtual);
    await this.createMovimentacao(connection, {
      id_materia_prima: data.id_materia_prima,
      id_producao_ordem: data.id_producao_ordem || null,
      tipo_movimentacao: 'AJUSTE',
      quantidade: quantidadeEntrada,
      unidade: data.unidade || materiaPrima.unidade_estoque,
      saldo_resultante: novoSaldo,
      observacao: data.observacao || 'Estorno de consumo da producao.'
    });

    return {
      quantidade_entrada: quantidadeEntrada,
      saldo_resultante: novoSaldo,
      unidade: data.unidade || materiaPrima.unidade_estoque
    };
  }
}

module.exports = EstoqueMateriaPrimaModel;
