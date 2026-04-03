const { pool } = require('../database/connection');
const overrides = require('./peca-package-overrides');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function getQuantidadeSaidaMes(override, currentRow) {
  if (typeof override.quantidade_saida_mes === 'number') {
    return override.quantidade_saida_mes;
  }

  if (typeof override.quantidade_pacote === 'number') {
    return override.quantidade_pacote;
  }

  return currentRow.consumo_mensal;
}

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const codes = overrides.map((item) => item.codigo);
    const [rows] = await connection.query(
      `
        SELECT id, codigo, descricao, estoque_minimo, consumo_mensal
        FROM pecas
        WHERE classificacao = 'ITEM'
          AND codigo IN (?)
      `,
      [codes]
    );

    const rowsByCode = new Map(rows.map((row) => [row.codigo, row]));
    const report = {
      atualizados: [],
      ausentes: [],
      descricoes_diferentes: []
    };

    for (const override of overrides) {
      const currentRow = rowsByCode.get(override.codigo);

      if (!currentRow) {
        report.ausentes.push(override.codigo);
        continue;
      }

      if (
        override.descricao
        && !normalizeText(override.descricao).includes('DESCRICAO NAO LOCALIZADA')
        && normalizeText(currentRow.descricao) !== normalizeText(override.descricao)
      ) {
        report.descricoes_diferentes.push({
          codigo: override.codigo,
          esperado: override.descricao,
          atual: currentRow.descricao
        });
      }

      await connection.query(
        `
          UPDATE pecas
          SET
            estoque_minimo = ?,
            consumo_mensal = ?
          WHERE id = ?
        `,
        [
          override.quantidade_pacote,
          getQuantidadeSaidaMes(override, currentRow),
          currentRow.id
        ]
      );

      report.atualizados.push({
        codigo: override.codigo,
        quantidade_pacote: override.quantidade_pacote,
        quantidade_saida_mes: getQuantidadeSaidaMes(override, currentRow)
      });
    }

    await connection.commit();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .catch((error) => {
    console.error('Falha ao aplicar quantidade por pacote nas pecas:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
