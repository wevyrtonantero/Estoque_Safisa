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

async function main() {
  await runSqlFile('database/schema_estoque_materias_primas.sql');
  await runSqlFile('database/schema_tratamento_externo.sql');
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
