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

  const [previsaoRows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'solicitacoes_estoque'
      AND COLUMN_NAME = 'data_previsao'
  `);

  if (!Number(previsaoRows[0]?.total || 0)) {
    await pool.query(`
      ALTER TABLE solicitacoes_estoque
      ADD COLUMN data_previsao DATE NULL AFTER observacao
    `);
  }

  await pool.query(`
    ALTER TABLE solicitacoes_estoque
    MODIFY COLUMN status ENUM(
      'PENDENTE',
      'FALTANDO_PECA',
      'MONTANDO',
      'EM_SEPARACAO',
      'ATENDIDA_PARCIAL',
      'ATENDIDA',
      'CANCELADA'
    ) NOT NULL DEFAULT 'PENDENTE'
  `);
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

async function ensureTerceirizacaoEncerramentoColumns() {
  const requiredColumns = [
    {
      name: 'encerrado_manualmente',
      sql: `
        ALTER TABLE terceirizacao_remessa_itens
        ADD COLUMN encerrado_manualmente TINYINT(1) NOT NULL DEFAULT 0 AFTER observacao
      `
    },
    {
      name: 'justificativa_encerramento',
      sql: `
        ALTER TABLE terceirizacao_remessa_itens
        ADD COLUMN justificativa_encerramento VARCHAR(255) NULL AFTER encerrado_manualmente
      `
    },
    {
      name: 'data_encerramento',
      sql: `
        ALTER TABLE terceirizacao_remessa_itens
        ADD COLUMN data_encerramento DATETIME NULL AFTER justificativa_encerramento
      `
    }
  ];

  for (const column of requiredColumns) {
    const [rows] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'terceirizacao_remessa_itens'
        AND COLUMN_NAME = ?
    `, [column.name]);

    if (!Number(rows[0]?.total || 0)) {
      await pool.query(column.sql);
    }
  }

  const [indexRows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'terceirizacao_remessa_itens'
      AND INDEX_NAME = 'idx_terc_item_encerrado'
  `);

  if (!Number(indexRows[0]?.total || 0)) {
    await pool.query(`
      ALTER TABLE terceirizacao_remessa_itens
      ADD INDEX idx_terc_item_encerrado (encerrado_manualmente)
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
  await ensureTerceirizacaoEncerramentoColumns();
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
