const { pool } = require('../database/connection');
const ComposicaoVendaModel = require('../src/models/ComposicaoVendaModel');
const {
  saleItemsToEnsure,
  compositions,
  pendingCompositions,
  assumptions
} = require('./data/composicoes-venda-2026-04-06');

async function findItemByCodigo(codigo, connection) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        codigo,
        descricao,
        tipo,
        classificacao
      FROM pecas
      WHERE codigo = ?
      LIMIT 1
    `,
    [codigo]
  );

  return rows[0] || null;
}

async function ensureSaleItem(item, connection) {
  const existing = await findItemByCodigo(item.codigo, connection);
  if (existing) {
    return {
      item: existing,
      created: false
    };
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
      ) VALUES (?, ?, NULL, 'PRODUZIDA', 'SUBMONTAGEM', NULL, NULL, NULL, NULL, NULL, NULL, 0)
    `,
    [item.codigo, item.descricao]
  );

  return {
    item: await findItemByCodigo(item.codigo, connection),
    created: result.insertId > 0
  };
}

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ComposicaoVendaModel.ensureSchema(connection);

    const ensuredSaleItems = [];

    for (const item of saleItemsToEnsure) {
      const result = await ensureSaleItem(item, connection);
      if (result.created) {
        ensuredSaleItems.push({
          codigo: result.item.codigo,
          descricao: result.item.descricao
        });
      }
    }

    const itemCache = new Map();

    async function resolve(codigo) {
      if (!itemCache.has(codigo)) {
        itemCache.set(codigo, await findItemByCodigo(codigo, connection));
      }

      return itemCache.get(codigo);
    }

    const validRows = [];
    const unresolvedRows = [...pendingCompositions];

    for (const row of compositions) {
      const itemVenda = await resolve(row.codigo_venda);
      const itemAtende = await resolve(row.codigo_atende);

      if (!itemVenda || !itemAtende) {
        unresolvedRows.push({
          ...row,
          motivo: `Codigo ausente no cadastro local: ${!itemVenda ? row.codigo_venda : row.codigo_atende}`
        });
        continue;
      }

      validRows.push({
        ...row,
        id_item_venda: Number(itemVenda.id),
        id_item_atende: Number(itemAtende.id)
      });
    }

    const idsVenda = Array.from(new Set(validRows.map((row) => row.id_item_venda)));

    if (idsVenda.length > 0) {
      await connection.query(
        `DELETE FROM composicoes_venda WHERE id_item_venda IN (${idsVenda.map(() => '?').join(', ')})`,
        idsVenda
      );
    }

    for (const row of validRows) {
      await connection.query(
        `
          INSERT INTO composicoes_venda (
            id_item_venda,
            id_item_atende,
            quantidade,
            ordem
          ) VALUES (?, ?, ?, ?)
        `,
        [row.id_item_venda, row.id_item_atende, row.quantidade, 0]
      );
    }

    await connection.commit();

    console.log(JSON.stringify({
      ensured_sale_items: ensuredSaleItems,
      assumptions,
      inserted_rows: validRows.length,
      sale_codes_updated: idsVenda.length,
      pending_rows: unresolvedRows.length,
      pending: unresolvedRows
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
