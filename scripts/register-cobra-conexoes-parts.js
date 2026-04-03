const mysql = require('mysql2/promise');

const connectionConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'safisa'
};

const SUPPLIER_ALIASES = [
  'Cobra Conexoes',
  'Cobra Conexoes Brasil Industria Metalurgica Ltda.',
  'Cobra Conexões',
  'Cobra Conexões Brasil Indústria Metalúrgica Ltda.'
];

const SUPPLIER_DATA = {
  nome: 'Cobra Conexoes',
  telefone: '(11) 2915-6622 / (11) 99674-3177',
  contato: 'Vendas',
  email: 'vendas@cobraconexoes.com.br',
  cep: '03109-010',
  endereco: 'Rua Joao Padilla, 88, Parque da Mooca',
  cidade: 'Sao Paulo - SP',
  observacao: 'Razao social: Cobra Conexoes Brasil Industria Metalurgica Ltda. | CNPJ: 56.940.380/0001-07'
};

const TARGET_PIECES = [
  { codigo: '035/1', descricao: null, tipo: 'COMPRADA' },
  { codigo: '035/13', descricao: 'COTOVELO', tipo: 'COMPRADA' },
  { codigo: '035/14', descricao: null, tipo: 'COMPRADA' },
  { codigo: '035/3', descricao: null, tipo: 'COMPRADA' },
  { codigo: '035/4', descricao: null, tipo: 'COMPRADA' },
  { codigo: '035/7', descricao: null, tipo: 'COMPRADA' },
  { codigo: '035/9', descricao: null, tipo: 'COMPRADA' },
  { codigo: '035/16', descricao: null, tipo: 'COMPRADA' },
  { codigo: '108', descricao: 'INSERT 1/4"', tipo: 'COMPRADA' },
  { codigo: '109', descricao: 'ANILHA', tipo: 'COMPRADA' }
];

async function findOrCreateSupplier(connection) {
  const placeholders = SUPPLIER_ALIASES.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `SELECT id, nome FROM fornecedores WHERE nome IN (${placeholders}) ORDER BY id ASC LIMIT 1`,
    SUPPLIER_ALIASES
  );

  if (rows.length > 0) {
    await connection.query(
      `
        UPDATE fornecedores
        SET
          nome = ?,
          telefone = ?,
          contato = ?,
          email = ?,
          cep = ?,
          endereco = ?,
          cidade = ?,
          observacao = ?
        WHERE id = ?
      `,
      [
        SUPPLIER_DATA.nome,
        SUPPLIER_DATA.telefone,
        SUPPLIER_DATA.contato,
        SUPPLIER_DATA.email,
        SUPPLIER_DATA.cep,
        SUPPLIER_DATA.endereco,
        SUPPLIER_DATA.cidade,
        SUPPLIER_DATA.observacao,
        rows[0].id
      ]
    );

    return { id: rows[0].id, action: 'updated' };
  }

  const [result] = await connection.query(
    `
      INSERT INTO fornecedores (
        nome,
        telefone,
        contato,
        email,
        cep,
        endereco,
        cidade,
        observacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      SUPPLIER_DATA.nome,
      SUPPLIER_DATA.telefone,
      SUPPLIER_DATA.contato,
      SUPPLIER_DATA.email,
      SUPPLIER_DATA.cep,
      SUPPLIER_DATA.endereco,
      SUPPLIER_DATA.cidade,
      SUPPLIER_DATA.observacao
    ]
  );

  return { id: result.insertId, action: 'created' };
}

async function findPieceByCode(connection, codigo) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        codigo,
        descricao,
        tipo,
        classificacao,
        id_materia_prima,
        id_fornecedor,
        id_maquina,
        estoque_minimo,
        estoque_seguranca,
        consumo_mensal,
        massa_kg
      FROM pecas
      WHERE codigo = ?
      LIMIT 1
    `,
    [codigo]
  );

  return rows[0] || null;
}

async function upsertPiece(connection, supplierId, piece) {
  const existing = await findPieceByCode(connection, piece.codigo);

  if (existing) {
    await connection.query(
      `
        UPDATE pecas
        SET
          descricao = ?,
          tipo = ?,
          classificacao = 'ITEM',
          id_materia_prima = NULL,
          id_fornecedor = ?,
          id_maquina = NULL
        WHERE id = ?
      `,
      [
        piece.descricao || existing.descricao,
        piece.tipo,
        supplierId,
        existing.id
      ]
    );

    return { id: existing.id, codigo: existing.codigo, action: 'updated' };
  }

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
      ) VALUES (?, ?, NULL, ?, 'ITEM', NULL, ?, NULL, NULL, NULL, NULL, NULL)
    `,
    [piece.codigo, piece.descricao, piece.tipo, supplierId]
  );

  return { id: result.insertId, codigo: piece.codigo, action: 'created' };
}

async function syncSupplierLinks(connection, pieceId, supplierId) {
  await connection.query(
    'DELETE FROM peca_fornecedor WHERE id_peca = ? AND id_fornecedor <> ?',
    [pieceId, supplierId]
  );

  await connection.query(
    `
      INSERT INTO peca_fornecedor (
        id_peca,
        id_fornecedor,
        observacao
      ) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        observacao = VALUES(observacao)
    `,
    [pieceId, supplierId, 'Fornecedor principal definido manualmente para Cobra Conexoes.']
  );
}

async function main() {
  const connection = await mysql.createConnection(connectionConfig);
  const summary = {
    supplier: null,
    pieces: []
  };

  try {
    await connection.beginTransaction();

    const supplier = await findOrCreateSupplier(connection);
    summary.supplier = supplier;

    for (const piece of TARGET_PIECES) {
      const savedPiece = await upsertPiece(connection, supplier.id, piece);
      await syncSupplierLinks(connection, savedPiece.id, supplier.id);

      summary.pieces.push({
        codigo: savedPiece.codigo,
        action: savedPiece.action
      });
    }

    await connection.commit();

    console.log('Fornecedor processado:');
    console.table([summary.supplier]);

    console.log('\nPecas processadas:');
    console.table(summary.pieces);
  } catch (error) {
    await connection.rollback();
    console.error('Falha ao cadastrar Cobra Conexoes e vincular pecas.');
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
