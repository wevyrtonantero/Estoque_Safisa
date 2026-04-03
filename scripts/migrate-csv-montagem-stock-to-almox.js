const mysql = require('mysql2/promise');
const { createConnectionConfig } = require('../database/config');

const connectionConfig = createConnectionConfig();
const CSV_MONTAGEM_OBSERVATION = 'Sincronizacao pela tabela_pecas_safisa_completa.csv em 2026-04-02. Estoque Montagem.';
const MIGRATION_NOTE = 'Reclassificacao do saldo importado da planilha 2026-04-02 da Montagem para o Almoxarifado.';

async function getStockByName(connection, name) {
  const [rows] = await connection.query(
    `
      SELECT id, nome
      FROM estoques
      WHERE nome = ?
      LIMIT 1
    `,
    [name]
  );

  return rows[0] || null;
}

async function getSaldoForUpdate(connection, stockId, pieceId) {
  const [rows] = await connection.query(
    `
      SELECT id, quantidade
      FROM estoque_saldos
      WHERE id_estoque = ? AND id_peca = ?
      FOR UPDATE
    `,
    [stockId, pieceId]
  );

  return rows[0] || null;
}

async function upsertSaldo(connection, stockId, pieceId, quantity, currentSaldo) {
  if (currentSaldo) {
    if (Number(quantity) <= 0) {
      await connection.query(
        `
          DELETE FROM estoque_saldos
          WHERE id = ?
        `,
        [currentSaldo.id]
      );
      return;
    }

    await connection.query(
      `
        UPDATE estoque_saldos
        SET quantidade = ?
        WHERE id = ?
      `,
      [quantity, currentSaldo.id]
    );
    return;
  }

  if (Number(quantity) > 0) {
    await connection.query(
      `
        INSERT INTO estoque_saldos (id_estoque, id_peca, quantidade)
        VALUES (?, ?, ?)
      `,
      [stockId, pieceId, quantity]
    );
  }
}

async function main() {
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await connection.beginTransaction();

    const montagem = await getStockByName(connection, 'Montagem');
    const almox = await getStockByName(connection, 'Almoxarifado');

    if (!montagem || !almox) {
      throw new Error('Nao foi possivel localizar os estoques de Montagem e Almoxarifado.');
    }

    const [pieceRows] = await connection.query(
      `
        SELECT DISTINCT
          p.id,
          p.codigo,
          p.descricao
        FROM estoque_movimentacoes m
        INNER JOIN pecas p ON p.id = m.id_peca
        WHERE m.observacao = ?
      `,
      [CSV_MONTAGEM_OBSERVATION]
    );

    const summary = [];

    for (const piece of pieceRows) {
      const montagemSaldo = await getSaldoForUpdate(connection, montagem.id, piece.id);
      const quantidadeMontagem = Number(montagemSaldo?.quantidade || 0);

      if (quantidadeMontagem <= 0) {
        summary.push({
          codigo: piece.codigo,
          descricao: piece.descricao,
          quantidade_migrada: 0
        });
        continue;
      }

      const almoxSaldo = await getSaldoForUpdate(connection, almox.id, piece.id);
      const quantidadeAlmox = Number(almoxSaldo?.quantidade || 0);

      await upsertSaldo(connection, montagem.id, piece.id, 0, montagemSaldo);
      await upsertSaldo(connection, almox.id, piece.id, Number((quantidadeAlmox + quantidadeMontagem).toFixed(2)), almoxSaldo);

      await connection.query(
        `
          INSERT INTO estoque_movimentacoes (
            id_peca,
            id_estoque_origem,
            id_estoque_destino,
            tipo_movimentacao,
            quantidade,
            observacao
          ) VALUES (?, ?, ?, 'TRANSFERENCIA', ?, ?)
        `,
        [piece.id, montagem.id, almox.id, quantidadeMontagem, MIGRATION_NOTE]
      );

      summary.push({
        codigo: piece.codigo,
        descricao: piece.descricao,
        quantidade_migrada: quantidadeMontagem
      });
    }

    await connection.commit();

    console.log(JSON.stringify({
      itens_processados: pieceRows.length,
      itens_migrados: summary.filter((item) => item.quantidade_migrada > 0).length,
      detalhes: summary
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    console.error('Falha ao migrar o saldo importado da Montagem para o Almoxarifado.');
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
