const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');

const projectRoot = path.resolve(__dirname, '..');
const databaseDir = path.join(projectRoot, 'database');
const realPiecesFile = path.join(databaseDir, 'initial_real_pecas.txt');

const schemaFiles = [
  'schema_fornecedores.sql',
  'schema_maquinas.sql',
  'schema_materias_primas.sql',
  'schema_pecas.sql',
  'schema_estoques.sql',
  'schema_estoque_saldos.sql',
  'schema_estoque_movimentacoes.sql',
  'schema_estrutura_submontagem.sql',
  'schema_peca_fornecedor.sql',
  'schema_materia_prima_fornecedor.sql'
];

const suppliers = [
  {
    id: 1,
    nome: 'Oliver Plast',
    cep: '13253-120',
    endereco: 'Rua Lucia Piffer Baptistella, 195, Vila Rita',
    cidade: 'Itatiba - SP',
    observacao: 'Razao social: Oliver Plast Industria e Comercio de Plasticos Ltda | CNPJ 02.677.068/0001-35'
  },
  {
    id: 2,
    nome: 'Original Molas',
    cep: '13063-000',
    endereco: 'Rua Mario Junqueira da Silva, 1696, Jardim Eulina',
    cidade: 'Campinas - SP',
    observacao: 'Razao social: Original Industria de Molas e Pecas Ltda | CNPJ 72.000.128/0001-66'
  },
  {
    id: 3,
    nome: 'FF Calderaria Equipamentos',
    cep: '13253-120',
    endereco: 'Rua Lucia Piffer Baptistella, 320, Vila Rita',
    cidade: 'Itatiba - SP',
    observacao: 'Razao social: F F Caldeiraria Ltda | CNPJ 29.391.618/0001-01'
  },
  {
    id: 4,
    nome: 'Trevine Home Center',
    cep: '13256-010',
    endereco: 'Rua Luiz Scavone, 329, Vila Santa Clara',
    cidade: 'Itatiba - SP',
    observacao: 'Razao social: Trevine & Filhos Ltda | CNPJ 02.036.099/0001-07'
  },
  {
    id: 5,
    nome: 'Itatirol',
    cep: '13251-500',
    endereco: 'Avenida Prudente de Moraes, 781, Vila Santa Cruz',
    cidade: 'Itatiba - SP',
    observacao: 'Razao social: Itatirol Itatiba Rolamentos Ltda | CNPJ 03.411.788/0001-17'
  },
  {
    id: 6,
    nome: 'Fundicao Tiger',
    cep: '86140-000',
    endereco: 'Rodovia PR 445, Km 139,2',
    cidade: 'Primeiro de Maio - PR',
    observacao: 'Razao social: Fundicao Tiger Ltda | CNPJ 10.362.306/0001-41'
  },
  {
    id: 7,
    nome: 'Prestampas (Cajamar)',
    cep: null,
    endereco: 'Cajamar - SP',
    cidade: 'Cajamar - SP',
    observacao: 'Fornecedor informado pelo usuario para itens com descricao contendo TAMPA. CNPJ nao confirmado.'
  },
  {
    id: 8,
    nome: 'SAFISA',
    cep: null,
    endereco: null,
    cidade: 'Itatiba - SP',
    observacao: 'Fornecedor interno padrao para todas as pecas PRODUZIDA.'
  },
  {
    id: 9,
    nome: 'NOTE TESTE',
    cep: null,
    endereco: null,
    cidade: null,
    observacao: 'Fornecedor fallback para pecas sem fornecedor identificado pelas regras iniciais.'
  }
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function pickSupplierId(type, description) {
  if (String(type || '').trim().toUpperCase() === 'PRODUZIDA') {
    return 8;
  }

  const normalized = normalizeText(description);

  if (normalized.includes('MANGUEIRA DE OLEO') || normalized.includes('MANGUEIRA DE AR')) {
    return 1;
  }

  if (normalized.includes('ROLAMENTO')) {
    return 5;
  }

  if (normalized.includes('MOLA')) {
    return 2;
  }

  if (normalized.includes('SUPORTE')) {
    return 3;
  }

  if (normalized.includes('TAMPA')) {
    return 7;
  }

  if (normalized.includes('PARAF') || normalized.includes('PORCA') || normalized.includes('ARRUELA')) {
    return 4;
  }

  if (normalized.includes('CORPO') || normalized.includes('FUNDICAO') || normalized.includes('TIJO')) {
    return 6;
  }

  return 9;
}

function parseNullableNumber(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toUpperCase() === 'NULL') {
    return null;
  }

  return Number(trimmed);
}

function parseStockQuantity(value) {
  if (value === undefined || value === null) {
    return 0;
  }

  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toUpperCase() === 'NULL') {
    return 0;
  }

  const normalized = trimmed.replaceAll('.', '');
  const parsedValue = Number.parseInt(normalized, 10);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

async function runSqlFile(connection, fileName) {
  const sql = await fs.readFile(path.join(databaseDir, fileName), 'utf8');
  await connection.query(sql);
}

async function loadRealPieces() {
  const raw = await fs.readFile(realPiecesFile, 'utf8');
  const pieceRows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('codigo |'))
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      const [
        codigo,
        descricao,
        tipo,
        classificacao,
        comprimento_mm,
        ,
        ,
        ,
        estoque_minimo,
        estoque_seguranca,
        consumo_mensal,
        massa_kg,
        estoque
      ] = parts;

      return {
        codigo,
        descricao,
        tipo,
        classificacao,
        comprimento_mm: parseNullableNumber(comprimento_mm),
        estoque_minimo: parseNullableNumber(estoque_minimo),
        estoque_seguranca: parseNullableNumber(estoque_seguranca),
        consumo_mensal: parseNullableNumber(consumo_mensal),
        massa_kg: parseNullableNumber(massa_kg),
        estoque: parseStockQuantity(estoque),
        id_fornecedor: pickSupplierId(tipo, descricao),
        id_materia_prima: tipo === 'PRODUZIDA' ? 1 : null,
        id_maquina: tipo === 'PRODUZIDA' ? 1 : null
      };
    });

  const piecesByCode = new Map();
  const duplicateCounts = new Map();
  const orderedCodes = [];

  pieceRows.forEach((piece) => {
    if (piecesByCode.has(piece.codigo)) {
      duplicateCounts.set(piece.codigo, (duplicateCounts.get(piece.codigo) || 1) + 1);
      const existingIndex = orderedCodes.indexOf(piece.codigo);
      if (existingIndex >= 0) {
        orderedCodes.splice(existingIndex, 1);
      }
    }

    piecesByCode.set(piece.codigo, piece);
    orderedCodes.push(piece.codigo);
  });

  return {
    totalRows: pieceRows.length,
    pieces: orderedCodes.map((code) => piecesByCode.get(code)),
    duplicateCodes: Array.from(duplicateCounts.entries())
      .map(([codigo, ocorrencias]) => ({ codigo, ocorrencias }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  };
}

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'safisa',
    multipleStatements: true
  });

  try {
    await connection.query(
      `
        SET FOREIGN_KEY_CHECKS = 0;
        DROP TABLE IF EXISTS estoque_movimentacoes;
        DROP TABLE IF EXISTS estoque_saldos;
        DROP TABLE IF EXISTS estrutura_submontagem;
        DROP TABLE IF EXISTS peca_fornecedor;
        DROP TABLE IF EXISTS materia_prima_fornecedor;
        DROP TABLE IF EXISTS pecas;
        DROP TABLE IF EXISTS fornecedores;
        DROP TABLE IF EXISTS maquinas;
        DROP TABLE IF EXISTS materias_primas;
        DROP TABLE IF EXISTS estoques;
        SET FOREIGN_KEY_CHECKS = 1;
      `
    );

    for (const fileName of schemaFiles) {
      await runSqlFile(connection, fileName);
    }

    const {
      totalRows,
      pieces,
      duplicateCodes
    } = await loadRealPieces();

    await connection.beginTransaction();

    await connection.query(
      `
        INSERT INTO fornecedores (
          id,
          nome,
          telefone,
          contato,
          email,
          cep,
          endereco,
          cidade,
          observacao
        ) VALUES ?
      `,
      [
        suppliers.map((supplier) => [
          supplier.id,
          supplier.nome,
          null,
          null,
          null,
          supplier.cep,
          supplier.endereco,
          supplier.cidade,
          supplier.observacao
        ])
      ]
    );

    await connection.query(
      `
        INSERT INTO maquinas (
          id,
          nome,
          tipo
        ) VALUES (?, ?, ?)
      `,
      [1, 'CNC', 'USINAGEM']
    );

    await connection.query(
      `
        INSERT INTO materias_primas (
          id,
          codigo,
          nome,
          geometria,
          bitola,
          peso_por_metro,
          estoque_minimo
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [1, 'MP-GENERICA', 'MATERIA-PRIMA GENERICA', 'NA', 'NA', 0, 0]
    );

    await connection.query(
      `
        INSERT INTO pecas (
          codigo,
          descricao,
          comprimento_mm,
          tipo,
          classificacao,
          id_materia_prima,
          id_fornecedor,
          id_maquina,
          estoque_minimo,
          estoque_seguranca,
          consumo_mensal,
          massa_kg
        ) VALUES ?
      `,
      [
        pieces.map((piece) => [
          piece.codigo,
          piece.descricao,
          piece.comprimento_mm,
          piece.tipo,
          piece.classificacao,
          piece.id_materia_prima,
          piece.id_fornecedor,
          piece.id_maquina,
          piece.estoque_minimo,
          piece.estoque_seguranca,
          piece.consumo_mensal,
          piece.massa_kg
        ])
      ]
    );

    await connection.query(
      `
        INSERT INTO estoques (nome, descricao, ativo)
        VALUES
          ('Almoxarifado', 'Estoque principal de itens e submontagens.', 1),
          ('Montagem', 'Estoque intermediario utilizado na montagem.', 1),
          ('Expedição', 'Estoque final para separacao e expedicao.', 1)
        ON DUPLICATE KEY UPDATE
          descricao = VALUES(descricao),
          ativo = VALUES(ativo)
      `
    );

    const [stocks] = await connection.query(
      `
        SELECT id, nome
        FROM estoques
        WHERE nome IN ('Almoxarifado', 'Montagem', 'Expedição')
      `
    );

    const stockByName = Object.fromEntries(stocks.map((stock) => [stock.nome, stock.id]));
    const almoxarifadoId = stockByName.Almoxarifado;

    const [pieceRows] = await connection.query(
      `
        SELECT id, codigo
        FROM pecas
        WHERE classificacao = 'ITEM'
      `
    );

    const pieceIdByCode = new Map(pieceRows.map((piece) => [piece.codigo, piece.id]));
    const stockRows = pieces
      .filter((piece) => pieceIdByCode.has(piece.codigo))
      .map((piece) => [almoxarifadoId, pieceIdByCode.get(piece.codigo), piece.estoque]);

    await connection.query(
      `
        INSERT INTO estoque_saldos (
          id_estoque,
          id_peca,
          quantidade
        ) VALUES ?
      `,
      [stockRows]
    );

    await connection.query(
      `
        INSERT INTO estoque_movimentacoes (
          id_peca,
          id_estoque_origem,
          id_estoque_destino,
          tipo_movimentacao,
          quantidade,
          observacao
        ) VALUES ?
      `,
      [
        stockRows
          .filter((row) => Number(row[2]) > 0)
          .map((row) => [
          row[1],
          null,
          row[0],
          'ENTRADA_INICIAL',
          row[2],
          'Carga inicial real via script reset-real-initial-data.js'
          ])
      ]
    );

    await connection.commit();

    const [pieceSummary] = await connection.query(
      "SELECT classificacao, COUNT(*) AS total FROM pecas GROUP BY classificacao ORDER BY classificacao"
    );
    const [supplierSummary] = await connection.query('SELECT COUNT(*) AS total FROM fornecedores');
    const [machineSummary] = await connection.query('SELECT COUNT(*) AS total FROM maquinas');
    const [materialSummary] = await connection.query('SELECT COUNT(*) AS total FROM materias_primas');
    const [submontagemSummary] = await connection.query('SELECT COUNT(*) AS total FROM estrutura_submontagem');
    const [stockSummary] = await connection.query(
      `
        SELECT
          COUNT(*) AS total_saldos,
          COALESCE(SUM(quantidade), 0) AS total_quantidade
        FROM estoque_saldos
      `
    );

    console.log(JSON.stringify({
      linhas_arquivo: totalRows,
      pecas_unicas: pieces.length,
      codigos_duplicados: duplicateCodes,
      pecas: pieceSummary,
      fornecedores: supplierSummary[0].total,
      maquinas: machineSummary[0].total,
      materias_primas: materialSummary[0].total,
      estrutura_submontagem: submontagemSummary[0].total,
      estoque: stockSummary[0]
    }, null, 2));
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Ignore rollback errors after DDL or failed transactions.
    }

    console.error('Falha ao resetar a base inicial real:', error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
