const mysql = require('mysql2/promise');
const { createConnectionConfig } = require('../database/config');

const connectionConfig = createConnectionConfig();

const FUNDIDO_SUPPLIER_ID = 6;
const OBSERVATION = 'Carga inicial de estoque a partir da planilha enviada em 2026-04-02.';

const TARGETS = [
  { codigo: 'AL-05', quantidade: 32, origem: 'AL-05' },
  { codigo: 'AL-07', quantidade: 50, origem: 'AL-07' },
  { codigo: 'A\u00c7-01', quantidade: 150, origem: 'AÇ-01' },
  { codigo: 'A\u00c7-04', quantidade: 94, origem: 'AÇ-04' },
  { codigo: 'A\u00c7-06', quantidade: 111, origem: 'AÇ-06' },
  { codigo: 'A\u00c7-13', quantidade: 45, origem: 'AÇ-13' },
  { codigo: 'A\u00c7-15', quantidade: 70, origem: 'AÇ-15' },
  { codigo: 'A\u00c7-18', quantidade: 90, origem: 'AÇ-18' },
  { codigo: 'A\u00c7-32', quantidade: 12, origem: 'AÇ-32' },
  { codigo: 'A\u00c7-30', quantidade: 82, origem: 'AÇ-30' },
  { codigo: 'A\u00c7-08', quantidade: 150, origem: 'AÇ-08' },
  { codigo: 'A\u00c7-09', quantidade: 65, origem: 'AÇ-09' },
  { codigo: 'A\u00c7-12', quantidade: 600, origem: 'AÇ-12' },
  { codigo: 'A\u00c7-29', quantidade: 66, origem: 'AÇ-29' },
  { codigo: 'A\u00c7-40', quantidade: 42, origem: 'AÇ-40' },
  { codigo: '608FD', quantidade: 30, origem: 'SS11 / SUPORTE FUNDIDO 608' },
  { codigo: '149FD', quantidade: 60, origem: 'SS22 / MORINGA COMPLETA' },
  { codigo: '153FD', quantidade: 30, origem: 'AÇ-23 / SUPORTE DE FIXACAO 153' },
  { codigo: '632FD', quantidade: 7, origem: '632 / ALAVANCA ELETRONICO 632' },
  {
    codigo: '035FD',
    quantidade: 1000,
    origem: '035 / COTOVELO FUNDICAO',
    ensureFundido: {
      nome: 'COTOVELO FUNDICAO',
      pecaCodigo: '035'
    }
  }
];

const PENDING_CODES = [
  { codigo: 'SS-110', quantidade: 100, motivo: 'Nao existe materia-prima cadastrada com mapeamento seguro para este item.' },
  { codigo: 'IN-07', quantidade: 660, motivo: 'Materia-prima ainda nao cadastrada.' },
  { codigo: 'A\u00c7-05', quantidade: 174, motivo: 'Materia-prima ainda nao cadastrada.' },
  { codigo: 'A\u00c7-22', quantidade: 60, motivo: 'Codigo conflita com o registro antigo da moringa e a barra ainda nao foi cadastrada.' },
  { codigo: 'A\u00c7-31', quantidade: 187, motivo: 'Materia-prima ainda nao cadastrada.' }
];

async function ensureFundidoMaterial(connection, target) {
  const [existing] = await connection.query(
    'SELECT id, codigo, unidade_estoque FROM materias_primas WHERE codigo = ? LIMIT 1',
    [target.codigo]
  );

  if (existing.length > 0) {
    return existing[0];
  }

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
      ) VALUES (?, ?, 'FUNDIDO', NULL, 'FERRO FUNDIDO', 'FUNDIDO', NULL, NULL, NULL, NULL, NULL, 7.2, 0, 'UN', ?, ?)
    `,
    [target.codigo, target.ensureFundido.nome, FUNDIDO_SUPPLIER_ID, 'Materia-prima fundida cadastrada automaticamente para lancamento de estoque.']
  );

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
    [result.insertId, FUNDIDO_SUPPLIER_ID, 'Fornecedor padrao para fundidos.']
  );

  if (target.ensureFundido.pecaCodigo) {
    const [pieces] = await connection.query(
      'SELECT id FROM pecas WHERE codigo = ? LIMIT 1',
      [target.ensureFundido.pecaCodigo]
    );

    if (pieces.length > 0) {
      await connection.query(
        'UPDATE pecas SET id_materia_prima = ? WHERE id = ?',
        [result.insertId, pieces[0].id]
      );
    }
  }

  return {
    id: result.insertId,
    codigo: target.codigo,
    unidade_estoque: 'UN'
  };
}

async function findMaterial(connection, target) {
  if (target.ensureFundido) {
    return ensureFundidoMaterial(connection, target);
  }

  const [rows] = await connection.query(
    'SELECT id, codigo, unidade_estoque FROM materias_primas WHERE codigo = ? LIMIT 1',
    [target.codigo]
  );

  return rows[0] || null;
}

async function loadSaldoForUpdate(connection, materialId) {
  const [rows] = await connection.query(
    `
      SELECT id, quantidade
      FROM estoque_materias_primas_saldos
      WHERE id_materia_prima = ?
      FOR UPDATE
    `,
    [materialId]
  );

  return rows[0] || null;
}

async function applySaldo(connection, material, quantidade, origem) {
  const saldoAtual = await loadSaldoForUpdate(connection, material.id);
  const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;

  if (quantidadeAtual > 0) {
    return {
      action: 'skipped_existing',
      codigo: material.codigo,
      quantidade_atual: quantidadeAtual
    };
  }

  if (saldoAtual) {
    await connection.query(
      'UPDATE estoque_materias_primas_saldos SET quantidade = ? WHERE id = ?',
      [quantidade, saldoAtual.id]
    );
  } else {
    await connection.query(
      'INSERT INTO estoque_materias_primas_saldos (id_materia_prima, quantidade) VALUES (?, ?)',
      [material.id, quantidade]
    );
  }

  await connection.query(
    `
      INSERT INTO estoque_materias_primas_movimentacoes (
        id_materia_prima,
        id_producao_ordem,
        tipo_movimentacao,
        quantidade,
        unidade,
        saldo_resultante,
        observacao
      ) VALUES (?, NULL, 'AJUSTE', ?, ?, ?, ?)
    `,
    [
      material.id,
      quantidade,
      material.unidade_estoque,
      quantidade,
      `${OBSERVATION} Origem: ${origem}.`
    ]
  );

  return {
    action: 'applied',
    codigo: material.codigo,
    quantidade
  };
}

async function main() {
  const connection = await mysql.createConnection(connectionConfig);
  const summary = {
    applied: [],
    skipped: [],
    pending: [...PENDING_CODES]
  };

  try {
    await connection.beginTransaction();

    for (const target of TARGETS) {
      const material = await findMaterial(connection, target);

      if (!material) {
        summary.pending.push({
          codigo: target.origem,
          quantidade: target.quantidade,
          motivo: 'Materia-prima nao cadastrada.'
        });
        continue;
      }

      const result = await applySaldo(connection, material, target.quantidade, target.origem);
      if (result.action === 'applied') {
        summary.applied.push(result);
      } else {
        summary.skipped.push(result);
      }
    }

    await connection.commit();

    console.log('Lancamentos aplicados:');
    console.table(summary.applied);

    console.log('\nItens ignorados por ja terem saldo:');
    console.table(summary.skipped);

    console.log('\nPendencias:');
    console.table(summary.pending);
  } catch (error) {
    await connection.rollback();
    console.error('Falha ao aplicar estoque inicial de materias-primas.');
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
