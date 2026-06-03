const { pool } = require('../database/connection');
const EstoqueModel = require('../src/models/EstoqueModel');

const QUANTIDADE_TESTE_POR_MODELO = 10;
const KEYWORDS = ['VF', 'MC', 'AL', 'BR', 'SAF', 'CJ', 'MBF'];

function ensureTestSeedAllowed() {
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('Script de carga de teste bloqueado em NODE_ENV=production.');
  }

  if (process.env.SAFISA_ALLOW_TEST_SEED !== '1') {
    throw new Error('Script de carga de teste bloqueado. Defina SAFISA_ALLOW_TEST_SEED=1 para executar em ambiente local de teste.');
  }
}

function isEligibleModel(codigo, descricao) {
  const normalizedCode = String(codigo || '').trim().toUpperCase();
  const normalizedDescription = String(descricao || '').trim().toUpperCase();
  return KEYWORDS.some((keyword) => normalizedCode.includes(keyword))
    && normalizedDescription.includes('SERVO');
}

async function main() {
  ensureTestSeedAllowed();

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const estoqueMontagem = await EstoqueModel.findStockByName(EstoqueModel.MONTAGEM_NOME, connection);
    if (!estoqueMontagem || Number(estoqueMontagem.ativo) !== 1) {
      throw new Error('Estoque da Montagem nao encontrado ou inativo.');
    }

    const [modelRows] = await connection.query(`
      SELECT
        p.id,
        p.codigo,
        p.descricao
      FROM pecas p
      WHERE p.classificacao = 'SUBMONTAGEM'
      ORDER BY p.codigo ASC
    `);

    const modelosElegiveis = modelRows.filter((row) => isEligibleModel(row.codigo, row.descricao));

    if (!modelosElegiveis.length) {
      throw new Error('Nenhum modelo elegivel foi encontrado para carga de teste.');
    }

    const requirementByComponent = new Map();

    for (const modelo of modelosElegiveis) {
      const [componentRows] = await connection.query(
        `
          SELECT
            es.id_item_componente,
            es.quantidade,
            p.codigo,
            p.descricao
          FROM estrutura_submontagem es
          INNER JOIN pecas p ON p.id = es.id_item_componente
          WHERE es.id_submontagem = ?
          ORDER BY p.codigo ASC
        `,
        [modelo.id]
      );

      for (const component of componentRows) {
        const current = requirementByComponent.get(component.id_item_componente) || {
          id_peca: Number(component.id_item_componente),
          codigo: component.codigo,
          descricao: component.descricao,
          quantidade_necessaria: 0
        };

        current.quantidade_necessaria = Number(
          (current.quantidade_necessaria + (Number(component.quantidade) * QUANTIDADE_TESTE_POR_MODELO)).toFixed(2)
        );

        requirementByComponent.set(component.id_item_componente, current);
      }
    }

    const ajustes = [];

    for (const requirement of requirementByComponent.values()) {
      const saldoAtual = await EstoqueModel.findSaldoForUpdate(
        connection,
        estoqueMontagem.id,
        requirement.id_peca
      );
      const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
      const quantidadeDestino = Math.max(quantidadeAtual, requirement.quantidade_necessaria);

      if (quantidadeDestino <= quantidadeAtual) {
        continue;
      }

      await EstoqueModel.persistSaldo(
        connection,
        estoqueMontagem.id,
        requirement.id_peca,
        quantidadeDestino,
        saldoAtual
      );

      await EstoqueModel.createMovimentacao(connection, {
        id_peca: requirement.id_peca,
        id_estoque_origem: null,
        id_estoque_destino: estoqueMontagem.id,
        tipo_movimentacao: 'AJUSTE',
        quantidade: Number((quantidadeDestino - quantidadeAtual).toFixed(2)),
        observacao: `Carga de teste para numeros de serie. Ajuste para permitir ${QUANTIDADE_TESTE_POR_MODELO} montagem(ns) de cada modelo elegivel.`
      });

      ajustes.push({
        codigo: requirement.codigo,
        descricao: requirement.descricao,
        saldo_anterior: quantidadeAtual,
        saldo_atual: quantidadeDestino
      });
    }

    await connection.commit();

    console.log(JSON.stringify({
      estoque: estoqueMontagem.nome,
      modelos_elegiveis: modelosElegiveis.length,
      componentes_ajustados: ajustes.length,
      ajustes
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
