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

  static MONTAGEM_NOME = 'Montagem';

  static ALMOXARIFADO_NOME = 'Almoxarifado';

  static SPECIAL_STOCK_NAMES = Object.freeze([
    'Pe\u00e7as Inacabadas',
    'Pecas Inacabadas',
    'Retrabalho'
  ]);

  // Cria um erro de negocio padronizado para as validacoes do fluxo.
  static createBusinessError(message, details = null) {
    const error = new Error(message);
    error.statusCode = 400;
    if (details) {
      error.details = details;
    }
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

  static buildSpecialStockPlaceholderList() {
    return this.SPECIAL_STOCK_NAMES.map(() => '?').join(', ');
  }

  static async findSpecialStockById(id, connection = pool) {
    const estoque = await this.findStockById(id, connection);
    const tipo = this.getSpecialStockType(estoque);

    return tipo ? { ...estoque, tipo_especial: tipo } : null;
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
          p.ativo,
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
        WHERE p.classificacao IN ('ITEM', 'SUBMONTAGEM') AND p.ativo = 1
        ORDER BY p.codigo ASC
      `
    );

    return rows;
  }

  // Lista os saldos com filtros dinamicos por estoque, item e atributos da peca.
  static async findSaldos(filters = {}) {
    const specialStock = filters.estoque
      ? await this.findSpecialStockById(filters.estoque)
      : null;

    if (filters.estoque && specialStock) {
      return this.findSpecialSaldos(filters);
    }

    const mostrarTodos = Boolean(filters.mostrar_todos);
    const quantidadeExpression = mostrarTodos ? 'COALESCE(s.quantidade, 0)' : 's.quantidade';
    const conditions = mostrarTodos
      ? ['e.ativo = 1', "p.classificacao IN ('ITEM', 'SUBMONTAGEM')", 'p.ativo = 1']
      : ['s.quantidade > 0', 'p.ativo = 1'];
    const values = [...this.SPECIAL_STOCK_NAMES];
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

    conditions.push(`e.nome NOT IN (${this.buildSpecialStockPlaceholderList()})`);

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

    if (!filters.estoque) {
      const specialRows = await this.findSpecialSaldos(filters);
      return rows.concat(specialRows);
    }

    return rows;
  }

  static async findSpecialSaldos(filters = {}) {
    const conditions = [
      'r.quantidade > 0',
      'e.ativo = 1',
      'p.ativo = 1',
      "p.classificacao IN ('ITEM', 'SUBMONTAGEM')"
    ];
    const values = [];
    const orderBy = filters.ordem_quantidade
      ? `quantidade ${filters.ordem_quantidade}, p.codigo ASC`
      : 'e.id ASC, p.codigo ASC';

    if (filters.estoque) {
      conditions.push('r.id_estoque = ?');
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

    const [rows] = await pool.query(
      `
        SELECT
          MIN(r.id) AS id,
          e.id AS id_estoque,
          p.id AS id_peca,
          SUM(r.quantidade) AS quantidade,
          MIN(r.created_at) AS created_at,
          MAX(r.updated_at) AS updated_at,
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
          COALESCE(fs.fornecedores_nomes, f.nome, '') AS fornecedores_nomes,
          r.tipo AS estoque_especial_tipo,
          1 AS estoque_especial
        FROM estoque_especial_registros r
        INNER JOIN estoques e ON e.id = r.id_estoque
        INNER JOIN pecas p ON p.id = r.id_peca
        LEFT JOIN maquinas m ON m.id = p.id_maquina
        LEFT JOIN fornecedores f ON f.id = p.id_fornecedor
        LEFT JOIN (${this.supplierSummarySubquery()}) fs ON fs.id_peca = p.id
        WHERE ${conditions.join(' AND ')}
        GROUP BY
          e.id,
          e.nome,
          e.descricao,
          p.id,
          p.codigo,
          p.descricao,
          p.tipo,
          p.classificacao,
          p.estoque_minimo,
          p.estoque_seguranca,
          p.consumo_mensal,
          p.id_maquina,
          m.nome,
          p.id_fornecedor,
          f.nome,
          fs.fornecedores_nomes,
          r.tipo
        ORDER BY ${orderBy}
      `,
      values
    );

    return rows;
  }

  // Lista itens por prioridade de reposicao/producao, incluindo saldo zerado.
  static async findPrioridades(filters = {}) {
    const specialStock = filters.estoque
      ? await this.findSpecialStockById(filters.estoque)
      : null;

    if (filters.estoque && specialStock) {
      return this.findSpecialPrioridades(filters);
    }

    const values = [];
    const baseConditions = [
      'e.ativo = 1',
      "p.classificacao IN ('ITEM', 'SUBMONTAGEM')",
      'p.ativo = 1',
      `e.nome NOT IN (${this.buildSpecialStockPlaceholderList()})`
    ];
    values.push(...this.SPECIAL_STOCK_NAMES);
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

    if (!filters.estoque) {
      const specialRows = await this.findSpecialPrioridades(filters);
      return rows.concat(specialRows);
    }

    return rows;
  }

  static async findSpecialPrioridades(filters = {}) {
    if (filters.modo === 'prioritarios') {
      return [];
    }

    if (filters.estado && filters.estado !== 'NORMAL') {
      return [];
    }

    const saldos = await this.findSpecialSaldos(filters);

    return saldos.map((saldo) => ({
      ...saldo,
      quantidade_atual: saldo.quantidade,
      quantidade_pacote: saldo.estoque_minimo,
      quantidade_saida_mes: Number(saldo.consumo_mensal || 0),
      dias_cobertura: null,
      data_prevista_ruptura: null,
      estado_necessidade: 'NORMAL',
      prioridade_necessidade: 4
    }));
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
          em.id_usuario,
          em.usuario_login,
          em.usuario_nome,
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
          p.ativo,
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
          p.descricao,
          p.classificacao
          ,p.ativo
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

  static getSpecialStockType(estoque) {
    const nome = String(estoque?.nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

    if (nome === 'RETRABALHO') return 'RETRABALHO';
    if (nome === 'PECAS INACABADAS') return 'PECAS_INACABADAS';
    return null;
  }

  static async findSpecialStockQuantityForUpdate(connection, idEstoque, idPeca) {
    const [rows] = await connection.query(
      `
        SELECT id, quantidade
        FROM estoque_especial_registros
        WHERE id_estoque = ?
          AND id_peca = ?
          AND quantidade > 0
        ORDER BY id ASC
        FOR UPDATE
      `,
      [idEstoque, idPeca]
    );

    return {
      rows,
      quantidade: Number(rows.reduce((total, row) => total + Number(row.quantidade || 0), 0).toFixed(2))
    };
  }

  static async reduceSpecialStockQuantity(connection, specialStock, quantidade) {
    let restante = Number(quantidade);

    for (const row of specialStock.rows) {
      if (restante <= 0) break;

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

  static async addSpecialStockQuantity(connection, data) {
    await connection.query(
      `
        INSERT INTO estoque_especial_registros (
          tipo,
          id_estoque,
          id_peca,
          quantidade,
          origem,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        data.tipo,
        data.id_estoque,
        data.id_peca,
        data.quantidade,
        'TRANSFERENCIA_ESTOQUE',
        data.observacao || 'Entrada por transferencia entre estoques.'
      ]
    );
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
    idEstoqueOrigem = null,
    usuario = null
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
        observacao: this.buildExpandedObservation(observacaoBase, submontagem.codigo, submontagem.descricao),
        usuario
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
    observacaoBase,
    usuario = null
  ) {
    const componentes = await this.findSubmontagemComponents(submontagem.id, connection);

    if (componentes.length === 0) {
      throw this.createBusinessError(`A submontagem ${submontagem.codigo} nao possui componentes cadastrados.`);
    }

    const componentesInativos = componentes.filter((componente) => Number(componente.ativo) !== 1);
    if (componentesInativos.length > 0) {
      throw this.createBusinessError(
        `Nao e possivel montar a submontagem ${submontagem.codigo} porque ela possui componente inativo: ${componentesInativos.map((item) => item.codigo).join(', ')}.`
      );
    }

    const faltantes = [];

    for (const componente of componentes) {
      const quantidadeConsumida = Number(
        (Number(componente.quantidade) * Number(quantidadeBase)).toFixed(2)
      );
      const saldoOrigem = await this.findSaldoForUpdate(connection, idEstoqueOrigem, componente.id_item_componente);
      const quantidadeOrigem = saldoOrigem ? Number(saldoOrigem.quantidade) : 0;

      if (quantidadeConsumida > quantidadeOrigem) {
        faltantes.push({
          id_peca: componente.id_item_componente,
          codigo: componente.codigo,
          descricao: componente.descricao,
          quantidade_necessaria: quantidadeConsumida,
          quantidade_disponivel: quantidadeOrigem,
          quantidade_faltante: Number((quantidadeConsumida - quantidadeOrigem).toFixed(2))
        });
      }
    }

    if (faltantes.length > 0) {
      throw this.createBusinessError(
        `Nao ha componentes suficientes na Montagem para montar a submontagem ${submontagem.codigo}.`,
        {
          tipo: 'FALTA_COMPONENTE_SUBMONTAGEM',
          submontagem: {
            id: submontagem.id,
            codigo: submontagem.codigo,
            descricao: submontagem.descricao
          },
          faltantes
        }
      );
    }

    const consumos = [];

    for (const componente of componentes) {
      const quantidadeConsumida = Number(
        (Number(componente.quantidade) * Number(quantidadeBase)).toFixed(2)
      );
      const saldoOrigem = await this.findSaldoForUpdate(connection, idEstoqueOrigem, componente.id_item_componente);
      const quantidadeOrigem = saldoOrigem ? Number(saldoOrigem.quantidade) : 0;

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
        observacao: `${observacaoBase || 'Consumo de componentes para montagem.'} Componente ${componente.codigo} consumido na montagem de ${submontagem.codigo} para ${estoqueDestinoSubmontagem}.`.slice(0, 255),
        usuario
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

  // Le o saldo atual sem aplicar bloqueio, usado em diagnosticos.
  static async findSaldo(connection, idEstoque, idPeca) {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          quantidade
        FROM estoque_saldos
        WHERE id_estoque = ? AND id_peca = ?
      `,
      [idEstoque, idPeca]
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

  static async findItemByIdCached(connection, id, itemCache = null) {
    const itemId = Number(id);

    if (itemCache?.has(itemId)) {
      return itemCache.get(itemId);
    }

    const item = await this.findItemById(itemId, connection);

    if (itemCache) {
      itemCache.set(itemId, item || null);
    }

    return item || null;
  }

  static buildReservaKey(idEstoque, idPeca) {
    return `${Number(idEstoque)}:${Number(idPeca)}`;
  }

  static parseReservaKey(key) {
    const [idEstoqueText, idPecaText] = String(key).split(':');
    return {
      id_estoque: Number(idEstoqueText),
      id_peca: Number(idPecaText)
    };
  }

  static addReservedQuantity(reservasPorItem, idPeca, quantidade, idEstoque = null) {
    const key = idEstoque === null
      ? Number(idPeca)
      : this.buildReservaKey(idEstoque, idPeca);
    const quantidadeAtual = Number(reservasPorItem.get(key) || 0);
    reservasPorItem.set(
      key,
      Number((quantidadeAtual + Number(quantidade)).toFixed(2))
    );
  }

  static getReservedQuantity(reservasPorItem, idEstoque, idPeca) {
    const quantidadePorEstoque = Number(
      reservasPorItem.get(this.buildReservaKey(idEstoque, idPeca)) || 0
    );

    if (quantidadePorEstoque > 0) {
      return quantidadePorEstoque;
    }

    return Number(reservasPorItem.get(Number(idPeca)) || 0);
  }

  static async getAvailableQuantity(connection, idEstoque, idPeca, reservasPorItem, options = {}) {
    const saldoAtual = options.lock === false
      ? await this.findSaldo(connection, idEstoque, idPeca)
      : await this.findSaldoForUpdate(connection, idEstoque, idPeca);
    const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
    const quantidadeReservada = this.getReservedQuantity(reservasPorItem, idEstoque, idPeca);

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

  static formatQuantidadeMensagem(value) {
    const numero = Number(value || 0);
    if (Number.isInteger(numero)) {
      return String(numero);
    }

    return numero.toFixed(2);
  }

  static buildMensagemFaltaVenda({
    itemVendaCodigo,
    itemFaltanteCodigo,
    quantidadeNecessaria,
    disponivelExpedicao,
    disponivelMontagem
  }) {
    const totalDisponivel = Number((Number(disponivelExpedicao || 0) + Number(disponivelMontagem || 0)).toFixed(2));
    return `Nao foi possivel vender ${itemVendaCodigo}. Faltou ${itemFaltanteCodigo}: necessario ${this.formatQuantidadeMensagem(quantidadeNecessaria)}, disponivel ${this.formatQuantidadeMensagem(totalDisponivel)} (Expedicao ${this.formatQuantidadeMensagem(disponivelExpedicao)} + Montagem ${this.formatQuantidadeMensagem(disponivelMontagem)}).`;
  }

  static buildMensagemFaltasComponentes({
    itemVendaCodigo,
    faltas = []
  }) {
    if (!Array.isArray(faltas) || !faltas.length) {
      return `Nao foi possivel vender ${itemVendaCodigo}.`;
    }

    const detalhes = faltas.map((falta) => {
      return `${falta.codigo}: necessario ${this.formatQuantidadeMensagem(falta.necessario)}, disponivel ${this.formatQuantidadeMensagem(falta.disponivel_total)} (Expedicao ${this.formatQuantidadeMensagem(falta.disponivel_expedicao)} + Montagem ${this.formatQuantidadeMensagem(falta.disponivel_montagem)})`;
    }).join('; ');

    return `Nao foi possivel vender ${itemVendaCodigo}. Pecas faltantes: ${detalhes}.`;
  }

  static buildErroDetalhadoFaltaVenda(itemVenda, faltas = [], itensDiagnostico = []) {
    return {
      tipo: 'FALTA_ESTOQUE_VENDA',
      item_venda: {
        id_peca: Number(itemVenda?.id || 0),
        codigo: itemVenda?.codigo || '-',
        descricao: itemVenda?.descricao || '-'
      },
      faltas,
      itens_diagnostico: Array.isArray(itensDiagnostico) && itensDiagnostico.length
        ? itensDiagnostico
        : faltas
    };
  }

  static addExpandedItemDemand(demandas, item, quantidade) {
    const idPeca = Number(item?.id_peca ?? item?.id);

    if (!idPeca) {
      return;
    }

    const quantidadeNormalizada = this.normalizePlannedQuantity(quantidade);
    const demandaAtual = demandas.get(idPeca) || {
      id_peca: idPeca,
      codigo: item?.codigo || '-',
      descricao: item?.descricao || item?.codigo || '-',
      classificacao: item?.classificacao || 'ITEM',
      quantidade: 0
    };

    demandaAtual.quantidade = this.normalizePlannedQuantity(
      Number(demandaAtual.quantidade || 0) + quantidadeNormalizada
    );
    demandas.set(idPeca, demandaAtual);
  }

  static async expandItemSaidaDemand(
    connection,
    item,
    quantidadeBase,
    itemCache = new Map(),
    trilha = []
  ) {
    const quantidadeNormalizada = this.normalizePlannedQuantity(quantidadeBase);

    if (quantidadeNormalizada <= 0) {
      return [];
    }

    const itemId = Number(item?.id);

    if (!itemId) {
      throw this.createBusinessError('Um dos itens informados nao foi encontrado para a saida.');
    }

    if (trilha.includes(itemId)) {
      const codigosTrilha = [...trilha, itemId].map((idAtual) => {
        const itemTrilha = itemCache.get(Number(idAtual));
        return itemTrilha?.codigo || String(idAtual);
      });

      throw this.createBusinessError(
        `Foi detectado um ciclo na estrutura da submontagem ${item.codigo}. Caminho: ${codigosTrilha.join(' -> ')}.`
      );
    }

    if (item.classificacao !== 'SUBMONTAGEM') {
      return [{
        id_peca: itemId,
        codigo: item.codigo,
        descricao: item.descricao,
        classificacao: item.classificacao,
        quantidade: quantidadeNormalizada
      }];
    }

    const componentes = await this.findSubmontagemComponents(itemId, connection);

    if (!componentes.length) {
      throw this.createBusinessError(`A submontagem ${item.codigo} nao possui componentes cadastrados.`);
    }

    const demandas = new Map();
    const proximaTrilha = [...trilha, itemId];

    for (const componente of componentes) {
      const quantidadeComponente = this.normalizePlannedQuantity(
        Number(componente.quantidade || 0) * quantidadeNormalizada
      );

      if (quantidadeComponente <= 0) {
        continue;
      }

      const itemComponente = await this.findItemByIdCached(
        connection,
        componente.id_item_componente,
        itemCache
      );

      if (!itemComponente) {
        throw this.createBusinessError(
          `O componente ${componente.codigo || componente.id_item_componente} nao foi encontrado na estrutura de ${item.codigo}.`
        );
      }

      const demandasFilhas = await this.expandItemSaidaDemand(
        connection,
        itemComponente,
        quantidadeComponente,
        itemCache,
        proximaTrilha
      );

      demandasFilhas.forEach((demandaFilha) => {
        this.addExpandedItemDemand(demandas, demandaFilha, demandaFilha.quantidade);
      });
    }

    return [...demandas.values()].sort((a, b) => (
      String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR')
      || Number(a.id_peca) - Number(b.id_peca)
    ));
  }

  static buildFaltaSaidaDetalhe(item, quantidadeNecessaria, disponivelExpedicao, disponivelMontagem) {
    const necessario = this.normalizePlannedQuantity(quantidadeNecessaria);
    const quantidadeExpedicao = this.normalizePlannedQuantity(
      Math.max(0, Number(disponivelExpedicao || 0))
    );
    const quantidadeMontagem = this.normalizePlannedQuantity(
      Math.max(0, Number(disponivelMontagem || 0))
    );
    const quantidadeTotal = this.normalizePlannedQuantity(
      quantidadeExpedicao + quantidadeMontagem
    );

    return {
      id_peca: Number(item?.id_peca ?? item?.id) || null,
      codigo: item?.codigo || '-',
      descricao: item?.descricao || item?.codigo || '-',
      necessario,
      disponivel_expedicao: quantidadeExpedicao,
      disponivel_montagem: quantidadeMontagem,
      disponivel_total: quantidadeTotal,
      falta: this.normalizePlannedQuantity(Math.max(0, necessario - quantidadeTotal))
    };
  }

  static buildDiagnosticoSaidaDetalhe(item, quantidadeNecessaria, disponivelExpedicao, disponivelMontagem) {
    const detalhe = this.buildFaltaSaidaDetalhe(
      item,
      quantidadeNecessaria,
      disponivelExpedicao,
      disponivelMontagem
    );

    let statusAtendimento = 'OK_EXPEDICAO';

    if (detalhe.falta > 0) {
      statusAtendimento = 'FALTA_ESTOQUE';
    } else if (detalhe.disponivel_expedicao < detalhe.necessario) {
      statusAtendimento = 'COMPLEMENTA_MONTAGEM';
    }

    return {
      ...detalhe,
      status_atendimento: statusAtendimento
    };
  }

  static createSaidaFaltaError(itemSolicitado, faltas = [], itensDiagnostico = []) {
    if (
      faltas.length === 1
      && Number(faltas[0]?.id_peca || 0) === Number(itemSolicitado?.id || 0)
      && itemSolicitado?.classificacao !== 'SUBMONTAGEM'
    ) {
      const falta = faltas[0];

      return this.createBusinessError(
        this.buildMensagemFaltaVenda({
          itemVendaCodigo: itemSolicitado.codigo,
          itemFaltanteCodigo: falta.codigo,
          quantidadeNecessaria: falta.necessario,
          disponivelExpedicao: falta.disponivel_expedicao,
          disponivelMontagem: falta.disponivel_montagem
        }),
        this.buildErroDetalhadoFaltaVenda(itemSolicitado, faltas, itensDiagnostico)
      );
    }

    return this.createBusinessError(
      this.buildMensagemFaltasComponentes({
        itemVendaCodigo: itemSolicitado?.codigo || '-',
        faltas
      }),
      this.buildErroDetalhadoFaltaVenda(itemSolicitado, faltas, itensDiagnostico)
    );
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

    const planosPorLinha = [];

    for (const linha of composicao) {
      const quantidadeLinha = Number(linha.quantidade);

      if (quantidadeLinha <= 0) {
        planosPorLinha.push({
          linha,
          itemAtende: null,
          componentes: [],
          quantidadeLinha,
          capacidade: 0
        });
        continue;
      }

      const disponibilidade = await this.getAvailableQuantity(
        connection,
        idEstoqueOrigem,
        linha.id_item_atende,
        reservasPorItem
      );

      const itemAtende = await this.findItemById(linha.id_item_atende, connection);
      let capacidadeLinha = Number((Math.max(0, disponibilidade.quantidadeDisponivel) / quantidadeLinha).toFixed(2));
      let componentes = [];

      if (itemAtende && itemAtende.classificacao === 'SUBMONTAGEM') {
        componentes = await this.findSubmontagemComponents(linha.id_item_atende, connection);

        if (componentes.length > 0) {
          const capacidadesComponentes = [];

          for (const componente of componentes) {
            const quantidadeComponentePorVenda = this.normalizePlannedQuantity(
              Number(componente.quantidade) * quantidadeLinha
            );
            const disponibilidadeComponente = await this.getAvailableQuantity(
              connection,
              idEstoqueOrigem,
              componente.id_item_componente,
              reservasPorItem
            );

            capacidadesComponentes.push(
              quantidadeComponentePorVenda > 0
                ? Number((Math.max(0, disponibilidadeComponente.quantidadeDisponivel) / quantidadeComponentePorVenda).toFixed(2))
                : 0
            );
          }

          capacidadeLinha = Number((
            capacidadeLinha + Math.min(...capacidadesComponentes)
          ).toFixed(2));
        }
      }

      planosPorLinha.push({
        linha,
        itemAtende,
        componentes,
        quantidadeLinha,
        capacidade: capacidadeLinha
      });
    }

    const quantidadeAtendida = this.normalizePlannedQuantity(
      Math.min(
        Number(quantidadeDesejada),
        ...planosPorLinha.map((plano) => plano.capacidade)
      )
    );

    if (quantidadeAtendida <= 0) {
      return {
        possui_composicao: true,
        quantidade_atendida: 0,
        itens_consumidos: []
      };
    }

    const reservasPlanejadas = new Map(reservasPorItem);
    const movimentosComposicao = [];
    const itensConsumidos = [];

    for (const plano of planosPorLinha) {
      const quantidadeNecessariaLinha = this.normalizePlannedQuantity(
        plano.quantidadeLinha * quantidadeAtendida
      );

      if (quantidadeNecessariaLinha <= 0) {
        continue;
      }

      const disponibilidadePronta = await this.getAvailableQuantity(
        connection,
        idEstoqueOrigem,
        plano.linha.id_item_atende,
        reservasPlanejadas
      );
      const quantidadeProntaConsumida = this.normalizePlannedQuantity(
        Math.min(
          quantidadeNecessariaLinha,
          Math.max(0, disponibilidadePronta.quantidadeDisponivel)
        )
      );
      let quantidadeRestanteLinha = this.normalizePlannedQuantity(
        quantidadeNecessariaLinha - quantidadeProntaConsumida
      );

      if (quantidadeProntaConsumida > 0) {
        this.addReservedQuantity(
          reservasPlanejadas,
          plano.linha.id_item_atende,
          quantidadeProntaConsumida,
          idEstoqueOrigem
        );
        movimentosComposicao.push({
          id_peca: plano.linha.id_item_atende,
          quantidade: quantidadeProntaConsumida,
          observacao: `${observacaoBase || 'Saida da Expedicao.'} Atendimento alternativo de ${item.codigo} via ${plano.linha.item_atende_codigo}.`.slice(0, 255),
          solicitacao_ref: contextoSaida.solicitacao_ref,
          id_peca_solicitada: item.id,
          forma_atendimento: 'COMPOSICAO_VENDA',
          id_estoque_origem: idEstoqueOrigem
        });
        itensConsumidos.push({
          id_peca: plano.linha.id_item_atende,
          codigo: plano.linha.item_atende_codigo,
          descricao: plano.linha.item_atende_descricao,
          quantidade_baixada: quantidadeProntaConsumida
        });
      }

      if (quantidadeRestanteLinha <= 0) {
        continue;
      }

      if (!plano.itemAtende || plano.itemAtende.classificacao !== 'SUBMONTAGEM' || !plano.componentes.length) {
        return {
          possui_composicao: true,
          quantidade_atendida: 0,
          itens_consumidos: []
        };
      }

      for (const componente of plano.componentes) {
        const quantidadeComponente = this.normalizePlannedQuantity(
          Number(componente.quantidade) * quantidadeRestanteLinha
        );
        const disponibilidadeComponente = await this.getAvailableQuantity(
          connection,
          idEstoqueOrigem,
          componente.id_item_componente,
          reservasPlanejadas
        );

        if (quantidadeComponente > disponibilidadeComponente.quantidadeDisponivel) {
          return {
            possui_composicao: true,
            quantidade_atendida: 0,
            itens_consumidos: []
          };
        }
      }

      for (const componente of plano.componentes) {
        const quantidadeComponente = this.normalizePlannedQuantity(
          Number(componente.quantidade) * quantidadeRestanteLinha
        );

        if (quantidadeComponente <= 0) {
          continue;
        }

        this.addReservedQuantity(
          reservasPlanejadas,
          componente.id_item_componente,
          quantidadeComponente,
          idEstoqueOrigem
        );
        movimentosComposicao.push({
          id_peca: componente.id_item_componente,
          quantidade: quantidadeComponente,
          observacao: `${observacaoBase || 'Saida da Expedicao.'} Atendimento de ${item.codigo} via componentes de ${plano.linha.item_atende_codigo}: ${componente.codigo}.`.slice(0, 255),
          solicitacao_ref: contextoSaida.solicitacao_ref,
          id_peca_solicitada: item.id,
          forma_atendimento: 'COMPONENTE_SUBMONTAGEM',
          id_estoque_origem: idEstoqueOrigem
        });
        itensConsumidos.push({
          id_peca: componente.id_item_componente,
          codigo: componente.codigo,
          descricao: componente.descricao,
          quantidade_baixada: quantidadeComponente,
          origem_composicao: plano.linha.item_atende_codigo
        });
      }
    }

    for (const [idPeca, quantidade] of reservasPlanejadas.entries()) {
      reservasPorItem.set(idPeca, quantidade);
    }
    movimentosPlanejados.push(...movimentosComposicao);

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
          observacao,
          id_usuario,
          usuario_login,
          usuario_nome
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.id_peca,
        data.id_estoque_origem,
        data.id_estoque_destino,
        data.tipo_movimentacao,
        data.quantidade,
        data.observacao,
        data.usuario?.id || null,
        data.usuario?.login || null,
        data.usuario?.nome || null
      ]
    );

    return result.insertId;
  }

  // Realiza uma entrada inicial somando o saldo no estoque escolhido.
  static async processEntradaInicial(data, externalConnection = null) {
    const connection = externalConnection || await pool.getConnection();
    const managesTransaction = !externalConnection;

    try {
      if (managesTransaction) {
        await connection.beginTransaction();
      }

      const item = await this.findItemById(data.id_peca, connection);
      if (!item) {
        throw this.createBusinessError('Item nao encontrado para a entrada inicial.');
      }
      if (Number(item.ativo) !== 1) {
        throw this.createBusinessError(`O item ${item.codigo} esta inativo e nao pode receber uma nova entrada ou montagem.`);
      }

      const estoqueDestino = await this.findStockById(data.id_estoque_destino, connection);
      if (!estoqueDestino || Number(estoqueDestino.ativo) !== 1) {
        throw this.createBusinessError('Estoque de destino nao encontrado ou inativo.');
      }
      const tipoEspecialDestino = this.getSpecialStockType(estoqueDestino);

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
          data.observacao || 'Montagem de submontagem pela entrada de estoque.',
          data.usuario
        );

        const saldoAtualSubmontagem = tipoEspecialDestino
          ? await this.findSpecialStockQuantityForUpdate(connection, data.id_estoque_destino, data.id_peca)
          : await this.findSaldoForUpdate(
            connection,
            data.id_estoque_destino,
            data.id_peca
          );
        const quantidadeAtualSubmontagem = tipoEspecialDestino
          ? saldoAtualSubmontagem.quantidade
          : (saldoAtualSubmontagem ? Number(saldoAtualSubmontagem.quantidade) : 0);
        const novoSaldoSubmontagem = Number((quantidadeAtualSubmontagem + Number(data.quantidade)).toFixed(2));

        if (tipoEspecialDestino) {
          await this.addSpecialStockQuantity(connection, {
            tipo: tipoEspecialDestino,
            id_estoque: data.id_estoque_destino,
            id_peca: data.id_peca,
            quantidade: data.quantidade,
            observacao: data.observacao || 'Entrada inicial registrada manualmente.'
          });
        } else {
          await this.persistSaldo(
            connection,
            data.id_estoque_destino,
            data.id_peca,
            novoSaldoSubmontagem,
            saldoAtualSubmontagem
          );
        }

        await this.createMovimentacao(connection, {
          id_peca: data.id_peca,
          id_estoque_origem: estoqueOrigemComponentes.id,
          id_estoque_destino: data.id_estoque_destino,
          tipo_movimentacao: 'ENTRADA_INICIAL',
          quantidade: data.quantidade,
          observacao: `${data.observacao || 'Montagem de submontagem pela entrada de estoque.'} Submontagem montada com consumo de componentes.`.slice(0, 255),
          usuario: data.usuario
        });

        if (managesTransaction) {
          await connection.commit();
        }

        return {
          item,
          estoque_origem_componentes: estoqueOrigemComponentes,
          estoque_destino: estoqueDestino,
          saldo_anterior: quantidadeAtualSubmontagem,
          saldo_atual: novoSaldoSubmontagem,
          componentes_consumidos: componentesConsumidos
        };
      }

      const saldoAtual = tipoEspecialDestino
        ? await this.findSpecialStockQuantityForUpdate(connection, data.id_estoque_destino, data.id_peca)
        : await this.findSaldoForUpdate(
          connection,
          data.id_estoque_destino,
          data.id_peca
        );

      const quantidadeAtual = tipoEspecialDestino
        ? saldoAtual.quantidade
        : (saldoAtual ? Number(saldoAtual.quantidade) : 0);
      const novoSaldo = quantidadeAtual + Number(data.quantidade);

      if (tipoEspecialDestino) {
        await this.addSpecialStockQuantity(connection, {
          tipo: tipoEspecialDestino,
          id_estoque: data.id_estoque_destino,
          id_peca: data.id_peca,
          quantidade: data.quantidade,
          observacao: data.observacao || 'Entrada inicial registrada manualmente.'
        });
      } else {
        await this.persistSaldo(
          connection,
          data.id_estoque_destino,
          data.id_peca,
          novoSaldo,
          saldoAtual
        );
      }

      await this.createMovimentacao(connection, {
        id_peca: data.id_peca,
        id_estoque_origem: null,
        id_estoque_destino: data.id_estoque_destino,
        tipo_movimentacao: 'ENTRADA_INICIAL',
        quantidade: data.quantidade,
        observacao: data.observacao || 'Entrada inicial registrada manualmente.',
        usuario: data.usuario
      });

      if (managesTransaction) {
        await connection.commit();
      }

      return {
        item,
        estoque_destino: estoqueDestino,
        saldo_anterior: quantidadeAtual,
        saldo_atual: novoSaldo
      };
    } catch (error) {
      if (managesTransaction) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (managesTransaction) {
        connection.release();
      }
    }
  }

  // Registra uma lista de entradas manuais em uma unica transacao.
  static async processEntradaInicialBatch(items = []) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const resultados = [];

      for (const item of items) {
        resultados.push(await this.processEntradaInicial(item, connection));
      }

      await connection.commit();
      return {
        total_itens: resultados.length,
        itens: resultados
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Realiza transferencia entre dois estoques atualizando origem e destino.
  static async processTransferencia(data, externalConnection = null) {
    const connection = externalConnection || await pool.getConnection();
    const managesTransaction = !externalConnection;

    try {
      if (managesTransaction) {
        await connection.beginTransaction();
      }

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

      const tipoEspecialOrigem = this.getSpecialStockType(estoqueOrigem);
      const tipoEspecialDestino = this.getSpecialStockType(estoqueDestino);
      const saldoOrigem = tipoEspecialOrigem
        ? await this.findSpecialStockQuantityForUpdate(connection, data.id_estoque_origem, data.id_peca)
        : await this.findSaldoForUpdate(connection, data.id_estoque_origem, data.id_peca);
      const quantidadeOrigem = tipoEspecialOrigem
        ? saldoOrigem.quantidade
        : (saldoOrigem ? Number(saldoOrigem.quantidade) : 0);
      const quantidadeTransferida = Number(data.quantidade);

      if (quantidadeTransferida > quantidadeOrigem) {
        throw this.createBusinessError(
          `A quantidade informada e maior que o saldo disponivel em ${estoqueOrigem.nome} (${quantidadeOrigem}).`
        );
      }

      const saldoDestino = tipoEspecialDestino
        ? await this.findSpecialStockQuantityForUpdate(connection, data.id_estoque_destino, data.id_peca)
        : await this.findSaldoForUpdate(connection, data.id_estoque_destino, data.id_peca);
      const quantidadeDestino = tipoEspecialDestino
        ? saldoDestino.quantidade
        : (saldoDestino ? Number(saldoDestino.quantidade) : 0);

      if (tipoEspecialOrigem) {
        await this.reduceSpecialStockQuantity(connection, saldoOrigem, quantidadeTransferida);
      } else {
        await this.persistSaldo(
          connection,
          data.id_estoque_origem,
          data.id_peca,
          quantidadeOrigem - quantidadeTransferida,
          saldoOrigem
        );
      }

      if (tipoEspecialDestino) {
        await this.addSpecialStockQuantity(connection, {
          tipo: tipoEspecialDestino,
          id_estoque: data.id_estoque_destino,
          id_peca: data.id_peca,
          quantidade: quantidadeTransferida,
          observacao: data.observacao
        });
      } else {
        await this.persistSaldo(
          connection,
          data.id_estoque_destino,
          data.id_peca,
          quantidadeDestino + quantidadeTransferida,
          saldoDestino
        );
      }

      await this.createMovimentacao(connection, {
        id_peca: data.id_peca,
        id_estoque_origem: data.id_estoque_origem,
        id_estoque_destino: data.id_estoque_destino,
        tipo_movimentacao: 'TRANSFERENCIA',
        quantidade: data.quantidade,
        observacao: data.observacao || 'Transferencia entre estoques.',
        usuario: data.usuario
      });

      if (managesTransaction) {
        await connection.commit();
      }

      return {
        item,
        estoque_origem: estoqueOrigem,
        estoque_destino: estoqueDestino,
        saldo_origem_atual: quantidadeOrigem - quantidadeTransferida,
        saldo_destino_atual: quantidadeDestino + quantidadeTransferida
      };
    } catch (error) {
      if (managesTransaction) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (managesTransaction) {
        connection.release();
      }
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
        observacao: `${data.observacao || 'Desmembramento de submontagem.'} Saida da submontagem ${submontagem.codigo} para retorno dos componentes.`.slice(0, 255),
        usuario: data.usuario
      });

      const componentesRetornados = await this.expandSubmontagemIntoStock(
        connection,
        submontagem,
        quantidadeDesmembrada,
        data.id_estoque_destino,
        data.observacao || 'Desmembramento de submontagem.',
        'TRANSFERENCIA',
        data.id_estoque_origem,
        data.usuario
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

      if (this.getSpecialStockType(estoque)) {
        throw this.createBusinessError('Use a tela especifica de retrabalho ou pecas inacabadas para ajustar este saldo.');
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
        observacao: data.observacao || 'Ajuste manual de saldo.',
        usuario: data.usuario
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

  // Realiza a saida final priorizando Expedicao e complementando pela Montagem.
  static async processSaidaLote(data) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const simular = Boolean(data.simular);

      const expedicao = await this.findStockByName(this.EXPEDICAO_NOME, connection);
      const montagem = await this.findStockByName(this.MONTAGEM_NOME, connection);

      if (!expedicao || Number(expedicao.ativo) !== 1) {
        throw this.createBusinessError('O estoque de Expedição nao esta disponivel para realizar a saida.');
      }

      if (!montagem || Number(montagem.ativo) !== 1) {
        throw this.createBusinessError('O estoque de Montagem nao esta disponivel para complementar a saida.');
      }

      const reservasPorItem = new Map();
      const movimentosPlanejados = [];
      const solicitacoes = [];
      const itemCache = new Map();
      const usarBloqueio = !simular;

      for (const itemSolicitado of data.itens) {
        const idPeca = Number(itemSolicitado.id_peca);
        const quantidadeSolicitada = this.normalizePlannedQuantity(itemSolicitado.quantidade);
        const item = await this.findItemByIdCached(connection, idPeca, itemCache);
        const solicitacaoRef = solicitacoes.length + 1;

        if (!item) {
          throw this.createBusinessError('Um dos itens informados nao foi encontrado para a saida.');
        }

        if (quantidadeSolicitada <= 0) {
          throw this.createBusinessError(`Informe uma quantidade valida para ${item.codigo}.`);
        }

        const itensFinais = await this.expandItemSaidaDemand(
          connection,
          item,
          quantidadeSolicitada,
          itemCache
        );

        if (!itensFinais.length) {
          throw this.createBusinessError(`A estrutura de ${item.codigo} nao gerou itens para a baixa.`);
        }

        solicitacoes.push({
          solicitacao_ref: solicitacaoRef,
          id_peca: idPeca,
          codigo: item.codigo,
          descricao: item.descricao,
          classificacao: item.classificacao,
          quantidade_solicitada: quantidadeSolicitada,
          quantidade_submontagem_pronta: item.classificacao === 'ITEM' ? quantidadeSolicitada : 0,
          quantidade_composicao_venda: 0,
          itens_composicao_venda: [],
          quantidade_componentes: item.classificacao === 'SUBMONTAGEM' ? quantidadeSolicitada : 0
        });

        const faltas = [];
        const itensDiagnostico = [];

        for (const itemFinal of itensFinais) {
          const quantidadeNecessaria = this.normalizePlannedQuantity(itemFinal.quantidade);

          if (quantidadeNecessaria <= 0) {
            continue;
          }

          const disponibilidadeExpedicao = await this.getAvailableQuantity(
            connection,
            expedicao.id,
            itemFinal.id_peca,
            reservasPorItem,
            { lock: usarBloqueio }
          );

          const quantidadeDaExpedicao = this.normalizePlannedQuantity(
            Math.min(
              quantidadeNecessaria,
              Math.max(0, disponibilidadeExpedicao.quantidadeDisponivel)
            )
          );

          if (quantidadeDaExpedicao > 0) {
            this.addReservedQuantity(
              reservasPorItem,
              itemFinal.id_peca,
              quantidadeDaExpedicao,
              expedicao.id
            );
            movimentosPlanejados.push({
              id_peca: itemFinal.id_peca,
              quantidade: quantidadeDaExpedicao,
              observacao: item.classificacao === 'SUBMONTAGEM'
                ? `${data.observacao || 'Saida da Expedicao.'} Baixa da estrutura ${item.codigo}. Item final ${itemFinal.codigo} separado na Expedicao.`.slice(0, 255)
                : `${data.observacao || 'Saida da Expedicao.'} Saida do item ${item.codigo}.`.slice(0, 255),
              solicitacao_ref: solicitacaoRef,
              id_peca_solicitada: idPeca,
              forma_atendimento: item.classificacao === 'SUBMONTAGEM' ? 'COMPONENTE_SUBMONTAGEM' : 'PRONTO',
              id_estoque_origem: expedicao.id
            });
          }

          const quantidadeRestante = this.normalizePlannedQuantity(
            quantidadeNecessaria - quantidadeDaExpedicao
          );

          const disponibilidadeMontagem = await this.getAvailableQuantity(
            connection,
            montagem.id,
            itemFinal.id_peca,
            reservasPorItem,
            { lock: usarBloqueio }
          );

          const quantidadeDaMontagem = this.normalizePlannedQuantity(
            Math.min(
              quantidadeRestante,
              Math.max(0, disponibilidadeMontagem.quantidadeDisponivel)
            )
          );

          if (quantidadeDaMontagem > 0) {
            this.addReservedQuantity(
              reservasPorItem,
              itemFinal.id_peca,
              quantidadeDaMontagem,
              montagem.id
            );
            movimentosPlanejados.push({
              id_peca: itemFinal.id_peca,
              quantidade: quantidadeDaMontagem,
              observacao: item.classificacao === 'SUBMONTAGEM'
                ? `${data.observacao || 'Saida da Expedicao.'} Baixa da estrutura ${item.codigo}. Item final ${itemFinal.codigo} complementado pela Montagem.`.slice(0, 255)
                : `${data.observacao || 'Saida da Expedicao.'} Complemento via Montagem do item ${item.codigo}.`.slice(0, 255),
              solicitacao_ref: solicitacaoRef,
              id_peca_solicitada: idPeca,
              forma_atendimento: item.classificacao === 'SUBMONTAGEM' ? 'COMPONENTE_SUBMONTAGEM' : 'PRONTO',
              id_estoque_origem: montagem.id
            });
          }

          const quantidadeFaltante = this.normalizePlannedQuantity(
            quantidadeNecessaria - quantidadeDaExpedicao - quantidadeDaMontagem
          );

          const diagnosticoDetalhe = this.buildDiagnosticoSaidaDetalhe(
            itemFinal,
            quantidadeNecessaria,
            disponibilidadeExpedicao.quantidadeDisponivel,
            disponibilidadeMontagem.quantidadeDisponivel
          );

          itensDiagnostico.push(diagnosticoDetalhe);

          if (quantidadeFaltante > 0) {
            faltas.push(diagnosticoDetalhe);
          }
        }

        if (faltas.length) {
          throw this.createSaidaFaltaError(item, faltas, itensDiagnostico);
        }
      }

      if (simular) {
        await connection.rollback();
        return {
          pode_baixar: true,
          estoque_origem: expedicao,
          estoque_complementar: montagem,
          solicitacoes,
          movimentos: movimentosPlanejados
        };
      }

      const resultados = [];
      const reservasOrdenadas = [...reservasPorItem.entries()]
        .map(([reservaKey, quantidade]) => {
          const reserva = typeof reservaKey === 'string'
            ? this.parseReservaKey(reservaKey)
            : { id_estoque: expedicao.id, id_peca: Number(reservaKey) };

          return {
            id_estoque: Number(reserva.id_estoque),
            id_peca: Number(reserva.id_peca),
            quantidade: this.normalizePlannedQuantity(quantidade)
          };
        })
        .sort((a, b) => (
          Number(a.id_estoque) - Number(b.id_estoque)
          || Number(a.id_peca) - Number(b.id_peca)
        ));

      for (const reserva of reservasOrdenadas) {
        const idPeca = Number(reserva.id_peca);
        const idEstoqueOrigem = Number(reserva.id_estoque);
        const quantidade = this.normalizePlannedQuantity(reserva.quantidade);
        const item = await this.findItemByIdCached(connection, idPeca, itemCache);
        const estoqueOrigem = await this.findStockById(idEstoqueOrigem, connection);

        if (!item) {
          throw this.createBusinessError('Um dos itens informados nao foi encontrado para a saida.');
        }

        const saldoOrigem = await this.findSaldoForUpdate(connection, idEstoqueOrigem, idPeca);
        const quantidadeAtual = saldoOrigem ? Number(saldoOrigem.quantidade) : 0;

        if (quantidade > quantidadeAtual) {
          throw this.createBusinessError(
            `Saldo insuficiente em ${estoqueOrigem ? estoqueOrigem.nome : 'estoque de origem'} para ${item.codigo}.`
          );
        }

        const novoSaldo = Number((quantidadeAtual - quantidade).toFixed(2));
        await this.persistSaldo(connection, idEstoqueOrigem, idPeca, novoSaldo, saldoOrigem);

        resultados.push({
          id_peca: idPeca,
          codigo: item.codigo,
          descricao: item.descricao,
          id_estoque_origem: idEstoqueOrigem,
          estoque_origem_nome: estoqueOrigem ? estoqueOrigem.nome : '-',
          quantidade_baixada: quantidade,
          saldo_restante: novoSaldo
        });
      }

      for (const movimento of movimentosPlanejados) {
        const idMovimentacao = await this.createMovimentacao(connection, {
          id_peca: movimento.id_peca,
          id_estoque_origem: movimento.id_estoque_origem || expedicao.id,
          id_estoque_destino: null,
          tipo_movimentacao: 'SAIDA',
          quantidade: movimento.quantidade,
          observacao: movimento.observacao,
          usuario: data.usuario
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
        estoque_complementar: montagem,
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

  static async diagnosticarSaidaLote(data) {
    try {
      const result = await this.processSaidaLote({
        ...data,
        simular: true
      });

      return {
        pode_baixar: true,
        details: null,
        resultado: result
      };
    } catch (error) {
      if (error.statusCode && error.details?.tipo === 'FALTA_ESTOQUE_VENDA') {
        return {
          pode_baixar: false,
          message: error.message,
          details: error.details
        };
      }

      throw error;
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
          observacao: observacaoMovimento,
          usuario: data.usuario
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
EstoqueModel.MONTAGEM_NOME = 'Montagem';
EstoqueModel.ALMOXARIFADO_NOME = 'Almoxarifado';

module.exports = EstoqueModel;
