const { pool } = require('../../database/connection');
const EstoqueMateriaPrimaModel = require('./EstoqueMateriaPrimaModel');
const TratamentoExternoModel = require('./TratamentoExternoModel');

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
          mp.liga AS materia_prima_liga,
          mp.material AS materia_prima_material,
          mp.geometria AS materia_prima_geometria,
          mp.bitola AS materia_prima_bitola,
          mp.bitola_mm AS materia_prima_bitola_mm,
          mp.comprimento_padrao_mm AS materia_prima_comprimento_padrao_mm,
          mp.unidade_estoque AS materia_prima_unidade_estoque
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
          mp.liga AS materia_prima_liga,
          mp.material AS materia_prima_material,
          mp.geometria AS materia_prima_geometria,
          mp.bitola AS materia_prima_bitola,
          mp.bitola_mm AS materia_prima_bitola_mm,
          mp.unidade_estoque AS materia_prima_unidade_estoque,
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
          mp.unidade_estoque AS materia_prima_unidade_estoque,
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

  static async findMateriaPrimaById(id, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          codigo,
          nome,
          categoria,
          geometria,
          unidade_estoque,
          peso_por_metro,
          peso_unitario_kg
        FROM materias_primas
        WHERE id = ?
      `,
      [id]
    );

    return rows[0] || null;
  }

  static isFundido(materiaPrima) {
    const categoria = String(materiaPrima?.categoria || materiaPrima?.materia_prima_categoria || '').toUpperCase();
    const geometria = String(materiaPrima?.geometria || materiaPrima?.materia_prima_geometria || '').toUpperCase();
    return categoria === 'FUNDIDO' || geometria === 'FUNDIDO';
  }

  static getStockConsumptionUnit(materiaPrima) {
    return this.isFundido(materiaPrima) ? 'UN' : 'KG';
  }

  static getCommittedStockConsumption(ordem) {
    if (!ordem || !Number(ordem.quantidade_consumida_materia_prima)) {
      return 0;
    }

    if (this.isFundido(ordem)) {
      return Number(ordem.quantidade_consumida_materia_prima || 0);
    }

    return Number(ordem.peso_consumido_kg || 0);
  }

  static calculateMateriaPrimaConsumption({ materiaPrima, peca = {}, quantidadeTotal, comprimentoCorteMm = null }) {
    const total = Number(quantidadeTotal || 0);
    if (!Number.isFinite(total) || total <= 0) {
      throw this.createBusinessError('A quantidade total da producao deve ser maior que zero.');
    }

    if (this.isFundido(materiaPrima)) {
      const pesoUnitario = Number(materiaPrima.peso_unitario_kg || 0);
      return {
        quantidadeConsumida: total,
        unidadeConsumo: 'UN',
        pesoConsumido: pesoUnitario > 0
          ? Number((total * pesoUnitario).toFixed(4))
          : null,
        comprimentoCorteUsado: null,
        quantidadeBaixadaEstoque: total,
        unidadeBaixaEstoque: 'UN'
      };
    }

    const comprimentoCorteUsado = comprimentoCorteMm && Number(comprimentoCorteMm) > 0
      ? Number(comprimentoCorteMm)
      : Number(peca.comprimento_mm || peca.peca_comprimento_mm || materiaPrima.comprimento_corte_mm || 0);

    if (!comprimentoCorteUsado || comprimentoCorteUsado <= 0) {
      throw this.createBusinessError('A peca nao possui comprimento de corte em mm. Preencha isso na peca antes de iniciar a producao.');
    }

    const pesoPorMetro = Number(materiaPrima.peso_por_metro || 0);
    if (!pesoPorMetro || pesoPorMetro <= 0) {
      throw this.createBusinessError('A materia-prima nao possui peso por metro. Ajuste a materia-prima antes de iniciar a producao.');
    }

    const quantidadeConsumida = Number(((total * comprimentoCorteUsado) / 1000).toFixed(4));
    const pesoConsumido = Number((quantidadeConsumida * pesoPorMetro).toFixed(4));

    return {
      quantidadeConsumida,
      unidadeConsumo: 'M',
      pesoConsumido,
      comprimentoCorteUsado,
      quantidadeBaixadaEstoque: pesoConsumido,
      unidadeBaixaEstoque: 'KG'
    };
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

      let materiaPrimaId = peca.id_materia_prima || null;
      let materiaPrima = null;

      if (data.id_materia_prima) {
        materiaPrima = await this.findMateriaPrimaById(data.id_materia_prima, connection);
        if (!materiaPrima) {
          throw this.createBusinessError('A materia-prima selecionada para a ordem nao foi encontrada.');
        }

        materiaPrimaId = materiaPrima.id;
      }

      if (!materiaPrimaId) {
        throw this.createBusinessError('A peca nao possui materia-prima vinculada. Ajuste a peca antes de iniciar a producao.');
      }

      if (!materiaPrima) {
        materiaPrima = await this.findMateriaPrimaById(materiaPrimaId, connection);
      }

      if (!materiaPrima) {
        throw this.createBusinessError('A materia-prima selecionada para a ordem nao foi encontrada.');
      }

      const comprimentoCorte = data.comprimento_corte_mm && Number(data.comprimento_corte_mm) > 0
        ? Number(data.comprimento_corte_mm)
        : (peca.comprimento_mm || null);
      const consumoPlanejado = this.calculateMateriaPrimaConsumption({
        materiaPrima,
        peca,
        quantidadeTotal: data.quantidade_planejada,
        comprimentoCorteMm: comprimentoCorte
      });

      const [result] = await connection.query(
        `
          INSERT INTO producao_ordens (
            id_maquina,
            id_peca,
            id_materia_prima,
            quantidade_planejada,
            quantidade_consumida_materia_prima,
            unidade_consumo,
            peso_consumido_kg,
            comprimento_corte_mm,
            observacao_inicio
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          data.id_maquina,
          data.id_peca,
          materiaPrimaId,
          data.quantidade_planejada,
          consumoPlanejado.quantidadeConsumida,
          consumoPlanejado.unidadeConsumo,
          consumoPlanejado.pesoConsumido,
          consumoPlanejado.comprimentoCorteUsado,
          data.observacao_inicio || null
        ]
      );

      await EstoqueMateriaPrimaModel.registerConsumption(connection, {
        id_materia_prima: materiaPrimaId,
        id_producao_ordem: result.insertId,
        quantidade: consumoPlanejado.quantidadeBaixadaEstoque,
        unidade: consumoPlanejado.unidadeBaixaEstoque,
        preventNegative: true,
        observacao: `Consumo antecipado da producao ${peca.codigo} - ${peca.descricao}.`.slice(0, 255)
      });

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

      if (!ordem.id_materia_prima) {
        throw this.createBusinessError('A peca nao possui materia-prima vinculada. Ajuste a peca antes de finalizar a producao.');
      }

      const consumoFinal = this.calculateMateriaPrimaConsumption({
        materiaPrima: ordem,
        peca: ordem,
        quantidadeTotal: totalFinal,
        comprimentoCorteMm: data.comprimento_corte_mm
      });
      const quantidadeJaBaixadaEstoque = this.getCommittedStockConsumption(ordem);
      const diferencaBaixaEstoque = Number((consumoFinal.quantidadeBaixadaEstoque - quantidadeJaBaixadaEstoque).toFixed(4));

      if (diferencaBaixaEstoque > 0) {
        await EstoqueMateriaPrimaModel.registerConsumption(connection, {
          id_materia_prima: ordem.id_materia_prima,
          id_producao_ordem: id,
          quantidade: diferencaBaixaEstoque,
          unidade: consumoFinal.unidadeBaixaEstoque,
          preventNegative: true,
          observacao: `Complemento de consumo da producao ${ordem.peca_codigo} - ${ordem.peca_descricao}.`.slice(0, 255)
        });
      } else if (diferencaBaixaEstoque < 0) {
        await EstoqueMateriaPrimaModel.registerReturnFromProductionDelete(connection, {
          id_materia_prima: ordem.id_materia_prima,
          id_producao_ordem: id,
          quantidade: Math.abs(diferencaBaixaEstoque),
          unidade: consumoFinal.unidadeBaixaEstoque,
          observacao: `Devolucao de materia-prima da producao ${ordem.peca_codigo} - ${ordem.peca_descricao}.`.slice(0, 255)
        });
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
            comprimento_corte_mm = ?,
            status = 'FINALIZADA',
            observacao_fim = ?,
            data_fim = NOW()
          WHERE id = ?
        `,
        [
          data.quantidade_produzida,
          data.quantidade_refugo,
          consumoFinal.quantidadeConsumida,
          consumoFinal.unidadeConsumo,
          consumoFinal.pesoConsumido,
          consumoFinal.comprimentoCorteUsado,
          data.observacao_fim || null,
          id
        ]
      );

      if (consumoFinal.comprimentoCorteUsado && Number(consumoFinal.comprimentoCorteUsado) > 0) {
        await connection.query(
          `
            UPDATE pecas
            SET comprimento_mm = ?
            WHERE id = ?
          `,
          [consumoFinal.comprimentoCorteUsado, ordem.id_peca]
        );
      }

      await TratamentoExternoModel.registerEntradaProducao(connection, {
        id_peca: ordem.id_peca,
        id_producao_ordem: id,
        quantidade: data.quantidade_produzida,
        observacao: `Entrada vinda da producao ${ordem.peca_codigo} - ${ordem.peca_descricao}.`.slice(0, 255)
      });

      await connection.commit();
      return this.findById(id, connection);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async delete(id) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const ordem = await this.findById(id, connection);
      if (!ordem) {
        throw this.createBusinessError('Ordem de producao nao encontrada.');
      }

      if (ordem.status === 'FINALIZADA') {
        if (!ordem.id_materia_prima) {
          throw this.createBusinessError('A ordem finalizada nao possui materia-prima vinculada para estorno.');
        }

        const quantidadeEstornoMp = this.getCommittedStockConsumption(ordem);
        const unidadeEstorno = this.getStockConsumptionUnit(ordem);

        await TratamentoExternoModel.removeProducedEntry(connection, {
          id_peca: ordem.id_peca,
          id_producao_ordem: ordem.id,
          quantidade: Number(ordem.quantidade_produzida || 0),
          observacao: `Estorno da ordem de producao ${ordem.id}.`
        });

        if (quantidadeEstornoMp > 0) {
          await EstoqueMateriaPrimaModel.registerReturnFromProductionDelete(connection, {
            id_materia_prima: ordem.id_materia_prima,
            id_producao_ordem: ordem.id,
            quantidade: quantidadeEstornoMp,
            unidade: unidadeEstorno,
            observacao: `Estorno da ordem de producao ${ordem.id}.`
          });
        }
      }

      if (ordem.status === 'EM_ANDAMENTO') {
        const quantidadeEstornoMp = this.getCommittedStockConsumption(ordem);

        if (quantidadeEstornoMp > 0) {
          await EstoqueMateriaPrimaModel.registerReturnFromProductionDelete(connection, {
            id_materia_prima: ordem.id_materia_prima,
            id_producao_ordem: ordem.id,
            quantidade: quantidadeEstornoMp,
            unidade: this.getStockConsumptionUnit(ordem),
            observacao: `Cancelamento da ordem de producao ${ordem.id}.`
          });
        }

        await connection.query(
          `
            UPDATE producao_ordens
            SET
              status = 'CANCELADA',
              observacao_fim = COALESCE(observacao_fim, 'Ordem cancelada.'),
              data_fim = NOW()
            WHERE id = ?
          `,
          [id]
        );

        await connection.commit();
        return this.findById(id, connection);
      }

      await connection.query(
        `
          DELETE FROM producao_ordens
          WHERE id = ?
        `,
        [id]
      );

      await connection.commit();
      return {
        id: ordem.id,
        status: ordem.status,
        peca_codigo: ordem.peca_codigo,
        peca_descricao: ordem.peca_descricao
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = ProducaoModel;
