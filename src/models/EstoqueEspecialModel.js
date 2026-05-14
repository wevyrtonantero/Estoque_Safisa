const { pool } = require('../../database/connection');
const EstoqueModel = require('./EstoqueModel');
const TratamentoExternoModel = require('./TratamentoExternoModel');

class EstoqueEspecialModel {
  static TIPOS = Object.freeze({
    RETRABALHO: 'RETRABALHO',
    PECAS_INACABADAS: 'PECAS_INACABADAS'
  });

  static STOCK_NAMES = Object.freeze({
    RETRABALHO: 'Retrabalho',
    PECAS_INACABADAS: 'Pe\u00e7as Inacabadas'
  });

  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static normalizeTipo(value) {
    const normalized = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (normalized === 'INACABADAS') {
      return this.TIPOS.PECAS_INACABADAS;
    }

    if (!Object.values(this.TIPOS).includes(normalized)) {
      throw this.createBusinessError('Tipo de estoque especial invalido.');
    }

    return normalized;
  }

  static normalizeQuantity(value) {
    const quantidade = Number(Number(value || 0).toFixed(2));
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw this.createBusinessError('A quantidade deve ser maior que zero.');
    }

    return quantidade;
  }

  static getStockName(tipo) {
    const normalized = this.normalizeTipo(tipo);
    return this.STOCK_NAMES[normalized];
  }

  static async ensureSchema(db = pool) {
    await this.ensureSupportStocks(db);

    await db.query(
      `
        CREATE TABLE IF NOT EXISTS estoque_especial_registros (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          id_producao_destino BIGINT NULL,
          tipo VARCHAR(40) NOT NULL,
          id_estoque INT NOT NULL,
          id_peca INT NOT NULL,
          id_producao_ordem INT NULL,
          quantidade DECIMAL(12, 2) NOT NULL,
          origem VARCHAR(60) NULL,
          defeito VARCHAR(255) NULL,
          falta_fazer VARCHAR(255) NULL,
          observacao VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_estoque_especial_producao_destino
            FOREIGN KEY (id_producao_destino) REFERENCES producao_destinos(id)
            ON DELETE SET NULL,
          CONSTRAINT fk_estoque_especial_estoque
            FOREIGN KEY (id_estoque) REFERENCES estoques(id)
            ON DELETE RESTRICT,
          CONSTRAINT fk_estoque_especial_peca
            FOREIGN KEY (id_peca) REFERENCES pecas(id)
            ON DELETE RESTRICT,
          CONSTRAINT fk_estoque_especial_ordem
            FOREIGN KEY (id_producao_ordem) REFERENCES producao_ordens(id)
            ON DELETE SET NULL,
          UNIQUE KEY uk_estoque_especial_producao_destino (id_producao_destino),
          INDEX idx_estoque_especial_tipo (tipo),
          INDEX idx_estoque_especial_estoque_peca (id_estoque, id_peca),
          INDEX idx_estoque_especial_ordem (id_producao_ordem)
        ) ENGINE = InnoDB
          DEFAULT CHARSET = utf8mb4
          COLLATE = utf8mb4_unicode_ci
      `
    );

    await this.backfillProducaoDestinos(db);
  }

  static async ensureSupportStocks(db = pool) {
    const stocks = [
      {
        nome: this.STOCK_NAMES.PECAS_INACABADAS,
        aliases: ['Pecas Inacabadas'],
        descricao: 'Pecas produzidas que ainda nao seguiram para o destino final.'
      },
      {
        nome: this.STOCK_NAMES.RETRABALHO,
        aliases: [],
        descricao: 'Pecas separadas para retrabalho antes de voltar ao fluxo.'
      }
    ];

    for (const stock of stocks) {
      const possibleNames = [stock.nome, ...stock.aliases];
      const [existingRows] = await db.query(
        `
          SELECT id, nome
          FROM estoques
          WHERE nome IN (${possibleNames.map(() => '?').join(', ')})
          ORDER BY id ASC
          LIMIT 1
        `,
        possibleNames
      );

      if (existingRows[0]) {
        await db.query(
          `
            UPDATE estoques
            SET
              nome = ?,
              descricao = COALESCE(NULLIF(descricao, ''), ?),
              ativo = 1,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [stock.nome, stock.descricao, existingRows[0].id]
        );
        continue;
      }

      await db.query(
        `
          INSERT INTO estoques (nome, descricao, ativo)
          VALUES (?, ?, 1)
        `,
        [stock.nome, stock.descricao]
      );
    }
  }

  static async backfillProducaoDestinos(db = pool) {
    await db.query(
      `
        INSERT INTO estoque_especial_registros (
          id_producao_destino,
          tipo,
          id_estoque,
          id_peca,
          id_producao_ordem,
          quantidade,
          origem,
          defeito,
          falta_fazer,
          observacao,
          created_at,
          updated_at
        )
        SELECT
          pd.id,
          pd.destino,
          pd.id_estoque_destino,
          po.id_peca,
          pd.id_producao_ordem,
          pd.quantidade,
          'PRODUCAO',
          CASE
            WHEN pd.destino = 'RETRABALHO'
              THEN COALESCE(NULLIF(pd.observacao, ''), 'Retrabalho registrado antes do detalhamento.')
            ELSE NULL
          END,
          CASE
            WHEN pd.destino = 'PECAS_INACABADAS'
              THEN COALESCE(NULLIF(pd.observacao, ''), 'Falta fazer registrado antes do detalhamento.')
            ELSE NULL
          END,
          pd.observacao,
          pd.created_at,
          pd.created_at
        FROM producao_destinos pd
        INNER JOIN producao_ordens po ON po.id = pd.id_producao_ordem
        LEFT JOIN estoque_especial_registros r ON r.id_producao_destino = pd.id
        WHERE pd.destino IN ('RETRABALHO', 'PECAS_INACABADAS')
          AND pd.id_estoque_destino IS NOT NULL
          AND pd.quantidade > 0
          AND r.id IS NULL
      `
    );
  }

  static async findRegistros(tipo, filters = {}) {
    const normalizedTipo = this.normalizeTipo(tipo);
    const conditions = ['r.tipo = ?', 'r.quantidade > 0'];
    const values = [normalizedTipo];

    if (filters.codigo) {
      conditions.push('p.codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.descricao) {
      conditions.push('p.descricao LIKE ?');
      values.push(`%${filters.descricao}%`);
    }

    if (filters.detalhe) {
      conditions.push('(COALESCE(r.defeito, \'\') LIKE ? OR COALESCE(r.falta_fazer, \'\') LIKE ? OR COALESCE(r.observacao, \'\') LIKE ?)');
      values.push(`%${filters.detalhe}%`, `%${filters.detalhe}%`, `%${filters.detalhe}%`);
    }

    if (filters.origem) {
      conditions.push('COALESCE(r.origem, \'\') LIKE ?');
      values.push(`%${filters.origem}%`);
    }

    const [rows] = await pool.query(
      `
        SELECT
          r.id,
          r.id_producao_destino,
          r.tipo,
          r.id_estoque,
          r.id_peca,
          r.id_producao_ordem,
          r.quantidade,
          r.origem,
          r.defeito,
          r.falta_fazer,
          r.observacao,
          r.created_at,
          r.updated_at,
          e.nome AS estoque_nome,
          p.codigo,
          p.descricao,
          p.tipo AS peca_tipo,
          p.classificacao,
          COALESCE(m.nome, '-') AS maquina_nome
        FROM estoque_especial_registros r
        INNER JOIN estoques e ON e.id = r.id_estoque
        INNER JOIN pecas p ON p.id = r.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        WHERE ${conditions.join(' AND ')}
        ORDER BY r.created_at ASC, r.id ASC
      `,
      values
    );

    return rows;
  }

  static async registerEntrada(connection, data) {
    const tipo = this.normalizeTipo(data.tipo);
    const quantidade = this.normalizeQuantity(data.quantidade);
    const idEstoque = Number(data.id_estoque);

    if (!Number.isInteger(idEstoque)) {
      throw this.createBusinessError('Estoque especial de destino nao encontrado.');
    }

    await connection.query(
      `
        INSERT INTO estoque_especial_registros (
          id_producao_destino,
          tipo,
          id_estoque,
          id_peca,
          id_producao_ordem,
          quantidade,
          origem,
          defeito,
          falta_fazer,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.id_producao_destino || null,
        tipo,
        idEstoque,
        data.id_peca,
        data.id_producao_ordem || null,
        quantidade,
        data.origem || 'PRODUCAO',
        data.defeito || null,
        data.falta_fazer || null,
        data.observacao || null
      ]
    );
  }

  static async removeEntradaProducao(connection, data) {
    const tipo = this.normalizeTipo(data.tipo);
    const quantidadeRemover = this.normalizeQuantity(data.quantidade);
    const conditions = ['tipo = ?', 'quantidade > 0'];
    const values = [tipo];

    if (data.id_producao_destino) {
      conditions.push('id_producao_destino = ?');
      values.push(data.id_producao_destino);
    } else {
      conditions.push('id_producao_ordem = ?', 'id_peca = ?');
      values.push(data.id_producao_ordem, data.id_peca);
    }

    const [rows] = await connection.query(
      `
        SELECT id, quantidade
        FROM estoque_especial_registros
        WHERE ${conditions.join(' AND ')}
        ORDER BY id ASC
        FOR UPDATE
      `,
      values
    );

    const totalDisponivel = rows.reduce((total, row) => total + Number(row.quantidade || 0), 0);
    if (quantidadeRemover > Number(totalDisponivel.toFixed(2))) {
      throw this.createBusinessError(
        'Nao foi possivel excluir a producao porque uma quantidade destinada ja saiu do estoque especial.'
      );
    }

    let restante = quantidadeRemover;
    for (const row of rows) {
      if (restante <= 0) {
        break;
      }

      const quantidadeAtual = Number(row.quantidade || 0);
      const baixa = Math.min(quantidadeAtual, restante);
      const novaQuantidade = Number((quantidadeAtual - baixa).toFixed(2));

      if (novaQuantidade <= 0) {
        await connection.query('DELETE FROM estoque_especial_registros WHERE id = ?', [row.id]);
      } else {
        await connection.query(
          'UPDATE estoque_especial_registros SET quantidade = ? WHERE id = ?',
          [novaQuantidade, row.id]
        );
      }

      restante = Number((restante - baixa).toFixed(2));
    }
  }

  static async findRegistroForUpdate(connection, id, tipo) {
    const normalizedTipo = this.normalizeTipo(tipo);
    const [rows] = await connection.query(
      `
        SELECT
          r.id,
          r.tipo,
          r.id_estoque,
          r.id_peca,
          r.id_producao_ordem,
          r.quantidade,
          r.origem,
          r.defeito,
          r.falta_fazer,
          p.id_maquina,
          p.id_materia_prima,
          p.comprimento_mm,
          p.codigo,
          p.descricao,
          e.nome AS estoque_nome
        FROM estoque_especial_registros r
        INNER JOIN pecas p ON p.id = r.id_peca
        INNER JOIN estoques e ON e.id = r.id_estoque
        WHERE r.id = ? AND r.tipo = ? AND r.quantidade > 0
        FOR UPDATE
      `,
      [id, normalizedTipo]
    );

    return rows[0] || null;
  }

  static async reduceRegistro(connection, registro, quantidade) {
    const quantidadeAtual = Number(registro.quantidade || 0);

    if (quantidade > quantidadeAtual) {
      throw this.createBusinessError('A quantidade informada e maior que o saldo deste registro.');
    }

    const novaQuantidade = Number((quantidadeAtual - quantidade).toFixed(2));
    if (novaQuantidade <= 0) {
      await connection.query('DELETE FROM estoque_especial_registros WHERE id = ?', [registro.id]);
    } else {
      await connection.query(
        'UPDATE estoque_especial_registros SET quantidade = ? WHERE id = ?',
        [novaQuantidade, registro.id]
      );
    }

    return novaQuantidade;
  }

  static async reduceStockSaldo(connection, registro, quantidade) {
    const saldoOrigem = await EstoqueModel.findSaldoForUpdate(connection, registro.id_estoque, registro.id_peca);
    const quantidadeOrigem = saldoOrigem ? Number(saldoOrigem.quantidade) : 0;

    if (quantidade > quantidadeOrigem) {
      throw this.createBusinessError('Saldo insuficiente no estoque especial para esta saida.');
    }

    const novoSaldoOrigem = Number((quantidadeOrigem - quantidade).toFixed(2));
    await EstoqueModel.persistSaldo(connection, registro.id_estoque, registro.id_peca, novoSaldoOrigem, saldoOrigem);
    return novoSaldoOrigem;
  }

  static async iniciarProducao(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const tipo = this.normalizeTipo(data.tipo);
      if (tipo !== this.TIPOS.PECAS_INACABADAS) {
        throw this.createBusinessError('Somente pecas inacabadas podem voltar para a producao por aqui.');
      }

      const quantidade = this.normalizeQuantity(data.quantidade);
      if (!Number.isInteger(quantidade)) {
        throw this.createBusinessError('A quantidade para iniciar producao deve ser um numero inteiro.');
      }

      const registro = await this.findRegistroForUpdate(connection, data.id, tipo);

      if (!registro) {
        throw this.createBusinessError('Registro nao encontrado neste estoque.');
      }

      const idMaquina = Number(registro.id_maquina);
      if (!Number.isInteger(idMaquina) || idMaquina <= 0) {
        throw this.createBusinessError(`A peca ${registro.codigo} nao possui maquina vinculada para iniciar a producao.`);
      }

      const [maquinaRows] = await connection.query(
        `
          SELECT id, nome
          FROM maquinas
          WHERE id = ?
          LIMIT 1
        `,
        [idMaquina]
      );

      if (!maquinaRows[0]) {
        throw this.createBusinessError(`A maquina vinculada a peca ${registro.codigo} nao foi encontrada.`);
      }

      const saldoRegistroAtual = await this.reduceRegistro(connection, registro, quantidade);
      const saldoEstoqueAtual = await this.reduceStockSaldo(connection, registro, quantidade);
      const observacao = (
        data.observacao
        || `Retorno das pecas inacabadas para producao. Falta fazer: ${registro.falta_fazer || '-'}`
      ).slice(0, 255);

      const [result] = await connection.query(
        `
          INSERT INTO producao_ordens (
            id_maquina,
            id_peca,
            id_materia_prima,
            quantidade_planejada,
            quantidade_consumida_materia_prima,
            observacao_inicio,
            origem_estoque_especial_tipo,
            origem_estoque_especial_registro_id
          ) VALUES (?, ?, ?, ?, 0, ?, ?, ?)
        `,
        [
          idMaquina,
          registro.id_peca,
          registro.id_materia_prima || null,
          quantidade,
          observacao,
          tipo,
          registro.id
        ]
      );

      await EstoqueModel.createMovimentacao(connection, {
        id_peca: registro.id_peca,
        id_estoque_origem: registro.id_estoque,
        id_estoque_destino: null,
        tipo_movimentacao: 'SAIDA',
        quantidade,
        observacao: `Retorno para producao OP ${result.insertId}. ${observacao}`.slice(0, 255)
      });

      await connection.commit();
      return {
        id: registro.id,
        quantidade_retirada: quantidade,
        saldo_registro_atual: saldoRegistroAtual,
        saldo_estoque_atual: saldoEstoqueAtual,
        producao: {
          id: result.insertId,
          id_maquina: idMaquina,
          maquina_nome: maquinaRows[0].nome,
          id_peca: registro.id_peca,
          codigo: registro.codigo,
          descricao: registro.descricao,
          quantidade_planejada: quantidade
        }
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async registrarRefugo(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const tipo = this.normalizeTipo(data.tipo);
      const quantidade = this.normalizeQuantity(data.quantidade);
      const registro = await this.findRegistroForUpdate(connection, data.id, tipo);

      if (!registro) {
        throw this.createBusinessError('Registro nao encontrado neste estoque.');
      }

      const responsavel = String(data.nome || '').trim();
      const motivo = String(data.motivo || '').trim();

      if (!responsavel) {
        throw this.createBusinessError('Informe o nome de quem esta registrando o refugo.');
      }

      if (!motivo) {
        throw this.createBusinessError('Informe o motivo do refugo.');
      }

      const saldoRegistroAtual = await this.reduceRegistro(connection, registro, quantidade);
      const saldoEstoqueAtual = await this.reduceStockSaldo(connection, registro, quantidade);

      await EstoqueModel.createMovimentacao(connection, {
        id_peca: registro.id_peca,
        id_estoque_origem: registro.id_estoque,
        id_estoque_destino: null,
        tipo_movimentacao: 'SAIDA',
        quantidade,
        observacao: `Refugo registrado por ${responsavel}. Motivo: ${motivo}.`.slice(0, 255)
      });

      await connection.commit();
      return {
        id: registro.id,
        quantidade_baixada: quantidade,
        saldo_registro_atual: saldoRegistroAtual,
        saldo_estoque_atual: saldoEstoqueAtual
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async enviarParaEstoque(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const tipo = this.normalizeTipo(data.tipo);
      if (tipo !== this.TIPOS.RETRABALHO) {
        throw this.createBusinessError('Somente pecas em retrabalho podem ser encaminhadas diretamente para estoque.');
      }

      const quantidade = this.normalizeQuantity(data.quantidade);
      const registro = await this.findRegistroForUpdate(connection, data.id, tipo);

      if (!registro) {
        throw this.createBusinessError('Registro nao encontrado neste estoque.');
      }

      const estoqueDestino = await EstoqueModel.findStockById(data.id_estoque_destino, connection);
      if (!estoqueDestino || Number(estoqueDestino.ativo) !== 1) {
        throw this.createBusinessError('Estoque de destino nao encontrado ou inativo.');
      }

      if (Number(estoqueDestino.id) === Number(registro.id_estoque)) {
        throw this.createBusinessError('Escolha um estoque diferente da origem.');
      }

      const saldoRegistroAtual = await this.reduceRegistro(connection, registro, quantidade);
      const saldoOrigemAtual = await this.reduceStockSaldo(connection, registro, quantidade);
      const saldoDestino = await EstoqueModel.findSaldoForUpdate(connection, estoqueDestino.id, registro.id_peca);
      const quantidadeDestino = saldoDestino ? Number(saldoDestino.quantidade) : 0;
      const saldoDestinoAtual = Number((quantidadeDestino + quantidade).toFixed(2));

      await EstoqueModel.persistSaldo(connection, estoqueDestino.id, registro.id_peca, saldoDestinoAtual, saldoDestino);
      await EstoqueModel.createMovimentacao(connection, {
        id_peca: registro.id_peca,
        id_estoque_origem: registro.id_estoque,
        id_estoque_destino: estoqueDestino.id,
        tipo_movimentacao: 'TRANSFERENCIA',
        quantidade,
        observacao: data.observacao || `Envio do retrabalho para ${estoqueDestino.nome}.`
      });

      await connection.commit();
      return {
        id: registro.id,
        estoque_destino: estoqueDestino,
        quantidade_transferida: quantidade,
        saldo_registro_atual: saldoRegistroAtual,
        saldo_origem_atual: saldoOrigemAtual,
        saldo_destino_atual: saldoDestinoAtual
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async enviarParaTratamento(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const tipo = this.normalizeTipo(data.tipo);
      const quantidade = this.normalizeQuantity(data.quantidade);
      const registro = await this.findRegistroForUpdate(connection, data.id, tipo);

      if (!registro) {
        throw this.createBusinessError('Registro nao encontrado neste estoque.');
      }

      const saldoRegistroAtual = await this.reduceRegistro(connection, registro, quantidade);
      const saldoEstoqueAtual = await this.reduceStockSaldo(connection, registro, quantidade);
      const origemDescricao = tipo === this.TIPOS.RETRABALHO ? 'Retrabalho' : 'Pecas Inacabadas';
      const observacao = data.observacao || `Entrada vinda de ${origemDescricao}.`;

      await EstoqueModel.createMovimentacao(connection, {
        id_peca: registro.id_peca,
        id_estoque_origem: registro.id_estoque,
        id_estoque_destino: null,
        tipo_movimentacao: 'SAIDA',
        quantidade,
        observacao: `Envio para tratamento externo. ${observacao}`.slice(0, 255)
      });

      await TratamentoExternoModel.registerEntradaProducao(connection, {
        id_peca: registro.id_peca,
        id_producao_ordem: registro.id_producao_ordem || null,
        quantidade,
        observacao: `Entrada vinda de ${origemDescricao}. ${observacao}`.slice(0, 255)
      });

      await connection.commit();
      return {
        id: registro.id,
        quantidade_enviada: quantidade,
        saldo_registro_atual: saldoRegistroAtual,
        saldo_estoque_atual: saldoEstoqueAtual
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = EstoqueEspecialModel;
