const mysql = require('mysql2/promise');

const connectionConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'safisa',
  charset: 'utf8mb4'
};

async function fetchScalar(connection, sql, params = []) {
  const [rows] = await connection.query(sql, params);
  return rows[0] || {};
}

async function main() {
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await connection.beginTransaction();

    const [genericRows] = await connection.query(
      `SELECT id, codigo, nome FROM materias_primas WHERE codigo = 'MP-GENERICA' OR id = 1 LIMIT 1`
    );

    if (genericRows.length === 0) {
      await connection.commit();
      console.log('MP-GENERICA ja nao existe no banco.');
      return;
    }

    const genericId = Number(genericRows[0].id);

    const before = {
      pecas: await fetchScalar(connection, 'SELECT COUNT(*) AS total FROM pecas WHERE id_materia_prima = ?', [genericId]),
      ordens: await fetchScalar(connection, 'SELECT COUNT(*) AS total FROM producao_ordens WHERE id_materia_prima = ?', [genericId]),
      saldo: await fetchScalar(connection, 'SELECT COUNT(*) AS total, COALESCE(SUM(quantidade), 0) AS quantidade_total FROM estoque_materias_primas_saldos WHERE id_materia_prima = ?', [genericId]),
      movimentacoes: await fetchScalar(connection, 'SELECT COUNT(*) AS total FROM estoque_materias_primas_movimentacoes WHERE id_materia_prima = ?', [genericId]),
      fornecedores: await fetchScalar(connection, 'SELECT COUNT(*) AS total FROM materia_prima_fornecedor WHERE id_materia_prima = ?', [genericId])
    };

    await connection.query(
      `
        UPDATE pecas
        SET id_materia_prima = NULL
        WHERE id_materia_prima = ?
      `,
      [genericId]
    );

    await connection.query(
      `
        UPDATE producao_ordens
        SET id_materia_prima = NULL
        WHERE id_materia_prima = ?
      `,
      [genericId]
    );

    await connection.query('DELETE FROM estoque_materias_primas_movimentacoes WHERE id_materia_prima = ?', [genericId]);
    await connection.query('DELETE FROM estoque_materias_primas_saldos WHERE id_materia_prima = ?', [genericId]);
    await connection.query('DELETE FROM materia_prima_fornecedor WHERE id_materia_prima = ?', [genericId]);
    await connection.query('DELETE FROM materias_primas WHERE id = ?', [genericId]);

    const after = {
      pecas: await fetchScalar(connection, 'SELECT COUNT(*) AS total FROM pecas WHERE id_materia_prima = ?', [genericId]),
      ordens: await fetchScalar(connection, 'SELECT COUNT(*) AS total FROM producao_ordens WHERE id_materia_prima = ?', [genericId]),
      saldo: await fetchScalar(connection, 'SELECT COUNT(*) AS total FROM estoque_materias_primas_saldos WHERE id_materia_prima = ?', [genericId]),
      movimentacoes: await fetchScalar(connection, 'SELECT COUNT(*) AS total FROM estoque_materias_primas_movimentacoes WHERE id_materia_prima = ?', [genericId]),
      fornecedores: await fetchScalar(connection, 'SELECT COUNT(*) AS total FROM materia_prima_fornecedor WHERE id_materia_prima = ?', [genericId]),
      materiaPrima: await fetchScalar(connection, 'SELECT COUNT(*) AS total FROM materias_primas WHERE id = ?', [genericId])
    };

    await connection.commit();

    console.log('MP-GENERICA removida.');
    console.log('\nAntes:');
    console.table([
      { area: 'pecas', total: before.pecas.total },
      { area: 'producao_ordens', total: before.ordens.total },
      { area: 'estoque_mp_saldos', total: before.saldo.total, quantidade_total: before.saldo.quantidade_total },
      { area: 'estoque_mp_movimentacoes', total: before.movimentacoes.total },
      { area: 'materia_prima_fornecedor', total: before.fornecedores.total }
    ]);

    console.log('\nDepois:');
    console.table([
      { area: 'pecas', total: after.pecas.total },
      { area: 'producao_ordens', total: after.ordens.total },
      { area: 'estoque_mp_saldos', total: after.saldo.total },
      { area: 'estoque_mp_movimentacoes', total: after.movimentacoes.total },
      { area: 'materia_prima_fornecedor', total: after.fornecedores.total },
      { area: 'materias_primas', total: after.materiaPrima.total }
    ]);
  } catch (error) {
    await connection.rollback();
    console.error('Falha ao remover MP-GENERICA.');
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
