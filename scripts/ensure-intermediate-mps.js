const { pool } = require('../database/connection');

const DEFAULT_SUPPLIER_ID = 8;
const DEFAULT_STOCK_MINIMUM_UNITS = 50;
const DEFAULT_CATEGORY = 'FUNDIDO';
const DEFAULT_GEOMETRY = 'FUNDIDO';
const DEFAULT_UNIT = 'UN';
const DEFAULT_LIGA = 'INTERMEDIARIA';

const TARGETS = [
  { pecaCodigo: '005', mpCodigo: 'MP005' },
  { pecaCodigo: '005/32', mpCodigo: 'MP005/32' },
  { pecaCodigo: '091', mpCodigo: 'MP091' },
  { pecaCodigo: '091/VF', mpCodigo: 'MP091/VF' }
];

async function findPeca(connection, codigo) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        codigo,
        descricao,
        massa_kg,
        id_fornecedor
      FROM pecas
      WHERE codigo = ?
      LIMIT 1
    `,
    [codigo]
  );

  return rows[0] || null;
}

async function upsertMateriaPrimaIntermediaria(connection, target) {
  const peca = await findPeca(connection, target.pecaCodigo);
  if (!peca) {
    throw new Error(`Peca ${target.pecaCodigo} nao encontrada.`);
  }

  const fornecedorId = Number(peca.id_fornecedor || DEFAULT_SUPPLIER_ID);
  const pesoUnitario = peca.massa_kg === null || peca.massa_kg === undefined
    ? null
    : Number(peca.massa_kg);
  const nomeMateriaPrima = `MATERIA PRIMA - ${String(peca.descricao || '').trim()}`;
  const observacao = `Cadastro automatico para receber retorno de terceirizacao da peca ${peca.codigo}.`;

  await connection.query(
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
      ) VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, NULL, ?, NULL, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nome = VALUES(nome),
        categoria = VALUES(categoria),
        material = VALUES(material),
        liga = VALUES(liga),
        geometria = VALUES(geometria),
        bitola = VALUES(bitola),
        bitola_mm = VALUES(bitola_mm),
        comprimento_padrao_mm = VALUES(comprimento_padrao_mm),
        peso_por_metro = VALUES(peso_por_metro),
        peso_unitario_kg = VALUES(peso_unitario_kg),
        densidade_g_cm3 = VALUES(densidade_g_cm3),
        estoque_minimo = VALUES(estoque_minimo),
        unidade_estoque = VALUES(unidade_estoque),
        id_fornecedor_principal = VALUES(id_fornecedor_principal),
        observacao = VALUES(observacao)
    `,
    [
      target.mpCodigo,
      nomeMateriaPrima,
      DEFAULT_CATEGORY,
      DEFAULT_LIGA,
      DEFAULT_GEOMETRY,
      pesoUnitario,
      DEFAULT_STOCK_MINIMUM_UNITS,
      DEFAULT_UNIT,
      fornecedorId,
      observacao
    ]
  );

  const [mpRows] = await connection.query(
    `
      SELECT
        id,
        codigo,
        nome,
        estoque_minimo,
        unidade_estoque
      FROM materias_primas
      WHERE codigo = ?
      LIMIT 1
    `,
    [target.mpCodigo]
  );

  const materiaPrima = mpRows[0];

  await connection.query(
    `
      INSERT IGNORE INTO materia_prima_fornecedor (
        id_materia_prima,
        id_fornecedor
      ) VALUES (?, ?)
    `,
    [materiaPrima.id, fornecedorId]
  );

  return materiaPrima;
}

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const results = [];
    for (const target of TARGETS) {
      const materiaPrima = await upsertMateriaPrimaIntermediaria(connection, target);
      results.push(materiaPrima);
    }

    await connection.commit();

    console.log('Materias-primas intermediarias garantidas com sucesso:');
    results.forEach((item) => {
      console.log(`- ${item.codigo} | ${item.nome} | minimo ${item.estoque_minimo} ${item.unidade_estoque}`);
    });
  } catch (error) {
    await connection.rollback();
    console.error('Falha ao garantir materias-primas intermediarias:', error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
