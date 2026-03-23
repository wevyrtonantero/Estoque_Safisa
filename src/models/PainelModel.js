const { pool } = require('../../database/connection');

class PainelModel {
  static async getSummary() {
    const [
      [stockTotalsRows],
      [mpTotalsRows],
      [thirdPartyPendingRows],
      [remessasSemNfRows],
      [refugoRows],
      [solicitacoesRows],
      [byWarehouse],
      [topStock],
      [lowStock],
      [topSaidas],
      [producaoPorMaquina],
      [tratamentoStatus],
      [producaoEmAndamento]
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS registros,
          COALESCE(SUM(quantidade), 0) AS quantidade_total
        FROM estoque_saldos
        WHERE quantidade > 0
      `),
      pool.query(`
        SELECT
          COUNT(*) AS registros,
          COALESCE(SUM(quantidade), 0) AS quantidade_total
        FROM estoque_materias_primas_saldos
        WHERE quantidade > 0
      `),
      pool.query(`
        SELECT
          COUNT(*) AS itens_pendentes,
          COALESCE(SUM(quantidade_enviada - quantidade_retorno), 0) AS quantidade_pendente
        FROM terceirizacao_remessa_itens
        WHERE status IN ('ENVIADO', 'RETORNO_PARCIAL')
      `),
      pool.query(`
        SELECT COUNT(*) AS total
        FROM terceirizacao_remessas
        WHERE numero_nf IS NULL OR numero_nf = ''
      `),
      pool.query(`
        SELECT
          COUNT(*) AS ordens_finalizadas,
          COALESCE(SUM(quantidade_refugo), 0) AS total_refugo,
          COALESCE(SUM(quantidade_produzida), 0) AS total_produzido
        FROM producao_ordens
        WHERE status = 'FINALIZADA'
      `),
      pool.query(`
        SELECT COUNT(*) AS abertas
        FROM solicitacoes_estoque
        WHERE status IN ('PENDENTE', 'EM_SEPARACAO', 'ATENDIDA_PARCIAL')
      `),
      pool.query(`
        SELECT
          e.nome,
          COALESCE(SUM(s.quantidade), 0) AS quantidade_total,
          COUNT(s.id) AS registros
        FROM estoques e
        LEFT JOIN estoque_saldos s ON s.id_estoque = e.id
        GROUP BY e.id, e.nome
        ORDER BY e.id ASC
      `),
      pool.query(`
        SELECT
          p.codigo,
          p.descricao,
          e.nome AS estoque_nome,
          s.quantidade
        FROM estoque_saldos s
        INNER JOIN pecas p ON p.id = s.id_peca
        INNER JOIN estoques e ON e.id = s.id_estoque
        WHERE s.quantidade > 0
        ORDER BY s.quantidade DESC, p.codigo ASC
        LIMIT 5
      `),
      pool.query(`
        SELECT
          p.codigo,
          p.descricao,
          e.nome AS estoque_nome,
          s.quantidade
        FROM estoque_saldos s
        INNER JOIN pecas p ON p.id = s.id_peca
        INNER JOIN estoques e ON e.id = s.id_estoque
        WHERE s.quantidade > 0
        ORDER BY s.quantidade ASC, p.codigo ASC
        LIMIT 5
      `),
      pool.query(`
        SELECT
          p.codigo,
          p.descricao,
          COALESCE(SUM(em.quantidade), 0) AS quantidade_saida
        FROM estoque_movimentacoes em
        INNER JOIN pecas p ON p.id = em.id_peca
        WHERE em.tipo_movimentacao = 'SAIDA'
        GROUP BY p.id, p.codigo, p.descricao
        ORDER BY quantidade_saida DESC, p.codigo ASC
        LIMIT 5
      `),
      pool.query(`
        SELECT
          m.nome AS maquina_nome,
          COALESCE(SUM(po.quantidade_produzida), 0) AS quantidade_produzida,
          COALESCE(SUM(po.quantidade_refugo), 0) AS quantidade_refugo
        FROM producao_ordens po
        INNER JOIN maquinas m ON m.id = po.id_maquina
        WHERE po.status = 'FINALIZADA'
        GROUP BY m.id, m.nome
        ORDER BY quantidade_produzida DESC, m.nome ASC
        LIMIT 5
      `),
      pool.query(`
        SELECT
          status,
          COUNT(*) AS total_itens,
          COALESCE(SUM(quantidade_enviada - quantidade_retorno), 0) AS quantidade_pendente
        FROM terceirizacao_remessa_itens
        GROUP BY status
        ORDER BY status ASC
      `),
      pool.query(`
        SELECT
          po.id,
          po.data_inicio,
          po.quantidade_planejada,
          m.nome AS maquina_nome,
          p.codigo AS peca_codigo,
          p.descricao AS peca_descricao,
          COALESCE(mp.codigo, '-') AS materia_prima_codigo,
          COALESCE(mp.nome, '-') AS materia_prima_nome
        FROM producao_ordens po
        INNER JOIN maquinas m ON m.id = po.id_maquina
        INNER JOIN pecas p ON p.id = po.id_peca
        LEFT JOIN materias_primas mp ON mp.id = po.id_materia_prima
        WHERE po.status = 'EM_ANDAMENTO'
        ORDER BY po.data_inicio ASC, po.id ASC
      `)
    ]);

    return {
      indicadores: {
        estoque: stockTotalsRows[0] || { registros: 0, quantidade_total: 0 },
        materia_prima: mpTotalsRows[0] || { registros: 0, quantidade_total: 0 },
        terceirizacao: thirdPartyPendingRows[0] || { itens_pendentes: 0, quantidade_pendente: 0 },
        remessas_sem_nf: remessasSemNfRows[0] || { total: 0 },
        producao: refugoRows[0] || { ordens_finalizadas: 0, total_refugo: 0, total_produzido: 0 },
        solicitacoes: solicitacoesRows[0] || { abertas: 0 }
      },
      estoque_por_deposito: byWarehouse,
      estoque_maiores: topStock,
      estoque_menores: lowStock,
      saidas_top: topSaidas,
      producao_por_maquina: producaoPorMaquina,
      tratamento_status: tratamentoStatus,
      producao_em_andamento: producaoEmAndamento
    };
  }
}

module.exports = PainelModel;
