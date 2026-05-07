// Model principal do controle de estoque de pecas e submontagens.
const { pool } = require('../../database/connection');
const ComposicaoVendaModel = require('./ComposicaoVendaModel');
const ExpedicaoSaidaModel = require('./ExpedicaoSaidaModel');

class EstoqueModel {
  static supplierSummarySubquery() {
    return `
      SELECT
        pf.id_peca,
        GROUP_CONCAT(DISTINCT f.nome ORDER BY f.nome SEPARATOR ', ') AS fornecedores_nomes
      FROM peca_fornecedor pf
      INNER JOIN fornecedores f ON f.id = pf.id_fornecedor
      GROUP BY pf.id_peca
    `;
  }
  static EXPEDICAO_NOME = 'Expedição';

  static ALMOXARIFADO_NOME = 'Almoxarifado';

  // Cria um erro de negocio padronizado para as validacoes do fluxo.
  static createBusinessError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
  }

  static buildPrioridadeExpressions() {
    const quantidadeExpression = 'COALESCE(s.quantidade, 0)';
    const estoqueSegurancaExpression = 'COALESCE(p.estoque_seguranca, 0)';
    const consumoMensalExpression = 'COALESCE(p.consumo_mensal, 0)';
    const diasCoberturaBrutoExpression = `(
      ${quantidadeExpression} / NULLIF(${consumoMensalExpression} / 30, 0)
    )`;

    const diasCoberturaExpression = `
      CASE
        WHEN ${consumoMensalExpression} > 0 THEN ROUND(${diasCoberturaBrutoExpression}, 1)
        ELSE NULL
      END
    `;

    const dataPrevistaRupturaExpression = `
      CASE
        WHEN ${consumoMensalExpression} > 0 THEN DATE_ADD(
          CURDATE(),
          INTERVAL GREATEST(0, CEIL(${diasCoberturaBrutoExpression})) DAY
        )
        ELSE NULL
      END
    `;

    const estadoExpression = `
      CASE
        WHEN UPPER(COALESCE(e.nome, '')) LIKE '%ALMOX%' AND ${quantidadeExpression} <= 0 THEN 'CRITICO'
        WHEN (
          (${consumoMensalExpression} > 0 AND ${quantidadeExpression} <= 0)
          OR (${estoqueSegurancaExpression} > 0 AND ${quantidadeExpression} < ${estoqueSegurancaExpression})
          OR (${consumoMensalExpression} > 0 AND ${diasCoberturaBrutoExpression} <= 7)
        ) THEN 'CRITICO'
        WHEN (
          (${estoqueSegurancaExpression} > 0 AND ${quantidadeExpression} = ${estoqueSegurancaExpression})
          OR (${consumoMensalExpression} > 0 AND ${diasCoberturaBrutoExpression} <= 15)
        ) THEN 'ATENCAO'
        WHEN (
          ${consumoMensalExpression} > 0 AND ${diasCoberturaBrutoExpression} <= 30
        ) THEN 'OBSERVAR'
        ELSE 'NORMAL'
      END
    `;

    const prioridadeExpression = `
      CASE
        WHEN UPPER(COALESCE(e.nome, '')) LIKE '%ALMOX%' AND ${quantidadeExpression} <= 0 THEN 1
        WHEN (
          (${consumoMensalExpression} > 0 AND ${quantidadeExpression} <= 0)
          OR (${estoqueSegurancaExpression} > 0 AND ${quantidadeExpression} < ${estoqueSegurancaExpression})
          OR (${consumoMensalExpression} > 0 AND ${diasCoberturaBrutoExpression} <= 7)
        ) THEN 1
        WHEN (
          (${estoqueSegurancaExpression} > 0 AND ${quantidadeExpression} = ${estoqueSegurancaExpression})
          OR (${consumoMensalExpression} > 0 AND ${diasCoberturaBrutoExpression} <= 15)
        ) THEN 2
        WHEN (
          ${consumoMensalExpression} > 0 AND ${diasCoberturaBrutoExpression} <= 30
        ) THEN 3
        ELSE 4
      END
    `;

    return {
      quantidadeExpression,
      estoqueSegurancaExpression,
      consumoMensalExpression,
      diasCoberturaExpression,
      dataPrevistaRupturaExpression,
      estadoExpression,
      prioridadeExpression
    };
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
          p.estoque_minimo,
          p.estoque_seguranca,
          p.consumo_mensal,
          p.id_maquina,
          COALESCE(m.nome, '-') AS maquina_nome,
          COALESCE(sa.quantidade, 0) AS saldo_almoxarifado
        FROM pecas p
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        LEFT JOIN estoque_saldos sa ON sa.id_peca = p.id
          AND sa.id_estoque = (
            SELECT id FROM estoques WHERE nome = 'Almoxarifado' LIMIT 1
          )
        WHERE p.classificacao IN ('ITEM', 'SUBMONTAGEM')
        ORDER BY p.codigo ASC
      `
    );

    return rows;
  }

  // Lista os saldos com filtros dinamicos por estoque, item e atributos da peca.
  static async findSaldos(filters = {}) {
    const mostrarTodos = Boolean(filters.mostrar_todos);
    const quantidadeExpression = mostrarTodos ? 'COALESCE(s.quantidade, 0)' : 's.quantidade';
    const conditions = mostrarTodos
      ? ['e.ativo = 1', "p.classificacao IN ('ITEM', 'SUBMONTAGEM')"]
      : ['s.quantidade > 0'];
    const values = [];
    const orderBy = filters.ordem_quantidade
      ? `${quantidadeExpression} ${filters.ordem_quantidade}, p.codigo ASC`
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

    if (filters.idPeca) {
      conditions.push('p.id = ?');
      values.push(filters.idPeca);
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

    if (filters.fornecedor) {
      conditions.push("COALESCE(fs.fornecedores_nomes, f.nome, '') LIKE ?");
      values.push(`%${filters.fornecedor}%`);
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

    const fromClause = mostrarTodos
      ? `
        FROM estoques e
        CROSS JOIN pecas p
        LEFT JOIN estoque_saldos s
          ON s.id_estoque = e.id
          AND s.id_peca = p.id
      `
      : `
        FROM estoque_saldos s
        INNER JOIN estoques e ON e.id = s.id_estoque
        INNER JOIN pecas p ON p.id = s.id_peca
      `;

    const [rows] = await pool.query(
      `
        SELECT
          COALESCE(s.id, 0) AS id,
          e.id AS id_estoque,
          p.id AS id_peca,
          ${quantidadeExpression} AS quantidade,
          s.created_at,
          s.updated_at,
          e.nome AS estoque_nome,
          e.descricao AS estoque_descricao,
          p.codigo,
          p.descricao,
          COALESCE(p.tipo, '-') AS tipo,
          p.classificacao,
          p.estoque_minimo,
          p.estoque_seguranca,
          p.consumo_mensal,
          p.id_maquina,
          COALESCE(m.nome, '-') AS maquina_nome,
          p.id_fornecedor,
          f.nome AS fornecedor_nome,
          COALESCE(fs.fornecedores_nomes, f.nome, '') AS fornecedores_nomes
        ${fromClause}
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        LEFT JOIN fornecedores f ON f.id = p.id_fornecedor
        LEFT JOIN (${this.supplierSummarySubquery()}) fs ON fs.id_peca = p.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${orderBy}
      `,
      values
    );

    return rows;
  }

  // Lista itens por prioridade de reposicao/producao, incluindo saldo zerado.
  static async findPrioridades(filters = {}) {
    const values = [];
    const baseConditions = [
      'e.ativo = 1',
      "p.classificacao IN ('ITEM', 'SUBMONTAGEM')"
    ];
    const outerConditions = [
      "(quantidade > 0 OR quantidade_saida_mes > 0 OR estoque_seguranca > 0 OR (UPPER(COALESCE(estoque_nome, '')) LIKE '%ALMOX%' AND quantidade <= 0))"
    ];
    const {
      diasCoberturaExpression,
      dataPrevistaRupturaExpression,
      estadoExpression,
      prioridadeExpression
    } = this.buildPrioridadeExpressions();

    if (filters.estoque) {
      baseConditions.push('e.id = ?');
      values.push(filters.estoque);
    }

    if (filters.estoque_nome) {
      baseConditions.push('UPPER(e.nome) LIKE ?');
      values.push(`%${String(filters.estoque_nome).trim().toUpperCase()}%`);
    }

    if (filters.codigo) {
      outerConditions.push('codigo LIKE ?');
      values.push(`%${filters.codigo}%`);
    }

    if (filters.descricao) {
      outerConditions.push('descricao LIKE ?');
      values.push(`%${filters.descricao}%`);
    }

    if (filters.classificacao) {
      outerConditions.push('classificacao = ?');
      values.push(filters.classificacao);
    }

    if (filters.estado) {
      outerConditions.push('estado_necessidade = ?');
      values.push(filters.estado);
    }

    if (filters.fornecedor) {
      outerConditions.push("COALESCE(fornecedores_nomes, fornecedor_nome, '') LIKE ?");
      values.push(`%${filters.fornecedor}%`);
    }

    if (filters.modo === 'prioritarios') {
      outerConditions.push("estado_necessidade <> 'NORMAL'");
    }

    const limit = Number.isInteger(filters.limit) && filters.limit > 0
      ? `LIMIT ${filters.limit}`
      : '';

    const [rows] = await pool.query(
      `
        SELECT *
        FROM (
          SELECT
            e.id AS id_estoque,
            e.nome AS estoque_nome,
            e.descricao AS estoque_descricao,
            p.id AS id_peca,
            p.codigo,
            p.descricao,
            COALESCE(p.tipo, '-') AS tipo,
            p.classificacao,
            COALESCE(s.quantidade, 0) AS quantidade,
            COALESCE(s.quantidade, 0) AS quantidade_atual,
            p.estoque_minimo AS quantidade_pacote,
            p.estoque_minimo,
            p.estoque_seguranca,
            p.id_fornecedor,
            f.nome AS fornecedor_nome,
            COALESCE(fs.fornecedores_nomes, f.nome, '') AS fornecedores_nomes,
            COALESCE(p.consumo_mensal, 0) AS quantidade_saida_mes,
            p.consumo_mensal,
            ${diasCoberturaExpression} AS dias_cobertura,
            ${dataPrevistaRupturaExpression} AS data_prevista_ruptura,
            ${estadoExpression} AS estado_necessidade,
            ${prioridadeExpression} AS prioridade_necessidade
          FROM estoques e
          CROSS JOIN pecas p
          LEFT JOIN estoque_saldos s
            ON s.id_estoque = e.id
            AND s.id_peca = p.id
          LEFT JOIN fornecedores f ON f.id = p.id_fornecedor
          LEFT JOIN (${this.supplierSummarySubquery()}) fs ON fs.id_peca = p.id
          WHERE ${baseConditions.join(' AND ')}
        ) prioridades
        WHERE ${outerConditions.join(' AND ')}
        ORDER BY
          prioridade_necessidade ASC,
          CASE WHEN data_prevista_ruptura IS NULL THEN 1 ELSE 0 END ASC,
          data_prevista_ruptura ASC,
          quantidade ASC,
          quantidade_saida_mes DESC,
          codigo ASC
        ${limit}
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
          p.estoque_minimo,
          p.estoque_seguranca,
          p.consumo_mensal,
          p.id_maquina,
          COALESCE(m.nome, '-') AS maquina_nome,
          p.id_fornecedor,
          f.nome AS fornecedor_nome,
          COALESCE(fs.fornecedores_nomes, f.nome, '') AS fornecedores_nomes
        FROM estoque_saldos s
        INNER JOIN estoques e ON e.id = s.id_estoque
        INNER JOIN pecas p ON p.id = s.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        LEFT JOIN fornecedores f ON f.id = p.id_fornecedor
        LEFT JOIN (${this.supplierSummarySubquery()}) fs ON fs.id_peca = p.id
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

  // Lista os componentes de uma submontagem para expandir a saida.
  static async findSubmontagemComponents(submontagemId, connection = pool) {
    const [rows] = await connection.query(
      `
        SELECT
          es.id_item_componente,
          es.quantidade,
          p.codigo,
          p.descricao
        FROM estrutura_submontagem es
        INNER JOIN pecas p ON p.id = es.id_item_componente
        WHERE es.id_submontagem = ?
        ORDER BY p.codigo ASC
      `,
      [submontagemId]
    );

    return rows;
  }

  static isExpedicaoStock(estoque) {
    return estoque && String(estoque.nome || '') === this.EXPEDICAO_NOME;
  }

  static buildExpandedObservation(baseText, itemCodigo, itemDescricao) {
    const prefix = baseText || 'Movimentacao automatica.';
    return `${prefix} Estrutura da submontagem ${itemCodigo} - ${itemDescricao}.`.slice(0, 255);
  }

  static async expandSubmontagemIntoStock(
    connection,
    submontagem,
    quantidadeBase,
    idEstoqueDestino,
    observacaoBase,
    tipoMovimentacao,
    idEstoqueOrigem = null
  ) {
    const componentes = await this.findSubmontagemComponents(submontagem.id, connection);

    if (componentes.length === 0) {
      throw this.createBusinessError(`A submontagem ${submontagem.codigo} nao possui componentes cadastrados.`);
    }

    const resultados = [];

    for (const componente of componentes) {
      const quantidadeExpandida = Number(
        (Number(componente.quantidade) * Number(quantidadeBase)).toFixed(2)
      );

      const itemComponente = await this.findItemById(componente.id_item_componente, connection);
      const saldoDestino = await this.findSaldoForUpdate(connection, idEstoqueDestino, componente.id_item_componente);
      const quantidadeDestino = saldoDestino ? Number(saldoDestino.quantidade) : 0;
      const novoSaldoDestino = Number((quantidadeDestino + quantidadeExpandida).toFixed(2));

      await this.persistSaldo(
        connection,
        idEstoqueDestino,
        componente.id_item_componente,
        novoSaldoDestino,
        saldoDestino
      );

      await this.createMovimentacao(connection, {
        id_peca: componente.id_item_componente,
        id_estoque_origem: idEstoqueOrigem,
        id_estoque_destino: idEstoqueDestino,
        tipo_movimentacao: tipoMovimentacao,
        quantidade: quantidadeExpandida,
        observacao: this.buildExpandedObservation(observacaoBase, submontagem.codigo, submontagem.descricao)
      });

      resultados.push({
        id_peca: componente.id_item_componente,
        codigo: itemComponente ? itemComponente.codigo : componente.codigo,
        descricao: itemComponente ? itemComponente.descricao : componente.descricao,
        quantidade_movimentada: quantidadeExpandida,
        saldo_destino_atual: novoSaldoDestino
      });
    }

    return resultados;
  }

  static async consumeSubmontagemComponentsFromStock(
    connection,
    submontagem,
    quantidadeBase,
    idEstoqueOrigem,
    estoqueDestinoSubmontagem,
    observacaoBase
  ) {
    const componentes = await this.findSubmontagemComponents(submontagem.id, connection);

    if (componentes.length === 0) {
      throw this.createBusinessError(`A submontagem ${submontagem.codigo} nao possui componentes cadastrados.`);
    }

    const consumos = [];

    for (const componente of componentes) {
      const quantidadeConsumida = Number(
        (Number(componente.quantidade) * Number(quantidadeBase)).toFixed(2)
      );
      const saldoOrigem = await this.findSaldoForUpdate(connection, idEstoqueOrigem, componente.id_item_componente);
      const quantidadeOrigem = saldoOrigem ? Number(saldoOrigem.quantidade) : 0;

      if (quantidadeConsumida > quantidadeOrigem) {
        throw this.createBusinessError(
          `Saldo insuficiente em ${componente.codigo} para montar a submontagem ${submontagem.codigo}.`
        );
      }

      const novoSaldoOrigem = Number((quantidadeOrigem - quantidadeConsumida).toFixed(2));

      await this.persistSaldo(
        connection,
        idEstoqueOrigem,
        componente.id_item_componente,
        novoSaldoOrigem,
        saldoOrigem
      );

      await this.createMovimentacao(connection, {
        id_peca: componente.id_item_componente,
        id_estoque_origem: idEstoqueOrigem,
        id_estoque_destino: null,
        tipo_movimentacao: 'SAIDA',
        quantidade: quantidadeConsumida,
        observacao: `${observacaoBase || 'Consumo de componentes para montagem.'} Componente ${componente.codigo} consumido na montagem de ${submontagem.codigo} para ${estoqueDestinoSubmontagem}.`.slice(0, 255)
      });

      consumos.push({
        id_peca: componente.id_item_componente,
        codigo: componente.codigo,
        descricao: componente.descricao,
        quantidade_consumida: quantidadeConsumida,
        saldo_origem_restante: novoSaldoOrigem
      });
    }

    return consumos;
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

  static addReservedQuantity(reservasPorItem, idPeca, quantidade) {
    const quantidadeAtual = Number(reservasPorItem.get(idPeca) || 0);
    reservasPorItem.set(
      idPeca,
      Number((quantidadeAtual + Number(quantidade)).toFixed(2))
    );
  }

  static async getAvailableQuantity(connection, idEstoque, idPeca, reservasPorItem) {
    const saldoAtual = await this.findSaldoForUpdate(connection, idEstoque, idPeca);
    const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
    const quantidadeReservada = Number(reservasPorItem.get(idPeca) || 0);

    return {
      saldoAtual,
      quantidadeAtual,
      quantidadeReservada,
      quantidadeDisponivel: Number((quantidadeAtual - quantidadeReservada).toFixed(2))
    };
  }

  static normalizePlannedQuantity(value) {
    return Number((Number(value || 0)).toFixed(2));
  }

  static async planComposicaoVendaConsumo(
    connection,
    item,
    quantidadeDesejada,
    idEstoqueOrigem,
    reservasPorItem,
    observacaoBase,
    movimentosPlanejados,
    contextoSaida = {}
  ) {
    const composicao = await ComposicaoVendaModel.findByItemVenda(item.id, connection);

    if (!composicao.length || Number(quantidadeDesejada) <= 0) {
      return {
        possui_composicao: composicao.length > 0,
        quantidade_atendida: 0,
        itens_consumidos: []
      };
    }

    const capacidades = [];

    for (const linha of composicao) {
      const disponibilidade = await this.getAvailableQuantity(
        connection,
        idEstoqueOrigem,
        linha.id_item_atende,
        reservasPorItem
      );

      const quantidadeLinha = Number(linha.quantidade);
      const capacidadeLinha = quantidadeLinha > 0
        ? Number((Math.max(0, disponibilidade.quantidadeDisponivel) / quantidadeLinha).toFixed(2))
        : 0;

      capacidades.push({
        linha,
        capacidade: capacidadeLinha
      });
    }

    const quantidadeAtendida = this.normalizePlannedQuantity(
      Math.min(
        Number(quantidadeDesejada),
        ...capacidades.map((capacidade) => capacidade.capacidade)
      )
    );

    if (quantidadeAtendida <= 0) {
      return {
        possui_composicao: true,
        quantidade_atendida: 0,
        itens_consumidos: []
      };
    }

    const itensConsumidos = [];

    for (const capacidade of capacidades) {
      const quantidadeConsumida = this.normalizePlannedQuantity(
        Number(capacidade.linha.quantidade) * quantidadeAtendida
      );

      if (quantidadeConsumida <= 0) {
        continue;
      }

      this.addReservedQuantity(reservasPorItem, capacidade.linha.id_item_atende, quantidadeConsumida);
      movimentosPlanejados.push({
        id_peca: capacidade.linha.id_item_atende,
        quantidade: quantidadeConsumida,
        observacao: `${observacaoBase || 'Saida da Expedicao.'} Atendimento alternativo de ${item.codigo} via ${capacidade.linha.item_atende_codigo}.`.slice(0, 255),
        solicitacao_ref: contextoSaida.solicitacao_ref,
        id_peca_solicitada: item.id,
        forma_atendimento: 'COMPOSICAO_VENDA'
      });
      itensConsumidos.push({
        id_peca: capacidade.linha.id_item_atende,
        codigo: capacidade.linha.item_atende_codigo,
        descricao: capacidade.linha.item_atende_descricao,
        quantidade_baixada: quantidadeConsumida
      });
    }

    return {
      possui_composicao: true,
      quantidade_atendida: quantidadeAtendida,
      itens_consumidos: itensConsumidos
    };
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

      if (item.classificacao === 'SUBMONTAGEM') {
        if (!Number.isInteger(data.id_estoque_origem_componentes)) {
          throw this.createBusinessError('Informe o estoque de origem dos componentes para montar a submontagem.');
        }

        const estoqueOrigemComponentes = await this.findStockById(data.id_estoque_origem_componentes, connection);
        if (!estoqueOrigemComponentes || Number(estoqueOrigemComponentes.ativo) !== 1) {
          throw this.createBusinessError('Estoque de origem dos componentes nao encontrado ou inativo.');
        }

        const componentesConsumidos = await this.consumeSubmontagemComponentsFromStock(
          connection,
          item,
          data.quantidade,
          estoqueOrigemComponentes.id,
          estoqueDestino.nome,
          data.observacao || 'Montagem de submontagem pela entrada de estoque.'
        );

        const saldoAtualSubmontagem = await this.findSaldoForUpdate(
          connection,
          data.id_estoque_destino,
          data.id_peca
        );
        const quantidadeAtualSubmontagem = saldoAtualSubmontagem ? Number(saldoAtualSubmontagem.quantidade) : 0;
        const novoSaldoSubmontagem = Number((quantidadeAtualSubmontagem + Number(data.quantidade)).toFixed(2));

        await this.persistSaldo(
          connection,
          data.id_estoque_destino,
          data.id_peca,
          novoSaldoSubmontagem,
          saldoAtualSubmontagem
        );

        await this.createMovimentacao(connection, {
          id_peca: data.id_peca,
          id_estoque_origem: estoqueOrigemComponentes.id,
          id_estoque_destino: data.id_estoque_destino,
          tipo_movimentacao: 'ENTRADA_INICIAL',
          quantidade: data.quantidade,
          observacao: `${data.observacao || 'Montagem de submontagem pela entrada de estoque.'} Submontagem montada com consumo de componentes.`.slice(0, 255)
        });

        await connection.commit();

        return {
          item,
          estoque_origem_componentes: estoqueOrigemComponentes,
          estoque_destino: estoqueDestino,
          saldo_anterior: quantidadeAtualSubmontagem,
          saldo_atual: novoSaldoSubmontagem,
          componentes_consumidos: componentesConsumidos
        };
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

  // Desmembra uma submontagem pronta e devolve seus componentes para outro estoque.
  static async processDesmembramentoSubmontagem(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const submontagem = await this.findItemById(data.id_submontagem, connection);
      if (!submontagem || submontagem.classificacao !== 'SUBMONTAGEM') {
        throw this.createBusinessError('A submontagem informada para desmembrar nao foi encontrada.');
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
        data.id_submontagem
      );
      const quantidadeOrigem = saldoOrigem ? Number(saldoOrigem.quantidade) : 0;
      const quantidadeDesmembrada = Number(data.quantidade);

      if (quantidadeDesmembrada > quantidadeOrigem) {
        throw this.createBusinessError(
          `A submontagem ${submontagem.codigo} nao possui saldo pronto suficiente para desmembrar.`
        );
      }

      const novoSaldoOrigem = Number((quantidadeOrigem - quantidadeDesmembrada).toFixed(2));

      await this.persistSaldo(
        connection,
        data.id_estoque_origem,
        data.id_submontagem,
        novoSaldoOrigem,
        saldoOrigem
      );

      await this.createMovimentacao(connection, {
        id_peca: data.id_submontagem,
        id_estoque_origem: data.id_estoque_origem,
        id_estoque_destino: null,
        tipo_movimentacao: 'SAIDA',
        quantidade: quantidadeDesmembrada,
        observacao: `${data.observacao || 'Desmembramento de submontagem.'} Saida da submontagem ${submontagem.codigo} para retorno dos componentes.`.slice(0, 255)
      });

      const componentesRetornados = await this.expandSubmontagemIntoStock(
        connection,
        submontagem,
        quantidadeDesmembrada,
        data.id_estoque_destino,
        data.observacao || 'Desmembramento de submontagem.',
        'TRANSFERENCIA',
        data.id_estoque_origem
      );

      await connection.commit();

      return {
        item: submontagem,
        estoque_origem: estoqueOrigem,
        estoque_destino: estoqueDestino,
        saldo_origem_atual: novoSaldoOrigem,
        componentes_retornados: componentesRetornados
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

  // Realiza a saida final sempre a partir do estoque da expedicao.
  static async processSaidaLote(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const expedicao = await this.findStockByName(this.EXPEDICAO_NOME, connection);

      if (!expedicao || Number(expedicao.ativo) !== 1) {
        throw this.createBusinessError('O estoque de Expedição nao esta disponivel para realizar a saida.');
      }

      const reservasPorItem = new Map();
      const movimentosPlanejados = [];
      const solicitacoes = [];

      for (const itemSolicitado of data.itens) {
        const idPeca = Number(itemSolicitado.id_peca);
        const quantidadeSolicitada = Number(itemSolicitado.quantidade);
        const item = await this.findItemById(idPeca, connection);
        const solicitacaoRef = solicitacoes.length + 1;

        if (!item) {
          throw this.createBusinessError('Um dos itens informados nao foi encontrado para a saida.');
        }

        solicitacoes.push({
          solicitacao_ref: solicitacaoRef,
          id_peca: idPeca,
          codigo: item.codigo,
          descricao: item.descricao,
          classificacao: item.classificacao,
          quantidade_solicitada: quantidadeSolicitada
        });

        const disponibilidadeItemPronto = await this.getAvailableQuantity(
          connection,
          expedicao.id,
          idPeca,
          reservasPorItem
        );

        const quantidadeProntaConsumida = Math.min(
          quantidadeSolicitada,
          Math.max(0, disponibilidadeItemPronto.quantidadeDisponivel)
        );

        if (quantidadeProntaConsumida > 0) {
          this.addReservedQuantity(reservasPorItem, idPeca, quantidadeProntaConsumida);
          movimentosPlanejados.push({
            id_peca: idPeca,
            quantidade: quantidadeProntaConsumida,
            observacao: `${data.observacao || 'Saida da Expedicao.'} Saida do item pronto ${item.codigo}.`.slice(0, 255),
            solicitacao_ref: solicitacaoRef,
            id_peca_solicitada: idPeca,
            forma_atendimento: 'PRONTO'
          });
        }

        let quantidadePendente = this.normalizePlannedQuantity(
          quantidadeSolicitada - quantidadeProntaConsumida
        );

        const composicaoVenda = quantidadePendente > 0
          ? await this.planComposicaoVendaConsumo(
            connection,
            item,
            quantidadePendente,
            expedicao.id,
            reservasPorItem,
            data.observacao,
            movimentosPlanejados,
            {
              solicitacao_ref: solicitacaoRef
            }
          )
          : {
            possui_composicao: false,
            quantidade_atendida: 0,
            itens_consumidos: []
          };

        quantidadePendente = this.normalizePlannedQuantity(
          quantidadePendente - composicaoVenda.quantidade_atendida
        );

        let quantidadeViaComponentes = 0;

        if (quantidadePendente > 0 && item.classificacao === 'SUBMONTAGEM') {
          const componentes = await this.findSubmontagemComponents(idPeca, connection);

          if (componentes.length === 0) {
            if (composicaoVenda.possui_composicao) {
              throw this.createBusinessError(
                `A submontagem ${item.codigo} nao possui saldo suficiente pronta nem na composicao configurada da Expedicao.`
              );
            }

            throw this.createBusinessError(
              `A submontagem ${item.codigo} nao possui componentes cadastrados para complementar a baixa.`
            );
          }

          for (const component of componentes) {
            const idComponente = Number(component.id_item_componente);
            const quantidadeComponente = this.normalizePlannedQuantity(
              Number(component.quantidade) * quantidadePendente
            );
            const disponibilidadeComponente = await this.getAvailableQuantity(
              connection,
              expedicao.id,
              idComponente,
              reservasPorItem
            );

            if (quantidadeComponente > disponibilidadeComponente.quantidadeDisponivel) {
              throw this.createBusinessError(
                `A submontagem ${item.codigo} nao possui saldo suficiente pronta${composicaoVenda.possui_composicao ? ', na composicao configurada' : ''} nem nos componentes da Expedicao.`
              );
            }
          }

          for (const component of componentes) {
            const idComponente = Number(component.id_item_componente);
            const quantidadeComponente = this.normalizePlannedQuantity(
              Number(component.quantidade) * quantidadePendente
            );

            this.addReservedQuantity(reservasPorItem, idComponente, quantidadeComponente);
            movimentosPlanejados.push({
              id_peca: idComponente,
              quantidade: quantidadeComponente,
              observacao: `${data.observacao || 'Saida da Expedicao.'} Complemento da submontagem ${item.codigo}.`.slice(0, 255),
              solicitacao_ref: solicitacaoRef,
              id_peca_solicitada: idPeca,
              forma_atendimento: 'COMPONENTE_SUBMONTAGEM'
            });
          }

          quantidadeViaComponentes = quantidadePendente;
          quantidadePendente = 0;
        }

        if (quantidadePendente > 0) {
          if (composicaoVenda.possui_composicao) {
            throw this.createBusinessError(
              `O item ${item.codigo} nao possui saldo suficiente pronto nem pela composicao configurada na Expedicao.`
            );
          }

          throw this.createBusinessError(`Saldo insuficiente na Expedição para ${item.codigo}.`);
        }


        solicitacoes[solicitacoes.length - 1].quantidade_submontagem_pronta = quantidadeProntaConsumida;
        solicitacoes[solicitacoes.length - 1].quantidade_composicao_venda = composicaoVenda.quantidade_atendida;
        solicitacoes[solicitacoes.length - 1].itens_composicao_venda = composicaoVenda.itens_consumidos;
        solicitacoes[solicitacoes.length - 1].quantidade_componentes = quantidadeViaComponentes;


      }

      const resultados = [];

      for (const [idPeca, quantidade] of reservasPorItem.entries()) {
        const item = await this.findItemById(idPeca, connection);

        if (!item) {
          throw this.createBusinessError('Um dos itens informados nao foi encontrado para a saida.');
        }

        const saldoExpedicao = await this.findSaldoForUpdate(connection, expedicao.id, idPeca);
        const quantidadeAtual = saldoExpedicao ? Number(saldoExpedicao.quantidade) : 0;

        if (quantidade > quantidadeAtual) {
          throw this.createBusinessError(`Saldo insuficiente na Expedição para ${item.codigo}.`);
        }

        const novoSaldo = Number((quantidadeAtual - quantidade).toFixed(2));
        await this.persistSaldo(connection, expedicao.id, idPeca, novoSaldo, saldoExpedicao);

        resultados.push({
          id_peca: idPeca,
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade_baixada: quantidade,
          saldo_restante: novoSaldo
        });
      }

      for (const movimento of movimentosPlanejados) {
        const idMovimentacao = await this.createMovimentacao(connection, {
          id_peca: movimento.id_peca,
          id_estoque_origem: expedicao.id,
          id_estoque_destino: null,
          tipo_movimentacao: 'SAIDA',
          quantidade: movimento.quantidade,
          observacao: movimento.observacao
        });

        movimento.id_movimentacao_estoque = idMovimentacao;
      }

      const saida = await ExpedicaoSaidaModel.createFromProcess(connection, {
        tipo_saida: data.tipo_saida,
        observacao: data.observacao,
        usuario: data.usuario,
        solicitacoes,
        movimentos: movimentosPlanejados
      });

      await connection.commit();

      return {
        saida,
        estoque_origem: expedicao,
        itens: resultados,
        solicitacoes
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Realiza consumo interno sempre a partir do estoque do Almoxarifado.
  static async processConsumoInternoAlmoxarifado(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const almoxarifado = await this.findStockByName(this.ALMOXARIFADO_NOME, connection);

      if (!almoxarifado || Number(almoxarifado.ativo) !== 1) {
        throw this.createBusinessError('O estoque do Almoxarifado nao esta disponivel para realizar o consumo interno.');
      }

      const responsavel = String(data.responsavel_consumo || 'Producao').trim() || 'Producao';
      const observacaoBase = [
        `Consumo interno: ${responsavel}.`,
        data.observacao ? String(data.observacao).trim() : ''
      ].filter(Boolean).join(' ').slice(0, 255);
      const resultados = [];
      const solicitacoes = [];
      const movimentos = [];

      for (const itemSolicitado of data.itens || []) {
        const idPeca = Number(itemSolicitado.id_peca);
        const quantidade = this.normalizePlannedQuantity(itemSolicitado.quantidade);
        const item = await this.findItemById(idPeca, connection);

        if (!item) {
          throw this.createBusinessError('Um dos itens informados nao foi encontrado para o consumo interno.');
        }

        const saldoAtual = await this.findSaldoForUpdate(connection, almoxarifado.id, idPeca);
        const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;

        if (quantidade > quantidadeAtual) {
          throw this.createBusinessError(`Saldo insuficiente no Almoxarifado para ${item.codigo}.`);
        }

        const novoSaldo = Number((quantidadeAtual - quantidade).toFixed(2));
        await this.persistSaldo(connection, almoxarifado.id, idPeca, novoSaldo, saldoAtual);

        const solicitacaoRef = solicitacoes.length + 1;
        const observacaoMovimento = `${observacaoBase} Baixa do item ${item.codigo}.`.slice(0, 255);
        const idMovimentacao = await this.createMovimentacao(connection, {
          id_peca: idPeca,
          id_estoque_origem: almoxarifado.id,
          id_estoque_destino: null,
          tipo_movimentacao: 'SAIDA',
          quantidade,
          observacao: observacaoMovimento
        });

        solicitacoes.push({
          solicitacao_ref: solicitacaoRef,
          id_peca: idPeca,
          codigo: item.codigo,
          descricao: item.descricao,
          classificacao: item.classificacao,
          quantidade_solicitada: quantidade,
          quantidade_submontagem_pronta: quantidade,
          quantidade_composicao_venda: 0,
          quantidade_componentes: 0
        });

        movimentos.push({
          id_peca: idPeca,
          quantidade,
          observacao: observacaoMovimento,
          solicitacao_ref: solicitacaoRef,
          id_peca_solicitada: idPeca,
          forma_atendimento: 'PRONTO',
          id_movimentacao_estoque: idMovimentacao
        });

        resultados.push({
          id_peca: idPeca,
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade_baixada: quantidade,
          saldo_restante: novoSaldo
        });
      }

      const saida = await ExpedicaoSaidaModel.createFromProcess(connection, {
        tipo_saida: 'USO_INTERNO',
        observacao: observacaoBase,
        usuario: data.usuario,
        solicitacoes,
        movimentos
      });

      await connection.commit();

      return {
        saida,
        estoque_origem: almoxarifado,
        itens: resultados,
        solicitacoes
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

EstoqueModel.EXPEDICAO_NOME = 'Expedi\u00e7\u00e3o';
EstoqueModel.ALMOXARIFADO_NOME = 'Almoxarifado';

module.exports = EstoqueModel;
