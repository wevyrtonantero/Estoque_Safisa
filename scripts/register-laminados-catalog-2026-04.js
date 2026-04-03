const mysql = require('mysql2/promise');
const { createConnectionConfig } = require('../database/config');

const connectionConfig = createConnectionConfig();

const RECORDS = [
  {
    codigo: 'AL-01',
    liga: 'Alumínio 2011 T6',
    nome: 'Barra alumínio red. 1.1/4"',
    material: 'Barra alumínio 2011 T6 redonda',
    geometria: 'REDONDO',
    bitola: '1.1/4"',
    usarMm: false,
    bitolaMm: 31.75,
    comprimentoM: 3,
    pesoPorMetro: 2.145,
    supplierName: 'Aluminum'
  },
  {
    codigo: 'AL-03',
    liga: 'Alumínio 2011 T6',
    nome: 'Barra alumínio red. 1"',
    material: 'Barra alumínio 2011 T6 redonda',
    geometria: 'REDONDO',
    bitola: '1"',
    usarMm: false,
    bitolaMm: 25.4,
    comprimentoM: 3,
    pesoPorMetro: 1.372,
    supplierName: 'Aluminum'
  },
  {
    codigo: 'AL-05',
    liga: 'Alumínio 2011 T6',
    nome: 'Barra alumínio quad. 1.1/2"',
    material: 'Barra alumínio 2011 T6 quadrada',
    geometria: 'QUADRADO',
    bitola: '1.1/2"',
    usarMm: false,
    bitolaMm: 38.1,
    comprimentoM: 3,
    pesoPorMetro: 3.934,
    supplierName: 'Aluminum'
  },
  {
    codigo: 'AL-07',
    liga: 'Alumínio 2011 T6',
    nome: 'Barra alumínio sext. 1.1/4"',
    material: 'Barra alumínio 2011 T6 sextavada',
    geometria: 'SEXTAVADO',
    bitola: '1.1/4"',
    usarMm: false,
    bitolaMm: 31.75,
    comprimentoM: 3,
    pesoPorMetro: 2.366,
    supplierName: 'Aluminum'
  },
  {
    codigo: 'AL-08',
    liga: 'Alumínio 2011 T6',
    nome: 'Barra alumínio red. 1.3/8"',
    material: 'Barra alumínio 2011 T6 redonda',
    geometria: 'REDONDO',
    bitola: '1.3/8"',
    usarMm: false,
    bitolaMm: 34.92,
    comprimentoM: 3,
    pesoPorMetro: 2.6,
    supplierName: 'Aluminum'
  },
  {
    codigo: 'IN-01',
    liga: 'Inox 304L',
    nome: 'Barra aço inox 304L 7/16"',
    material: 'Barra inox redonda 304L',
    geometria: 'REDONDO',
    bitola: '7/16"',
    usarMm: false,
    bitolaMm: 11.11,
    comprimentoM: 3,
    pesoPorMetro: 0.76,
    supplierName: 'JATINOX'
  },
  {
    codigo: 'IN-06',
    liga: 'Inox 304L',
    nome: 'Bobina de aço inox 304L',
    material: 'Fita inox 1,2 mm esp. x 15 mm larg.',
    geometria: 'FITA / BOBINA',
    bitola: null,
    usarMm: true,
    bitolaMm: 15,
    comprimentoM: null,
    pesoPorMetro: 0.135,
    supplierName: 'Aperam'
  },
  {
    codigo: 'AÇ-01',
    liga: 'Chumbaloi',
    nome: 'Barra aço red. chumbaloi 1/2"',
    material: 'Barra aço redonda chumbaloi',
    geometria: 'REDONDO',
    bitola: '1/2"',
    usarMm: false,
    bitolaMm: 12.7,
    comprimentoM: 3,
    pesoPorMetro: 0.99,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-03',
    liga: 'Chumbaloi',
    nome: 'Barra aço red. chumbaloi 11 mm',
    material: 'Barra aço redonda chumbaloi',
    geometria: 'REDONDO',
    bitola: null,
    usarMm: true,
    bitolaMm: 11,
    comprimentoM: 3,
    pesoPorMetro: 0.76,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-04',
    liga: '9SMN36',
    nome: 'Barra aço red. 1.5/8"',
    material: 'Barra aço redonda 9SMN36',
    geometria: 'REDONDO',
    bitola: '1.5/8"',
    usarMm: false,
    bitolaMm: 41.28,
    comprimentoM: 3,
    pesoPorMetro: 10.49,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-06',
    liga: '9SNM36',
    nome: 'Barra aço red. 1.1/4"',
    material: 'Barra aço redonda 9SNM36',
    geometria: 'REDONDO',
    bitola: '1.1/4"',
    usarMm: false,
    bitolaMm: 31.75,
    comprimentoM: 3,
    pesoPorMetro: 6.21,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-13',
    liga: 'Chumbaloi',
    nome: 'Barra aço red. chumbaloi 9/16"',
    material: 'Barra aço redonda chumbaloi',
    geometria: 'REDONDO',
    bitola: '9/16"',
    usarMm: false,
    bitolaMm: 14.29,
    comprimentoM: 3,
    pesoPorMetro: 1.26,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-15',
    liga: 'Chumbaloi',
    nome: 'Barra aço red. chumbaloi 10 mm',
    material: 'Barra aço redonda chumbaloi',
    geometria: 'REDONDO',
    bitola: null,
    usarMm: true,
    bitolaMm: 10,
    comprimentoM: 3,
    pesoPorMetro: 0.56,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-18',
    liga: '9SMN36',
    nome: 'Barra aço red. 1.3/8"',
    material: 'Barra aço redonda 9SMN36',
    geometria: 'REDONDO',
    bitola: '1.3/8"',
    usarMm: false,
    bitolaMm: 35.2,
    comprimentoM: 3,
    pesoPorMetro: 7.51,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-32',
    liga: 'Chumbaloi',
    nome: 'Barra aço red. chumbaloi 8 mm',
    material: 'Barra aço redonda chumbaloi',
    geometria: 'REDONDO',
    bitola: '5/16"',
    usarMm: true,
    bitolaMm: 8,
    comprimentoM: 3,
    pesoPorMetro: 0.39,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-19',
    liga: 'Chumbaloi',
    nome: 'Barra aço red. chumbaloi 6 mm',
    material: 'Barra aço redonda chumbaloi',
    geometria: 'REDONDO',
    bitola: '1/4"',
    usarMm: true,
    bitolaMm: 6,
    comprimentoM: 3,
    pesoPorMetro: 0.25,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-21',
    liga: 'Chumbaloi',
    nome: 'Barra aço red. chumbaloi 12 mm',
    material: 'Barra aço redonda chumbaloi',
    geometria: 'REDONDO',
    bitola: null,
    usarMm: true,
    bitolaMm: 12,
    comprimentoM: 3,
    pesoPorMetro: 0.99,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-30',
    liga: 'Chumbaloi',
    nome: 'Barra aço red. chumbaloi 7/8"',
    material: 'Barra aço redonda chumbaloi',
    geometria: 'REDONDO',
    bitola: '7/8"',
    usarMm: false,
    bitolaMm: 22.22,
    comprimentoM: 3,
    pesoPorMetro: 3.04,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-07',
    liga: 'Chumbaloi',
    nome: 'Barra aço sext. chumbaloi 17 mm',
    material: 'Barra aço sextavada chumbaloi',
    geometria: 'SEXTAVADO',
    bitola: null,
    usarMm: true,
    bitolaMm: 17,
    comprimentoM: 3,
    pesoPorMetro: 2.07,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-08',
    liga: 'Chumbaloi',
    nome: 'Barra aço sext. chumbaloi 19 mm',
    material: 'Barra aço sextavada chumbaloi',
    geometria: 'SEXTAVADO',
    bitola: null,
    usarMm: true,
    bitolaMm: 19,
    comprimentoM: 3,
    pesoPorMetro: 2.5,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-09',
    liga: '9SMN36',
    nome: 'Barra aço sext. 1"',
    material: 'Barra aço sextavada 9SMN36',
    geometria: 'SEXTAVADO',
    bitola: '1"',
    usarMm: false,
    bitolaMm: 25.4,
    comprimentoM: 3,
    pesoPorMetro: 4.38,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-10',
    liga: 'Chumbaloi',
    nome: 'Barra aço sext. chumbaloi 1.1/8"',
    material: 'Barra aço sextavada chumbaloi',
    geometria: 'SEXTAVADO',
    bitola: '1.1/8"',
    usarMm: false,
    bitolaMm: 28.57,
    comprimentoM: 3,
    pesoPorMetro: 5.55,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-12',
    liga: '9SMN36',
    nome: 'Barra aço sext. 7/8"',
    material: 'Barra aço sextavada 9SMN36',
    geometria: 'SEXTAVADO',
    bitola: '7/8"',
    usarMm: false,
    bitolaMm: 22.22,
    comprimentoM: 3,
    pesoPorMetro: 3.35,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-29',
    liga: '9SNM36',
    nome: 'Barra aço sext. 9/16"',
    material: 'Barra aço sextavada 9SNM36',
    geometria: 'SEXTAVADO',
    bitola: '9/16"',
    usarMm: false,
    bitolaMm: 14.29,
    comprimentoM: 3,
    pesoPorMetro: 1.39,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-40',
    liga: 'A confirmar',
    nome: 'Barra aço sext. 1/2"',
    material: 'Barra aço sextavada',
    geometria: 'SEXTAVADO',
    bitola: '1/2"',
    usarMm: false,
    bitolaMm: 12.7,
    comprimentoM: 3,
    pesoPorMetro: 1.3,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-41',
    liga: 'Aço 1020',
    nome: 'Barra aço 1020 red. 17 mm',
    material: 'Barra aço redonda 1020',
    geometria: 'REDONDO',
    bitola: null,
    usarMm: true,
    bitolaMm: 17,
    comprimentoM: 3,
    pesoPorMetro: 1.7,
    supplierName: 'Açovisa'
  },
  {
    codigo: 'AÇ-42',
    liga: 'Aço 1020',
    nome: 'Barra aço 1020 sext. 3/4"',
    material: 'Barra aço sextavada 1020',
    geometria: 'SEXTAVADO',
    bitola: '3/4"',
    usarMm: false,
    bitolaMm: 19,
    comprimentoM: 3,
    pesoPorMetro: 2.46,
    supplierName: 'Açovisa'
  }
];

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function buildObservation(record) {
  const parts = [
    'Importado da tabela enviada em 2026-04-02.',
    `Usar mm: ${record.usarMm ? 'SIM' : 'NAO'}`
  ];

  if (record.usarMm && record.bitola) {
    parts.push(`Bitola pol. informativa: ${record.bitola}`);
  }

  if (!Number.isFinite(record.comprimentoM)) {
    parts.push('Comprimento padrao nao informado.');
  }

  return parts.join(' | ');
}

async function loadSupplierMap(connection) {
  const [rows] = await connection.query('SELECT id, nome FROM fornecedores ORDER BY id ASC');
  const map = new Map();

  rows.forEach((row) => {
    map.set(normalizeKey(row.nome), { id: row.id, nome: row.nome });
  });

  return map;
}

async function upsertMateriaPrima(connection, supplierMap, record) {
  const supplier = supplierMap.get(normalizeKey(record.supplierName));
  if (!supplier) {
    throw new Error(`Fornecedor nao encontrado para ${record.codigo}: ${record.supplierName}`);
  }

  const comprimentoPadraoMm = Number.isFinite(record.comprimentoM)
    ? Number((record.comprimentoM * 1000).toFixed(2))
    : null;

  const values = [
    record.codigo,
    record.nome,
    'LAMINADO',
    record.material,
    record.liga,
    record.geometria,
    record.bitola,
    record.bitolaMm,
    comprimentoPadraoMm,
    record.pesoPorMetro,
    null,
    null,
    0,
    'KG',
    supplier.id,
    buildObservation(record)
  ];

  const [existing] = await connection.query(
    'SELECT id FROM materias_primas WHERE codigo = ? LIMIT 1',
    [record.codigo]
  );

  let materiaPrimaId = null;
  let action = 'created';

  if (existing.length > 0) {
    materiaPrimaId = existing[0].id;
    action = 'updated';

    await connection.query(
      `
        UPDATE materias_primas
        SET
          codigo = ?,
          nome = ?,
          categoria = ?,
          material = ?,
          liga = ?,
          geometria = ?,
          bitola = ?,
          bitola_mm = ?,
          comprimento_padrao_mm = ?,
          peso_por_metro = ?,
          peso_unitario_kg = ?,
          densidade_g_cm3 = ?,
          estoque_minimo = ?,
          unidade_estoque = ?,
          id_fornecedor_principal = ?,
          observacao = ?
        WHERE id = ?
      `,
      [...values, materiaPrimaId]
    );
  } else {
    const [result] = await connection.query(
      `
        INSERT INTO materias_primas (
          codigo,
          nome,
          categoria,
          material,
          liga,
          geometria,
          bitola,
          bitola_mm,
          comprimento_padrao_mm,
          peso_por_metro,
          peso_unitario_kg,
          densidade_g_cm3,
          estoque_minimo,
          unidade_estoque,
          id_fornecedor_principal,
          observacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values
    );

    materiaPrimaId = result.insertId;
  }

  await connection.query(
    `
      INSERT INTO materia_prima_fornecedor (
        id_materia_prima,
        id_fornecedor,
        observacao
      ) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        observacao = VALUES(observacao)
    `,
    [
      materiaPrimaId,
      supplier.id,
      'Fornecedor principal inferido no cadastro em lote.'
    ]
  );

  return {
    codigo: record.codigo,
    fornecedor: supplier.nome,
    action
  };
}

async function main() {
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await connection.beginTransaction();

    const supplierMap = await loadSupplierMap(connection);
    const summary = [];

    for (const record of RECORDS) {
      const result = await upsertMateriaPrima(connection, supplierMap, record);
      summary.push(result);
    }

    await connection.commit();

    console.log('Materias-primas processadas:');
    console.table(summary);
  } catch (error) {
    await connection.rollback();
    console.error('Falha ao cadastrar materias-primas laminadas.');
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
