const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { createConnectionConfig } = require('../database/config');

const connectionConfig = createConnectionConfig();

const EXPORT_PATH = path.join(__dirname, '..', 'exports', 'import-pecas-csv-2026-04-02-summary.json');

const STOCKS = {
  COMPONENTES: 1,
  ELABORACAO: 2
};

const OBSERVATION_PREFIX = 'Sincronizacao pela tabela_pecas_safisa_completa.csv em 2026-04-02.';

const REPLACEABLE_MATERIAL_CODES = new Set([
  'ALQ38',
  'CHY1235'
]);

const MATERIAL_CODE_BY_KEY = {
  'ACO 1/2 SW': 'A\u00c7-40',
  'ACO 1020 RED. 17 MM': 'A\u00c7-41',
  'ACO 9SMN36 RED. 1.3/8': 'A\u00c7-18',
  'ACO 9SMN36 RED. 1.5/8': 'A\u00c7-04',
  'ACO 9SMN36 SW 1': 'A\u00c7-09',
  'ACO 9SMN36 SW 7/8': 'A\u00c7-12',
  'ACO 9SNM36 RED. 1.1/4': 'A\u00c7-06',
  'ACO 9SNM36 SW 9/16': 'A\u00c7-29',
  'ACO CHUMB. 1.1/8 SW': 'A\u00c7-10',
  'ACO CHUMBALOI 19 MM SW': 'A\u00c7-08',
  'ACO CHUMBALOI RED. 1/2': 'A\u00c7-01',
  'ACO CHUMBALOI RED. 10 MM': 'A\u00c7-15',
  'ACO CHUMBALOI RED. 11 MM': 'A\u00c7-03',
  'ACO CHUMBALOI RED. 12 MM': 'A\u00c7-21',
  'ACO CHUMBALOI RED. 6 MM / 1/4': 'A\u00c7-19',
  'ACO CHUMBALOI RED. 9/16': 'A\u00c7-13',
  'ACO CHUMBALOI SW 17 MM': 'A\u00c7-07',
  'ALUMINIO O 1': 'AL-03',
  'ALUMINIO O 1.3/8': 'AL-08',
  'ALUMINIO QUADRADO 1.1/2': 'AL-05',
  'ALUMINIO SW 1.1/4': 'AL-07',
  'INOX EM TIRA / FITA': 'IN-06',
  'INOX REDONDO 7/16': 'IN-01'
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1;
      }

      row.push(field);
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      field = '';
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/\u00d8/g, 'O')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeCode(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function parseDecimal(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim().replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  const parsed = parseDecimal(value);
  if (parsed === null) {
    return null;
  }

  return Math.round(parsed);
}

function mapPieceType(value) {
  return normalizeText(value) === 'COMPRADA' ? 'COMPRADA' : 'PRODUZIDA';
}

function buildRowsFromCsv(csvPath) {
  const rawText = fs.readFileSync(csvPath, 'utf8');
  const parsedRows = parseCsv(rawText);

  return parsedRows.slice(1).map((columns) => ({
    codigo: String(columns[0] || '').trim(),
    descricao: String(columns[1] || '').trim(),
    comprimento_mm: parseDecimal(columns[2]),
    tipo: mapPieceType(columns[3]),
    materia_prima_texto: String(columns[4] || '').trim(),
    quantidade_pacote: parseInteger(columns[5]),
    quantidade_saida_mes: parseDecimal(columns[6]),
    estoque_componentes: parseDecimal(columns[7]) || 0,
    estoque_elaboracao: parseDecimal(columns[8]) || 0,
    estoque_total: parseDecimal(columns[9]) || 0,
    estoque_critico: parseInteger(columns[10]),
    status: String(columns[11] || '').trim(),
    fonte_comprimento_saida: String(columns[12] || '').trim(),
    fonte_qtd_pacote: String(columns[13] || '').trim(),
    fonte_estoque: String(columns[14] || '').trim()
  }));
}

function resolveCsvPath() {
  const cliPath = String(process.argv[2] || '').trim();
  const envPath = String(process.env.SAFISA_PECAS_CSV || '').trim();
  const candidate = cliPath || envPath;

  if (!candidate) {
    throw new Error(
      'Informe o caminho do CSV no primeiro argumento ou na variavel SAFISA_PECAS_CSV.'
    );
  }

  return path.resolve(candidate);
}

function resolveStockTargets(row) {
  let componentes = Number(row.estoque_componentes || 0);
  let elaboracao = Number(row.estoque_elaboracao || 0);
  const total = Number(row.estoque_total || 0);
  const source = normalizeText(row.fonte_estoque);

  if (componentes === 0 && elaboracao === 0 && total > 0) {
    if (source === 'COMPONENTES') {
      componentes = total;
    } else if (source === 'PRODUTOS EM ELABORACAO') {
      elaboracao = total;
    }
  }

  return {
    componentes: Number(componentes.toFixed(2)),
    elaboracao: Number(elaboracao.toFixed(2))
  };
}

function buildMaterialLookup(materialRows) {
  const byCode = new Map();

  materialRows.forEach((row) => {
    byCode.set(String(row.codigo), row);
  });

  return {
    byCode,
    byId: new Map(materialRows.map((row) => [Number(row.id), row]))
  };
}

function resolveTargetMaterialCode(materialText) {
  if (!materialText) {
    return null;
  }

  const normalizedKey = normalizeText(materialText);
  return MATERIAL_CODE_BY_KEY[normalizedKey] || null;
}

function chooseMaterialId(existingPiece, targetMaterialCode, materialLookup, summary, row) {
  const existingMaterialCode = existingPiece && existingPiece.materia_prima_codigo
    ? String(existingPiece.materia_prima_codigo)
    : null;

  if (!targetMaterialCode) {
    summary.unmapped_materials.push({
      codigo: row.codigo,
      descricao: row.descricao,
      materia_prima_texto: row.materia_prima_texto
    });
    return existingPiece ? existingPiece.id_materia_prima : null;
  }

  const targetMaterial = materialLookup.byCode.get(targetMaterialCode);
  if (!targetMaterial) {
    summary.missing_material_records.push({
      codigo: row.codigo,
      descricao: row.descricao,
      materia_prima_texto: row.materia_prima_texto,
      materia_prima_codigo_esperado: targetMaterialCode
    });
    return existingPiece ? existingPiece.id_materia_prima : null;
  }

  if (existingMaterialCode) {
    const normalizedExisting = existingMaterialCode.toUpperCase();
    if (normalizedExisting === targetMaterialCode.toUpperCase()) {
      return Number(targetMaterial.id);
    }

    if (normalizedExisting.endsWith('FD')) {
      summary.preserved_material_links.push({
        codigo: row.codigo,
        descricao: row.descricao,
        materia_prima_atual: existingMaterialCode,
        materia_prima_csv: targetMaterialCode,
        motivo: 'Vinculo fundido preservado.'
      });
      return existingPiece.id_materia_prima;
    }

    if (!REPLACEABLE_MATERIAL_CODES.has(normalizedExisting)) {
      summary.preserved_material_links.push({
        codigo: row.codigo,
        descricao: row.descricao,
        materia_prima_atual: existingMaterialCode,
        materia_prima_csv: targetMaterialCode,
        motivo: 'Vinculo atual preservado.'
      });
      return existingPiece.id_materia_prima;
    }
  }

  return Number(targetMaterial.id);
}

async function loadExistingData(connection) {
  const [itemRows] = await connection.query(
    `
      SELECT
        p.id,
        p.codigo,
        p.descricao,
        p.comprimento_mm,
        p.tipo,
        p.classificacao,
        p.id_materia_prima,
        p.id_fornecedor,
        p.id_maquina,
        p.estoque_minimo,
        p.estoque_seguranca,
        p.consumo_mensal,
        p.massa_kg,
        mp.codigo AS materia_prima_codigo
      FROM pecas p
      LEFT JOIN materias_primas mp ON mp.id = p.id_materia_prima
      WHERE p.classificacao = 'ITEM'
    `
  );

  const [allPieceRows] = await connection.query(
    `
      SELECT
        id,
        codigo,
        classificacao
      FROM pecas
    `
  );

  const [materialRows] = await connection.query(
    `
      SELECT
        id,
        codigo,
        nome
      FROM materias_primas
    `
  );

  const itemIndex = new Map(itemRows.map((row) => [normalizeCode(row.codigo), row]));
  const allPieceIndex = new Map(allPieceRows.map((row) => [normalizeCode(row.codigo), row]));

  return {
    itemIndex,
    allPieceIndex,
    materialLookup: buildMaterialLookup(materialRows)
  };
}

async function findSaldoForUpdate(connection, stockId, pieceId) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        quantidade
      FROM estoque_saldos
      WHERE id_estoque = ? AND id_peca = ?
      FOR UPDATE
    `,
    [stockId, pieceId]
  );

  return rows[0] || null;
}

async function persistSaldo(connection, stockId, pieceId, newQuantity, currentSaldo) {
  if (currentSaldo && Number(newQuantity) === 0) {
    await connection.query(
      `
        DELETE FROM estoque_saldos
        WHERE id = ?
      `,
      [currentSaldo.id]
    );
    return;
  }

  if (currentSaldo) {
    await connection.query(
      `
        UPDATE estoque_saldos
        SET quantidade = ?
        WHERE id = ?
      `,
      [newQuantity, currentSaldo.id]
    );
    return;
  }

  if (Number(newQuantity) > 0) {
    await connection.query(
      `
        INSERT INTO estoque_saldos (
          id_estoque,
          id_peca,
          quantidade
        ) VALUES (?, ?, ?)
      `,
      [stockId, pieceId, newQuantity]
    );
  }
}

async function createStockAdjustment(connection, pieceId, stockId, oldQuantity, newQuantity, note) {
  const difference = Number((newQuantity - oldQuantity).toFixed(2));
  if (difference === 0) {
    return false;
  }

  await connection.query(
    `
      INSERT INTO estoque_movimentacoes (
        id_peca,
        id_estoque_origem,
        id_estoque_destino,
        tipo_movimentacao,
        quantidade,
        observacao
      ) VALUES (?, ?, ?, 'AJUSTE', ?, ?)
    `,
    [
      pieceId,
      difference < 0 ? stockId : null,
      difference > 0 ? stockId : null,
      Math.abs(difference),
      note.slice(0, 255)
    ]
  );

  return true;
}

async function applyStockTarget(connection, piece, stockId, targetQuantity, stockLabel, summary) {
  const saldoAtual = await findSaldoForUpdate(connection, stockId, piece.id);
  const currentQuantity = saldoAtual ? Number(saldoAtual.quantidade) : 0;
  const normalizedTarget = Number(Number(targetQuantity || 0).toFixed(2));

  if (currentQuantity === normalizedTarget) {
    return;
  }

  await persistSaldo(connection, stockId, piece.id, normalizedTarget, saldoAtual);
  await createStockAdjustment(
    connection,
    piece.id,
    stockId,
    currentQuantity,
    normalizedTarget,
    `${OBSERVATION_PREFIX} Estoque ${stockLabel}.`
  );

  summary.stock_adjustments.push({
    codigo: piece.codigo,
    estoque: stockLabel,
    saldo_anterior: currentQuantity,
    saldo_atual: normalizedTarget
  });
}

async function createPiece(connection, row, materialId) {
  const [result] = await connection.query(
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
      ) VALUES (?, ?, ?, ?, 'ITEM', ?, NULL, NULL, ?, ?, ?, NULL)
    `,
    [
      row.codigo,
      row.descricao,
      row.comprimento_mm,
      row.tipo,
      materialId,
      row.quantidade_pacote,
      row.estoque_critico,
      row.quantidade_saida_mes
    ]
  );

  return Number(result.insertId);
}

async function updatePiece(connection, pieceId, payload) {
  await connection.query(
    `
      UPDATE pecas
      SET
        descricao = ?,
        comprimento_mm = ?,
        tipo = ?,
        id_materia_prima = ?,
        estoque_minimo = ?,
        estoque_seguranca = ?,
        consumo_mensal = ?
      WHERE id = ?
    `,
    [
      payload.descricao,
      payload.comprimento_mm,
      payload.tipo,
      payload.id_materia_prima,
      payload.estoque_minimo,
      payload.estoque_seguranca,
      payload.consumo_mensal,
      pieceId
    ]
  );
}

function buildPiecePayload(existingPiece, row, materialId) {
  return {
    descricao: row.descricao || existingPiece.descricao,
    comprimento_mm: row.comprimento_mm !== null ? row.comprimento_mm : existingPiece.comprimento_mm,
    tipo: row.tipo || existingPiece.tipo,
    id_materia_prima: materialId,
    estoque_minimo: row.quantidade_pacote !== null ? row.quantidade_pacote : existingPiece.estoque_minimo,
    estoque_seguranca: row.estoque_critico !== null ? row.estoque_critico : existingPiece.estoque_seguranca,
    consumo_mensal: row.quantidade_saida_mes !== null ? row.quantidade_saida_mes : existingPiece.consumo_mensal
  };
}

function summarizePieceChange(existingPiece, payload) {
  const changes = [];
  const pairs = [
    ['descricao', existingPiece.descricao, payload.descricao],
    ['comprimento_mm', existingPiece.comprimento_mm, payload.comprimento_mm],
    ['tipo', existingPiece.tipo, payload.tipo],
    ['id_materia_prima', existingPiece.id_materia_prima, payload.id_materia_prima],
    ['estoque_minimo', existingPiece.estoque_minimo, payload.estoque_minimo],
    ['estoque_seguranca', existingPiece.estoque_seguranca, payload.estoque_seguranca],
    ['consumo_mensal', existingPiece.consumo_mensal, payload.consumo_mensal]
  ];

  pairs.forEach(([field, beforeValue, afterValue]) => {
    const beforeNormalized = beforeValue === null || beforeValue === undefined ? null : String(beforeValue);
    const afterNormalized = afterValue === null || afterValue === undefined ? null : String(afterValue);
    if (beforeNormalized !== afterNormalized) {
      changes.push({
        field,
        before: beforeValue,
        after: afterValue
      });
    }
  });

  return changes;
}

async function main() {
  const csvPath = resolveCsvPath();
  const rows = buildRowsFromCsv(csvPath);
  const connection = await mysql.createConnection(connectionConfig);
  const summary = {
    processed_rows: rows.length,
    created_pieces: [],
    updated_pieces: [],
    skipped_existing_piece_conflicts: [],
    stock_adjustments: [],
    preserved_material_links: [],
    unmapped_materials: [],
    missing_material_records: []
  };

  try {
    await connection.beginTransaction();

    const existingData = await loadExistingData(connection);

    for (const row of rows) {
      const normalizedCode = normalizeCode(row.codigo);
      const existingItem = existingData.itemIndex.get(normalizedCode) || null;
      const conflictingPiece = !existingItem ? existingData.allPieceIndex.get(normalizedCode) || null : null;

      if (conflictingPiece && conflictingPiece.classificacao !== 'ITEM') {
        summary.skipped_existing_piece_conflicts.push({
          codigo: row.codigo,
          descricao: row.descricao,
          classificacao_existente: conflictingPiece.classificacao
        });
        continue;
      }

      const targetMaterialCode = resolveTargetMaterialCode(row.materia_prima_texto);
      const targetMaterialId = chooseMaterialId(
        existingItem,
        targetMaterialCode,
        existingData.materialLookup,
        summary,
        row
      );

      let pieceRecord = existingItem;
      if (pieceRecord) {
        const payload = buildPiecePayload(pieceRecord, row, targetMaterialId);
        const changes = summarizePieceChange(pieceRecord, payload);
        if (changes.length > 0) {
          await updatePiece(connection, pieceRecord.id, payload);
          summary.updated_pieces.push({
            codigo_csv: row.codigo,
            codigo_sistema: pieceRecord.codigo,
            changes
          });
          pieceRecord = {
            ...pieceRecord,
            ...payload
          };
          existingData.itemIndex.set(normalizedCode, pieceRecord);
        }
      } else {
        const pieceId = await createPiece(connection, row, targetMaterialId);
        pieceRecord = {
          id: pieceId,
          codigo: row.codigo,
          descricao: row.descricao,
          comprimento_mm: row.comprimento_mm,
          tipo: row.tipo,
          classificacao: 'ITEM',
          id_materia_prima: targetMaterialId,
          materia_prima_codigo: targetMaterialCode,
          estoque_minimo: row.quantidade_pacote,
          estoque_seguranca: row.estoque_critico,
          consumo_mensal: row.quantidade_saida_mes
        };
        existingData.itemIndex.set(normalizedCode, pieceRecord);
        existingData.allPieceIndex.set(normalizedCode, {
          id: pieceId,
          codigo: row.codigo,
          classificacao: 'ITEM'
        });
        summary.created_pieces.push({
          codigo: row.codigo,
          descricao: row.descricao
        });
      }

      const stockTargets = resolveStockTargets(row);
      await applyStockTarget(connection, pieceRecord, STOCKS.COMPONENTES, stockTargets.componentes, 'Almoxarifado', summary);
      await applyStockTarget(connection, pieceRecord, STOCKS.ELABORACAO, stockTargets.elaboracao, 'Montagem', summary);
    }

    await connection.commit();

    fs.writeFileSync(EXPORT_PATH, JSON.stringify(summary, null, 2), 'utf8');

    console.log('Importacao concluida.');
    console.log(JSON.stringify({
      processed_rows: summary.processed_rows,
      created_pieces: summary.created_pieces.length,
      updated_pieces: summary.updated_pieces.length,
      stock_adjustments: summary.stock_adjustments.length,
      preserved_material_links: summary.preserved_material_links.length,
      unmapped_materials: summary.unmapped_materials.length,
      missing_material_records: summary.missing_material_records.length,
      skipped_existing_piece_conflicts: summary.skipped_existing_piece_conflicts.length,
      csv_path: csvPath,
      summary_file: EXPORT_PATH
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    console.error('Falha ao importar cadastro/estoque de pecas a partir do CSV.');
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
