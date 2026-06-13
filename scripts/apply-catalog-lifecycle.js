const { pool } = require('../database/connection');

async function ensureActiveColumn(tableName) {
  const [rows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = 'ativo'
  `, [tableName]);

  if (!Number(rows[0]?.total || 0)) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1 AFTER observacao`);
    await pool.query(`ALTER TABLE \`${tableName}\` ADD INDEX idx_${tableName}_ativo (ativo)`);
  }
}

async function main() {
  await ensureActiveColumn('materias_primas');

  const [pecaRows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pecas'
      AND COLUMN_NAME = 'ativo'
  `);

  if (!Number(pecaRows[0]?.total || 0)) {
    await pool.query('ALTER TABLE pecas ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1 AFTER massa_kg');
    await pool.query('ALTER TABLE pecas ADD INDEX idx_pecas_ativo (ativo)');
  }

  console.log('Ciclo de vida dos cadastros aplicado com sucesso.');
}

main()
  .catch((error) => {
    console.error('Falha ao aplicar ciclo de vida dos cadastros:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
