const { pool } = require('../../database/connection');

class ProducaoModel {
  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static async findAll(filters = {}) {
    const conditions = ['1 = 1'];
    const values = [];

    if (filters.status) {
      conditions.push('po.status = ?');
      values.push(filters.status);
    }

    if (filters.q) {
      conditions.push(`
        (
          p.codigo LIKE ?
          OR p.descricao LIKE ?
          OR m.nome LIKE ?
          OR COALESCE(mp.codigo, '') LIKE ?
          OR COALESCE(mp.nome, '') LIKE ?
        )
      `);
      values.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          po.id,
          po.id_maquina,
          po.id_peca,
          po.id_materia_prima,
          po.quantidade_planejada,
          po.quantidade_produzida,
          po.quantidade_refugo,
          po.quantidade_consumida_materia_prima,
          po.unidade_consumo,
          po.peso_consumido_kg,
          po.comprimento_corte_mm,
          po.status,
          po.observacao_inicio,
          po.observacao_fim,
          po.data_inicio,
          po.data_fim,
          po.created_at,
          po.updated_at,
          m.nome AS maquina_nome,
          m.tipo AS maquina_tipo,
          p.codigo AS peca_codigo,
          p.descricao AS peca_descricao,
          p.tipo AS peca_tipo,
          p.classificacao AS peca_classificacao,
          mp.codigo AS materia_prima_codigo,
          mp.nome AS materia_prima_nome,
          mp.material AS materia_prima_material,
          mp.geometria AS materia_prima_geometria
        FROM producao_ordens po
        INNER JOIN maquinas m ON m.id = po.id_maquina
        INNER JOIN pecas p ON p.id = po.id_peca
        LEFT JOIN materias_primas mp ON mp.id = po.id_materia_prima
        WHERE ${conditions.join(' AND ')}
        ORDER BY
          CASE po.status
            WHEN 'EM_ANDAMENTO' THEN 1
            WHEN 'FINALIZADA' THEN 2
            ELSE 3
          END,
          po.id DESC
      `,
      values
    );

    return rows;
  }

  static async findById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          po.id,
          po.id_maquina,
          po.id_peca,
          po.id_materia_prima,
          po.quantidade_planejada,
          po.quantidade_produzida,
          po.quantidade_refugo,
          po.quantidade_consumida_materia_prima,
          po.unidade_consumo,
          po.peso_consumido_kg,
          po.comprimento_corte_mm,
          po.status,
          po.observacao_inicio,
          po.observacao_fim,
          po.data_inicio,
          po.data_fim,
          po.created_at,
          po.updated_at,
          m.nome AS maquina_nome,
          m.tipo AS maquina_tipo,
          p.codigo AS peca_codigo,
          p.descricao AS peca_descricao,
          p.tipo AS peca_tipo,
          p.classificacao AS peca_classificacao,
          p.comprimento_mm AS peca_comprimento_mm,
          mp.codigo AS materia_prima_codigo,
          mp.nome AS materia_prima_nome,
          mp.material AS materia_prima_material,
          mp.geometria AS materia_prima_geometria,
          mp.peso_por_metro,
          mp.peso_unitario_kg
        FROM producao_ordens po
        INNER JOIN maquinas m ON m.id = po.id_maquina
        INNER JOIN pecas p ON p.id = po.id_peca
        LEFT JOIN materias_primas mp ON mp.id = po.id_materia_prima
        WHERE po.id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async findMachineById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT id, nome, tipo
        FROM maquinas
        WHERE id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async findProductionPieceById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          p.id,
          p.codigo,
          p.descricao,
          p.tipo,
          p.classificacao,
          p.comprimento_mm,
          p.id_materia_prima,
          mp.codigo AS materia_prima_codigo,
          mp.nome AS materia_prima_nome,
          mp.material AS materia_prima_material,
          mp.geometria AS materia_prima_geometria,
          mp.peso_por_metro,
          mp.peso_unitario_kg
        FROM pecas p
        LEFT JOIN materias_primas mp ON mp.id = p.id_materia_prima
        WHERE p.id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  static async create(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const maquina = await this.findMachineById(data.id_maquina, connection);
      if (!maquina) {
        throw this.createBusinessError('Maquina nao encontrada.');
      }

      const peca = await this.findProductionPieceById(data.id_peca, connection);
      if (!peca || peca.tipo !== 'PRODUZIDA' || peca.classificacao !== 'ITEM') {
        throw this.createBusinessError('Selecione uma peca produzida valida para iniciar a producao.');
      }

      const [result] = await connection.query(
        `
          INSERT INTO producao_ordens (
            id_maquina,
            id_peca,
            id_materia_prima,
            quantidade_planejada,
            comprimento_corte_mm,
            observacao_inicio
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          data.id_maquina,
          data.id_peca,
          peca.id_materia_prima || null,
          data.quantidade_planejada,
          peca.comprimento_mm || null,
          data.observacao_inicio || null
        ]
      );

      await connection.commit();
      return this.findById(result.insertId, connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async finish(id, data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const ordem = await this.findById(id, connection);
      if (!ordem) {
        throw this.createBusinessError('Ordem de producao nao encontrada.');
      }

      if (ordem.status !== 'EM_ANDAMENTO') {
        throw this.createBusinessError('Somente ordens em andamento podem ser finalizadas.');
      }

      const totalFinal = Number(data.quantidade_produzida) + Number(data.quantidade_refugo);
      if (totalFinal <= 0) {
        throw this.createBusinessError('Informe uma quantidade produzida ou refugo maior que zero.');
      }

      if (totalFinal > Number(ordem.quantidade_planejada)) {
        throw this.createBusinessError('A soma de produzida e refugo nao pode ser maior que a quantidade planejada.');
      }

      if (!ordem.id_materia_prima) {
        throw this.createBusinessError('A peca nao possui materia-prima vinculada. Ajuste a peca antes de finalizar a producao.');
      }

      let quantidadeConsumida = null;
      let unidadeConsumo = null;
      let pesoConsumido = null;

      if (String(ordem.materia_prima_geometria || '').toUpperCase() === 'FUNDIDO') {
        quantidadeConsumida = totalFinal;
        unidadeConsumo = 'UN';
        pesoConsumido = ordem.peso_unitario_kg
          ? Number((totalFinal * Number(ordem.peso_unitario_kg)).toFixed(4))
          : null;
      } else {
        if (!ordem.peca_comprimento_mm || Number(ordem.peca_comprimento_mm) <= 0) {
          throw this.createBusinessError('A peca nao possui comprimento de corte em mm. Preencha isso na peca antes de finalizar a producao.');
        }

        if (!ordem.peso_por_metro || Number(ordem.peso_por_metro) <= 0) {
          throw this.createBusinessError('A materia-prima nao possui peso por metro. Ajuste a materia-prima antes de finalizar a producao.');
        }

        quantidadeConsumida = Number(
          (((totalFinal * Number(ordem.peca_comprimento_mm)) / 1000)).toFixed(4)
        );
        unidadeConsumo = 'M';
        pesoConsumido = Number((quantidadeConsumida * Number(ordem.peso_por_metro)).toFixed(4));
      }

      await connection.query(
        `
          UPDATE producao_ordens
          SET
            quantidade_produzida = ?,
            quantidade_refugo = ?,
            quantidade_consumida_materia_prima = ?,
            unidade_consumo = ?,
            peso_consumido_kg = ?,
            status = 'FINALIZADA',
            observacao_fim = ?,
            data_fim = NOW()
          WHERE id = ?
        `,
        [
          data.quantidade_produzida,
          data.quantidade_refugo,
          quantidadeConsumida,
          unidadeConsumo,
          pesoConsumido,
          data.observacao_fim || null,
          id
        ]
      );

      await connection.commit();
      return this.findById(id, connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = ProducaoModel;
