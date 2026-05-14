const { pool } = require('../../database/connection');
const EstoqueMateriaPrimaModel = require('./EstoqueMateriaPrimaModel');
const EstoqueModel = require('./EstoqueModel');
const EstoqueEspecialModel = require('./EstoqueEspecialModel');
const TratamentoExternoModel = require('./TratamentoExternoModel');

class ProducaoModel {
  static DESTINOS = Object.freeze({
    TRATAMENTO_EXTERNO: 'TRATAMENTO_EXTERNO',
    MONTAGEM: 'MONTAGEM',
    EXPEDICAO: 'EXPEDICAO',
    PECAS_INACABADAS: 'PECAS_INACABADAS',
    RETRABALHO: 'RETRABALHO'
  });

  static STOCK_DESTINOS = Object.freeze({
    MONTAGEM: 'Montagem',
    EXPEDICAO: 'Expedi\u00e7\u00e3o',
    PECAS_INACABADAS: 'Pe\u00e7as Inacabadas',
    RETRABALHO: 'Retrabalho'
  });

  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static async ensureSchema(db = pool) {
    await db.query(
      `
        CREATE TABLE IF NOT EXISTS producao_destinos (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          id_producao_ordem INT NOT NULL,
          destino VARCHAR(40) NOT NULL,
          id_estoque_destino INT NULL,
          quantidade DECIMAL(12, 2) NOT NULL,
          observacao VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_producao_destinos_ordem
            FOREIGN KEY (id_producao_ordem) REFERENCES producao_ordens(id)
            ON DELETE CASCADE,
          CONSTRAINT fk_producao_destinos_estoque
            FOREIGN KEY (id_estoque_destino) REFERENCES estoques(id)
            ON DELETE SET NULL,
          INDEX idx_producao_destinos_ordem (id_producao_ordem),
          INDEX idx_producao_destinos_destino (destino),
          INDEX idx_producao_destinos_estoque (id_estoque_destino)
        ) ENGINE = InnoDB
          DEFAULT CHARSET = utf8mb4
          COLLATE = utf8mb4_unicode_ci
      `
    );

    await this.ensureReturnOriginColumns(db);
    await this.ensureSupportStocks(db);
    await EstoqueEspecialModel.ensureSchema(db);
  }

  static async columnExists(db, tableName, columnName) {
    const [rows] = await db.query(
      `
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1
      `,
      [tableName, columnName]
    );

    return rows.length > 0;
  }

  static async ensureReturnOriginColumns(db = pool) {
    if (!await this.columnExists(db, 'producao_ordens', 'origem_estoque_especial_tipo')) {
      await db.query(
        `
          ALTER TABLE producao_ordens
          ADD COLUMN origem_estoque_especial_tipo VARCHAR(40) NULL AFTER observacao_fim
        `
      );
    }

    if (!await this.columnExists(db, 'producao_ordens', 'origem_estoque_especial_registro_id')) {
      await db.query(
        `
          ALTER TABLE producao_ordens
          ADD COLUMN origem_estoque_especial_registro_id BIGINT NULL AFTER origem_estoque_especial_tipo
        `
      );
    }
  }

  static async ensureSupportStocks(db = pool) {
    const stocks = [
      {
        nome: this.STOCK_DESTINOS.PECAS_INACABADAS,
        descricao: 'Pecas produzidas que ainda nao seguiram para o destino final.'
      },
      {
        nome: this.STOCK_DESTINOS.RETRABALHO,
        descricao: 'Pecas separadas para retrabalho antes de voltar ao fluxo.'
      }
    ];

    for (const stock of stocks) {
      await db.query(
        `
          INSERT INTO estoques (nome, descricao, ativo)
          VALUES (?, ?, 1)
          ON DUPLICATE KEY UPDATE
            ativo = 1,
            updated_at = CURRENT_TIMESTAMP
        `,
        [stock.nome, stock.descricao]
      );
    }
  }

  static destinationSummarySubquery() {
    return `
      SELECT
        id_producao_ordem,
        SUM(quantidade) AS quantidade_destinada
      FROM producao_destinos
      GROUP BY id_producao_ordem
    `;
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
          po.origem_estoque_especial_tipo,
          po.origem_estoque_especial_registro_id,
          po.data_inicio,
          po.data_fim,
          po.created_at,
          po.updated_at,
          COALESCE(pd.quantidade_destinada, 0) AS quantidade_destinada,
          CASE
            WHEN po.quantidade_produzida IS NULL THEN po.quantidade_planejada
            ELSE po.quantidade_produzida
          END AS quantidade_base_destino,
          GREATEST(
            0,
            (
              CASE
                WHEN po.quantidade_produzida IS NULL THEN po.quantidade_planejada
                ELSE po.quantidade_produzida
              END
            ) - COALESCE(pd.quantidade_destinada, 0)
          ) AS quantidade_pendente_destino,
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
        LEFT JOIN (${this.destinationSummarySubquery()}) pd ON pd.id_producao_ordem = po.id
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
          po.origem_estoque_especial_tipo,
          po.origem_estoque_especial_registro_id,
          po.data_inicio,
          po.data_fim,
          po.created_at,
          po.updated_at,
          COALESCE(pd.quantidade_destinada, 0) AS quantidade_destinada,
          CASE
            WHEN po.quantidade_produzida IS NULL THEN po.quantidade_planejada
            ELSE po.quantidade_produzida
          END AS quantidade_base_destino,
          GREATEST(
            0,
            (
              CASE
                WHEN po.quantidade_produzida IS NULL THEN po.quantidade_planejada
                ELSE po.quantidade_produzida
              END
            ) - COALESCE(pd.quantidade_destinada, 0)
          ) AS quantidade_pendente_destino,
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
        LEFT JOIN (${this.destinationSummarySubquery()}) pd ON pd.id_producao_ordem = po.id
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

  static isReturnedFromSpecialStock(ordem) {
    return String(ordem?.origem_estoque_especial_tipo || '').toUpperCase() === this.DESTINOS.PECAS_INACABADAS;
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

  static normalizeDestination(destino) {
    const normalized = String(destino || '').trim().toUpperCase();
    if (!Object.values(this.DESTINOS).includes(normalized)) {
      throw this.createBusinessError('Destino de producao invalido.');
    }

    return normalized;
  }

  static normalizeDestinationQuantity(value) {
    const quantidade = Number(Number(value || 0).toFixed(2));
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw this.createBusinessError('A quantidade destinada deve ser maior que zero.');
    }

    return quantidade;
  }

  static getDestinationBaseQuantity(ordem) {
    if (ordem.quantidade_produzida !== null && ordem.quantidade_produzida !== undefined) {
      return Number(ordem.quantidade_produzida || 0);
    }

    return Number(ordem.quantidade_planejada || 0);
  }

  static async getTotalDestinado(idProducaoOrdem, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT COALESCE(SUM(quantidade), 0) AS total
        FROM producao_destinos
        WHERE id_producao_ordem = ?
      `,
      [idProducaoOrdem]
    );

    return Number(rows[0]?.total || 0);
  }

  static async findDestinations(idProducaoOrdem, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          pd.id,
          pd.id_producao_ordem,
          pd.destino,
          pd.id_estoque_destino,
          pd.quantidade,
          pd.observacao,
          pd.created_at,
          e.nome AS estoque_destino_nome
        FROM producao_destinos pd
        LEFT JOIN estoques e ON e.id = pd.id_estoque_destino
        WHERE pd.id_producao_ordem = ?
        ORDER BY pd.created_at ASC, pd.id ASC
      `,
      [idProducaoOrdem]
    );

    return rows;
  }

  static async resolveDestinationStock(connection, destino) {
    const stockName = this.STOCK_DESTINOS[destino];
    if (!stockName) {
      return null;
    }

    const stock = await EstoqueModel.findStockByName(stockName, connection);
    if (!stock || Number(stock.ativo) !== 1) {
      throw this.createBusinessError(`Estoque de destino ${stockName} nao encontrado ou inativo.`);
    }

    return stock;
  }

  static async registerStockDestination(connection, ordem, stock, quantidade, observacao) {
    const saldoAtual = await EstoqueModel.findSaldoForUpdate(connection, stock.id, ordem.id_peca);
    const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
    const novoSaldo = Number((quantidadeAtual + quantidade).toFixed(2));

    await EstoqueModel.persistSaldo(connection, stock.id, ordem.id_peca, novoSaldo, saldoAtual);
    await EstoqueModel.createMovimentacao(connection, {
      id_peca: ordem.id_peca,
      id_estoque_origem: null,
      id_estoque_destino: stock.id,
      tipo_movimentacao: 'ENTRADA_INICIAL',
      quantidade,
      observacao: observacao || `Entrada vinda da producao OP ${ordem.id}.`
    });
  }

  static async persistDestinationRecord(connection, ordem, destino, quantidade, observacao, stock = null) {
    const [result] = await connection.query(
      `
        INSERT INTO producao_destinos (
          id_producao_ordem,
          destino,
          id_estoque_destino,
          quantidade,
          observacao
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        ordem.id,
        destino,
        stock?.id || null,
        quantidade,
        observacao || null
      ]
    );

    return result.insertId;
  }

  static async applyDestination(connection, ordem, data) {
    const destino = this.normalizeDestination(data.destino);
    const quantidade = this.normalizeDestinationQuantity(data.quantidade);
    const observacao = (data.observacao || `Destino da producao OP ${ordem.id}.`).slice(0, 255);
    const defeito = data.defeito ? String(data.defeito).trim().slice(0, 255) : null;
    const faltaFazer = data.falta_fazer ? String(data.falta_fazer).trim().slice(0, 255) : null;
    let stock = null;

    if (destino === this.DESTINOS.RETRABALHO && !defeito) {
      throw this.createBusinessError('Informe o defeito para enviar pecas ao retrabalho.');
    }

    if (destino === this.DESTINOS.PECAS_INACABADAS && !faltaFazer) {
      throw this.createBusinessError('Informe o que falta fazer para enviar pecas inacabadas.');
    }

    if (destino === this.DESTINOS.TRATAMENTO_EXTERNO) {
      await TratamentoExternoModel.registerEntradaProducao(connection, {
        id_peca: ordem.id_peca,
        id_producao_ordem: ordem.id,
        quantidade,
        observacao
      });
    } else {
      stock = await this.resolveDestinationStock(connection, destino);
      await this.registerStockDestination(connection, ordem, stock, quantidade, observacao);
    }

    const idProducaoDestino = await this.persistDestinationRecord(connection, ordem, destino, quantidade, observacao, stock);

    if ([this.DESTINOS.PECAS_INACABADAS, this.DESTINOS.RETRABALHO].includes(destino)) {
      await EstoqueEspecialModel.registerEntrada(connection, {
        id_producao_destino: idProducaoDestino,
        tipo: destino,
        id_estoque: stock.id,
        id_peca: ordem.id_peca,
        id_producao_ordem: ordem.id,
        quantidade,
        origem: 'PRODUCAO',
        defeito,
        falta_fazer: faltaFazer,
        observacao
      });
    }

    return {
      destino,
      quantidade,
      estoque_destino: stock
    };
  }

  static async updateFinalizationStatusIfComplete(connection, ordem) {
    const ordemAtual = await this.findById(ordem.id, connection);
    if (!ordemAtual || ordemAtual.status !== 'EM_ANDAMENTO') {
      return ordemAtual;
    }

    if (ordemAtual.quantidade_produzida === null || ordemAtual.quantidade_produzida === undefined) {
      return ordemAtual;
    }

    const quantidadeProduzida = Number(ordemAtual.quantidade_produzida || 0);
    const quantidadeDestinada = Number(ordemAtual.quantidade_destinada || 0);
    if (quantidadeDestinada < quantidadeProduzida) {
      return ordemAtual;
    }

    await connection.query(
      `
        UPDATE producao_ordens
        SET
          status = 'FINALIZADA',
          data_fim = COALESCE(data_fim, NOW())
        WHERE id = ?
      `,
      [ordem.id]
    );

    return this.findById(ordem.id, connection);
  }

  static async reverseDestination(connection, ordem, destino) {
    const quantidade = Number(destino.quantidade || 0);
    if (quantidade <= 0) {
      return;
    }

    if (destino.destino === this.DESTINOS.TRATAMENTO_EXTERNO) {
      await TratamentoExternoModel.removeProducedEntry(connection, {
        id_peca: ordem.id_peca,
        id_producao_ordem: ordem.id,
        quantidade,
        observacao: `Estorno do destino da ordem de producao ${ordem.id}.`
      });
      return;
    }

    if (!destino.id_estoque_destino) {
      throw this.createBusinessError('Destino de estoque da producao nao encontrado para estorno.');
    }

    if ([this.DESTINOS.PECAS_INACABADAS, this.DESTINOS.RETRABALHO].includes(destino.destino)) {
      await EstoqueEspecialModel.removeEntradaProducao(connection, {
        id_producao_destino: destino.id,
        tipo: destino.destino,
        id_producao_ordem: ordem.id,
        id_peca: ordem.id_peca,
        quantidade
      });
    }

    const saldoAtual = await EstoqueModel.findSaldoForUpdate(
      connection,
      destino.id_estoque_destino,
      ordem.id_peca
    );
    const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;

    if (quantidade > quantidadeAtual) {
      throw this.createBusinessError(
        'Nao foi possivel excluir a producao porque uma quantidade destinada ja foi movimentada.'
      );
    }

    const novoSaldo = Number((quantidadeAtual - quantidade).toFixed(2));
    await EstoqueModel.persistSaldo(
      connection,
      destino.id_estoque_destino,
      ordem.id_peca,
      novoSaldo,
      saldoAtual
    );

    await EstoqueModel.createMovimentacao(connection, {
      id_peca: ordem.id_peca,
      id_estoque_origem: destino.id_estoque_destino,
      id_estoque_destino: null,
      tipo_movimentacao: 'AJUSTE',
      quantidade,
      observacao: `Estorno do destino da ordem de producao ${ordem.id}.`
    });
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

      const retornoInacabadas = this.isReturnedFromSpecialStock(ordem);
      if (!retornoInacabadas && !ordem.id_materia_prima) {
        throw this.createBusinessError('A peca nao possui materia-prima vinculada. Ajuste a peca antes de finalizar a producao.');
      }

      if (retornoInacabadas && totalFinal > Number(ordem.quantidade_planejada || 0)) {
        throw this.createBusinessError(
          'A quantidade final nao pode ser maior que a quantidade retornada das pecas inacabadas.'
        );
      }

      const quantidadeJaDestinada = await this.getTotalDestinado(id, connection);
      if (quantidadeJaDestinada > Number(data.quantidade_produzida)) {
        throw this.createBusinessError(
          `Ja foram destinados ${quantidadeJaDestinada.toLocaleString('pt-BR')} item(ns). A quantidade produzida nao pode ser menor que isso.`
        );
      }

      let consumoFinal = {
        quantidadeConsumida: Number(ordem.quantidade_consumida_materia_prima || 0),
        unidadeConsumo: ordem.unidade_consumo || null,
        pesoConsumido: ordem.peso_consumido_kg || null,
        comprimentoCorteUsado: data.comprimento_corte_mm || ordem.comprimento_corte_mm || null
      };

      if (!retornoInacabadas) {
        consumoFinal = this.calculateMateriaPrimaConsumption({
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
            observacao_fim = ?,
            data_fim = NULL
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

      let ordemAtualizada = await this.findById(id, connection);
      const destinos = Array.isArray(data.destinos) ? data.destinos : [];
      for (const destino of destinos) {
        const totalAntes = await this.getTotalDestinado(id, connection);
        const quantidadeDestino = this.normalizeDestinationQuantity(destino.quantidade);
        const disponivel = Number((Number(data.quantidade_produzida) - totalAntes).toFixed(2));

        if (quantidadeDestino > disponivel) {
          throw this.createBusinessError('A soma dos destinos ultrapassa a quantidade produzida disponivel.');
        }

        await this.applyDestination(connection, ordemAtualizada, {
          destino: destino.destino,
          quantidade: quantidadeDestino,
          observacao: destino.observacao || data.observacao_fim || null,
          defeito: destino.defeito || null,
          falta_fazer: destino.falta_fazer || null
        });
      }

      ordemAtualizada = await this.updateFinalizationStatusIfComplete(connection, ordemAtualizada);

      await connection.commit();
      return ordemAtualizada;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async allocateDestination(id, data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const ordem = await this.findById(id, connection);
      if (!ordem) {
        throw this.createBusinessError('Ordem de producao nao encontrada.');
      }

      if (ordem.status !== 'EM_ANDAMENTO') {
        throw this.createBusinessError('Somente ordens em andamento podem receber destinos.');
      }

      const quantidade = this.normalizeDestinationQuantity(data.quantidade);
      const totalDestinado = await this.getTotalDestinado(id, connection);
      const quantidadeBase = this.getDestinationBaseQuantity(ordem);
      const quantidadeDisponivel = Number((quantidadeBase - totalDestinado).toFixed(2));

      if (quantidade > quantidadeDisponivel) {
        throw this.createBusinessError(
          `Quantidade maior que a disponivel na producao. Disponivel: ${quantidadeDisponivel.toLocaleString('pt-BR')}.`
        );
      }

      await this.applyDestination(connection, ordem, {
        destino: data.destino,
        quantidade,
        observacao: data.observacao || null,
        defeito: data.defeito || null,
        falta_fazer: data.falta_fazer || null
      });

      const ordemAtualizada = await this.updateFinalizationStatusIfComplete(connection, ordem);

      await connection.commit();
      return ordemAtualizada;
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
        const retornoInacabadas = this.isReturnedFromSpecialStock(ordem);
        if (!retornoInacabadas && !ordem.id_materia_prima) {
          throw this.createBusinessError('A ordem finalizada nao possui materia-prima vinculada para estorno.');
        }

        const quantidadeEstornoMp = this.getCommittedStockConsumption(ordem);
        const unidadeEstorno = retornoInacabadas ? null : this.getStockConsumptionUnit(ordem);
        const destinos = await this.findDestinations(ordem.id, connection);

        for (const destino of destinos) {
          await this.reverseDestination(connection, ordem, destino);
        }

        if (!retornoInacabadas && quantidadeEstornoMp > 0) {
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
        const totalDestinado = await this.getTotalDestinado(ordem.id, connection);
        if (totalDestinado > 0) {
          throw this.createBusinessError('Nao e possivel cancelar uma ordem que ja teve pecas retiradas da producao.');
        }

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
