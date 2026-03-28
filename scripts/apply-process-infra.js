const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');

async function runSqlFile(relativePath) {
  const filePath = path.join(__dirname, '..', relativePath);
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function ensureSolicitacoesEstoqueSchema() {
  const [columnRows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'solicitacoes_estoque'
      AND COLUMN_NAME = 'origem_atendimento'
  `);

  if (!Number(columnRows[0]?.total || 0)) {
    await pool.query(`
      ALTER TABLE solicitacoes_estoque
      ADD COLUMN origem_atendimento ENUM('ALMOXARIFADO', 'MONTAGEM')
      NOT NULL DEFAULT 'ALMOXARIFADO' AFTER area_origem
    `);
  }

  const [indexRows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'solicitacoes_estoque'
      AND INDEX_NAME = 'idx_solicitacao_origem_atendimento'
  `);

  if (!Number(indexRows[0]?.total || 0)) {
    await pool.query(`
      ALTER TABLE solicitacoes_estoque
      ADD INDEX idx_solicitacao_origem_atendimento (origem_atendimento)
    `);
  }
}

async function ensureEstoqueMateriaPrimaAllowsNegative() {
  const [checkRows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'estoque_materias_primas_saldos'
      AND CONSTRAINT_NAME = 'chk_emp_saldos_quantidade'
      AND CONSTRAINT_TYPE = 'CHECK'
  `);

  if (Number(checkRows[0]?.total || 0)) {
    await pool.query(`
      ALTER TABLE estoque_materias_primas_saldos
      DROP CHECK chk_emp_saldos_quantidade
    `);
  }
}

async function main() {
  await runSqlFile('database/schema_solicitacoes_estoque.sql');
  await ensureSolicitacoesEstoqueSchema();
  await runSqlFile('database/schema_solicitacoes_producao.sql');
  await runSqlFile('database/schema_estoque_materias_primas.sql');
  await ensureEstoqueMateriaPrimaAllowsNegative();
  await runSqlFile('database/schema_tratamento_externo.sql');
  await runSqlFile('database/schema_terceirizacao_remessas.sql');
  console.log('Infraestrutura de processo aplicada com sucesso.');
}

main()
  .catch((error) => {
    console.error('Falha ao aplicar a infraestrutura de processo:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
