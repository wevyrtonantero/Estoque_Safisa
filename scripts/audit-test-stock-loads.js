const { pool } = require('../database/connection');

async function main() {
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.query(`
      SELECT
        p.codigo,
        p.descricao,
        e.nome AS estoque,
        es.quantidade AS saldo_atual,
        t.entrada_teste,
        t.ids_teste,
        CASE
          WHEN es.quantidade = t.entrada_teste THEN 'SALDO_IGUAL_TESTE'
          WHEN es.quantidade < t.entrada_teste THEN 'SALDO_MENOR_QUE_TESTE'
          ELSE 'SALDO_MAIOR_QUE_TESTE'
        END AS situacao
      FROM estoque_saldos es
      INNER JOIN pecas p ON p.id = es.id_peca
      INNER JOIN estoques e ON e.id = es.id_estoque
      INNER JOIN (
        SELECT
          id_peca,
          id_estoque_destino AS id_estoque,
          SUM(quantidade) AS entrada_teste,
          GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS ids_teste
        FROM estoque_movimentacoes
        WHERE LOWER(COALESCE(observacao, '')) LIKE '%carga de teste%'
          AND id_estoque_destino IS NOT NULL
        GROUP BY id_peca, id_estoque_destino
      ) t ON t.id_peca = es.id_peca
        AND t.id_estoque = es.id_estoque
      WHERE es.quantidade > 0
      ORDER BY
        CASE
          WHEN es.quantidade = t.entrada_teste THEN 1
          WHEN es.quantidade < t.entrada_teste THEN 2
          ELSE 3
        END,
        t.entrada_teste DESC,
        p.codigo ASC
    `);

    const resumo = rows.reduce((acc, row) => {
      acc.total_itens += 1;
      acc.saldo_atual_total += Number(row.saldo_atual);
      acc.entrada_teste_total += Number(row.entrada_teste);
      acc.por_situacao[row.situacao] = (acc.por_situacao[row.situacao] || 0) + 1;
      return acc;
    }, {
      total_itens: 0,
      saldo_atual_total: 0,
      entrada_teste_total: 0,
      por_situacao: {}
    });

    console.log(JSON.stringify({
      resumo,
      itens: rows
    }, null, 2));
  } finally {
    connection.release();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
