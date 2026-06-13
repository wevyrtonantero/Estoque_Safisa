const { pool } = require('../database/connection');

const INSERT_TRIGGER = 'trg_pecas_codigo_unico_insert';
const UPDATE_TRIGGER = 'trg_pecas_codigo_unico_update';
const UNIQUE_INDEX = 'uq_pecas_codigo';

async function installDuplicateProtection() {
  await pool.query(`DROP TRIGGER IF EXISTS ${INSERT_TRIGGER}`);
  await pool.query(`DROP TRIGGER IF EXISTS ${UPDATE_TRIGGER}`);

  await pool.query(`
    CREATE TRIGGER ${INSERT_TRIGGER}
    BEFORE INSERT ON pecas
    FOR EACH ROW
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pecas
        WHERE TRIM(codigo) = TRIM(NEW.codigo)
      ) THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Ja existe uma peca ou submontagem com esse codigo.';
      END IF;
    END
  `);

  await pool.query(`
    CREATE TRIGGER ${UPDATE_TRIGGER}
    BEFORE UPDATE ON pecas
    FOR EACH ROW
    BEGIN
      IF TRIM(NEW.codigo) <> TRIM(OLD.codigo)
        AND EXISTS (
          SELECT 1
          FROM pecas
          WHERE TRIM(codigo) = TRIM(NEW.codigo)
            AND id <> OLD.id
        )
      THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Ja existe uma peca ou submontagem com esse codigo.';
      END IF;
    END
  `);
}

async function ensureUniqueIndexWhenPossible() {
  const [duplicateRows] = await pool.query(`
    SELECT TRIM(codigo) AS codigo, COUNT(*) AS quantidade
    FROM pecas
    GROUP BY TRIM(codigo)
    HAVING COUNT(*) > 1
    ORDER BY TRIM(codigo)
  `);

  const [indexRows] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pecas'
      AND INDEX_NAME = ?
  `, [UNIQUE_INDEX]);

  if (duplicateRows.length === 0 && !Number(indexRows[0]?.total || 0)) {
    await pool.query(`ALTER TABLE pecas ADD UNIQUE KEY ${UNIQUE_INDEX} (codigo)`);
    console.log('Indice unico de codigos criado.');
    return true;
  }

  if (duplicateRows.length > 0) {
    console.log(`Indice unico pendente: ${duplicateRows.length} codigo(s) antigo(s) ainda estao duplicados.`);
    duplicateRows.forEach((row) => console.log(`- ${row.codigo}: ${row.quantidade} registros`));
    return false;
  }

  return true;
}

async function main() {
  const uniqueIndexReady = await ensureUniqueIndexWhenPossible();

  if (uniqueIndexReady) {
    await pool.query(`DROP TRIGGER IF EXISTS ${INSERT_TRIGGER}`);
    await pool.query(`DROP TRIGGER IF EXISTS ${UPDATE_TRIGGER}`);
    console.log('Protecao definitiva por indice unico instalada.');
    return;
  }

  await installDuplicateProtection();
  console.log('Protecao temporaria contra novos codigos duplicados instalada.');
}

main()
  .catch((error) => {
    console.error('Falha ao proteger os codigos das pecas:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
