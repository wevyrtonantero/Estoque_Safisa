const { pool } = require('../database/connection');

async function columnExists(columnName) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'estoque_movimentacoes'
        AND COLUMN_NAME = ?
    `,
    [columnName]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function indexExists(indexName) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'estoque_movimentacoes'
        AND INDEX_NAME = ?
    `,
    [indexName]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function main() {
  if (!(await columnExists('id_usuario'))) {
    await pool.query('ALTER TABLE estoque_movimentacoes ADD COLUMN id_usuario INT NULL AFTER observacao');
  }
  if (!(await columnExists('usuario_login'))) {
    await pool.query('ALTER TABLE estoque_movimentacoes ADD COLUMN usuario_login VARCHAR(80) NULL AFTER id_usuario');
  }
  if (!(await columnExists('usuario_nome'))) {
    await pool.query('ALTER TABLE estoque_movimentacoes ADD COLUMN usuario_nome VARCHAR(120) NULL AFTER usuario_login');
  }
  if (!(await indexExists('idx_estoque_movimentacoes_usuario'))) {
    await pool.query('ALTER TABLE estoque_movimentacoes ADD INDEX idx_estoque_movimentacoes_usuario (id_usuario)');
  }

  console.log('Responsavel do historico de estoque configurado com sucesso.');
}

main()
  .catch((error) => {
    console.error('Falha ao configurar responsavel do historico de estoque:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
