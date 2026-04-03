const mysql = require('mysql2/promise');

const connectionConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'safisa'
};

const FUNDIDO_FIELDS = {
  categoria: 'FUNDIDO',
  material: null,
  liga: 'FERRO FUNDIDO',
  geometria: 'FUNDIDO',
  bitola: null,
  bitola_mm: null,
  comprimento_padrao_mm: null,
  peso_por_metro: null,
  peso_unitario_kg: null,
  densidade_g_cm3: 7.2,
  estoque_minimo: 0,
  unidade_estoque: 'UN',
  id_fornecedor_principal: 6,
  observacao: 'Cadastro automatico de materia-prima fundida.'
};

const MATERIALS = [
  { codigo: '400FD', nome: 'VF-040/MC', pecas: ['400', '401'] },
  { codigo: '001FD', nome: 'MBF-015', pecas: ['001'] },
  { codigo: '300FD', nome: 'MBF-025/40', pecas: ['300'] },
  { codigo: '450FD', nome: 'MBF-032', pecas: ['450'] },
  { codigo: '250FD', nome: 'CJ-015', pecas: ['250'] },
  { codigo: '350FD', nome: 'BR-040', pecas: ['350'] },
  { codigo: '100FD', nome: 'BR-015', pecas: ['100'] },
  { codigo: '550FD', nome: 'AL-10', pecas: ['550'] },
  { codigo: '600FD', nome: 'SAF-40', pecas: ['600'] },
  { codigo: '152FD', nome: 'ALAVANCA', pecas: ['152'] },
  { codigo: '167FD', nome: 'ALAVANCA', pecas: ['167'] },
  { codigo: '153FD', nome: 'SUPORTE', pecas: ['153'] },
  { codigo: '608FD', nome: 'SUPORTE', pecas: ['608'] },
  { codigo: '19FD', nome: 'COTOVELO 19mm', pecas: ['19'] },
  { codigo: '076/17FD', nome: 'SUPORTE', pecas: ['076/17'] },
  { codigo: '090FD', nome: 'FORQUILHA', pecas: ['090'] },
  { codigo: '149FD', nome: 'MORINGA', pecas: ['149'] },
  { codigo: '071FD', nome: 'ADAPTADOR GARFO', pecas: ['071'] },
  { codigo: '008FD', nome: 'PISTAO 015', pecas: ['008'] },
  { codigo: '632FD', nome: 'ALAV.INSERTO', pecas: ['632'] }
];

async function upsertMateriaPrima(connection, material) {
  const [rows] = await connection.query(
    'SELECT id FROM materias_primas WHERE codigo = ? LIMIT 1',
    [material.codigo]
  );

  const values = [
    material.codigo,
    material.nome,
    FUNDIDO_FIELDS.categoria,
    FUNDIDO_FIELDS.material,
    FUNDIDO_FIELDS.liga,
    FUNDIDO_FIELDS.geometria,
    FUNDIDO_FIELDS.bitola,
    FUNDIDO_FIELDS.bitola_mm,
    FUNDIDO_FIELDS.comprimento_padrao_mm,
    FUNDIDO_FIELDS.peso_por_metro,
    FUNDIDO_FIELDS.peso_unitario_kg,
    FUNDIDO_FIELDS.densidade_g_cm3,
    FUNDIDO_FIELDS.estoque_minimo,
    FUNDIDO_FIELDS.unidade_estoque,
    FUNDIDO_FIELDS.id_fornecedor_principal,
    FUNDIDO_FIELDS.observacao
  ];

  if (rows.length > 0) {
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
      [...values, rows[0].id]
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
      [rows[0].id, FUNDIDO_FIELDS.id_fornecedor_principal, 'Fornecedor padrao para fundidos']
    );

    return { id: rows[0].id, action: 'updated' };
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    values
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
    [result.insertId, FUNDIDO_FIELDS.id_fornecedor_principal, 'Fornecedor padrao para fundidos']
  );

  return { id: result.insertId, action: 'created' };
}

async function linkPeca(connection, codigoPeca, idMateriaPrima) {
  const [rows] = await connection.query(
    'SELECT id, codigo, descricao, tipo FROM pecas WHERE codigo = ? LIMIT 1',
    [codigoPeca]
  );

  if (rows.length === 0) {
    return { linked: false, codigo: codigoPeca };
  }

  await connection.query(
    'UPDATE pecas SET id_materia_prima = ? WHERE id = ?',
    [idMateriaPrima, rows[0].id]
  );

  return {
    linked: true,
    codigo: rows[0].codigo,
    descricao: rows[0].descricao,
    tipo: rows[0].tipo
  };
}

async function main() {
  const connection = await mysql.createConnection(connectionConfig);
  const summary = {
    materiasPrimas: [],
    pecasVinculadas: [],
    pendencias: []
  };

  try {
    await connection.beginTransaction();

    for (const material of MATERIALS) {
      const materiaPrima = await upsertMateriaPrima(connection, material);
      summary.materiasPrimas.push({
        codigo: material.codigo,
        nome: material.nome,
        action: materiaPrima.action
      });

      for (const codigoPeca of material.pecas) {
        const linkResult = await linkPeca(connection, codigoPeca, materiaPrima.id);
        if (!linkResult.linked) {
          summary.pendencias.push(
            `Materia-prima ${material.codigo} criada, mas a peca ${codigoPeca} nao foi encontrada para vinculo.`
          );
          continue;
        }

        summary.pecasVinculadas.push({
          materia_prima: material.codigo,
          peca: linkResult.codigo,
          descricao: linkResult.descricao,
          tipo: linkResult.tipo
        });
      }
    }

    await connection.commit();

    console.log('Materias-primas processadas:');
    console.table(summary.materiasPrimas);

    console.log('\nPecas vinculadas:');
    console.table(summary.pecasVinculadas);

    if (summary.pendencias.length > 0) {
      console.log('\nPendencias:');
      summary.pendencias.forEach((item) => console.log(`- ${item}`));
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Falha ao registrar materias-primas fundidas.');
  console.error(error);
  process.exit(1);
});
