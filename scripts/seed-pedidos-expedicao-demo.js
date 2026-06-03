const { pool } = require('../database/connection');
const EstoqueModel = require('../src/models/EstoqueModel');
const PedidoExpedicaoModel = require('../src/models/PedidoExpedicaoModel');
const SubmontagemSerialModel = require('../src/models/SubmontagemSerialModel');
const ComposicaoVendaModel = require('../src/models/ComposicaoVendaModel');

const TRANSPORTADORAS = ['Rodonaves', 'Braspress', 'Itinerante', 'Sedex', 'Retira', 'Safisa'];
const EXTRA_SUPPORT_CODES = ['MBF015'];
const CLIENTES = [
  { cliente: 'Auto Pecas Brasil', cidade: 'Jundiai/SP', vendedora: 'Regiane' },
  { cliente: 'Freios Campinas', cidade: 'Campinas/SP', vendedora: 'Marcela' },
  { cliente: 'Truck Center Itu', cidade: 'Itu/SP', vendedora: 'Regiane' },
  { cliente: 'Mec Diesel Sorocaba', cidade: 'Sorocaba/SP', vendedora: 'Marcela' },
  { cliente: 'Retifica Paulista', cidade: 'Osasco/SP', vendedora: 'Daniele' },
  { cliente: 'Auto Parts Interior', cidade: 'Limeira/SP', vendedora: 'Regiane' }
];

function ensureTestSeedAllowed() {
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('Script demo bloqueado em NODE_ENV=production.');
  }

  if (process.env.SAFISA_ALLOW_TEST_SEED !== '1') {
    throw new Error('Script demo bloqueado. Defina SAFISA_ALLOW_TEST_SEED=1 para executar em ambiente local de teste.');
  }
}

const PEDIDO_TEMPLATES = [
  [{ codigo: '1A', quantidade: 2 }, { codigo: '10A', quantidade: 1 }, { codigo: 'R064', quantidade: 2 }, { codigo: 'KT-48', quantidade: 1 }],
  [{ codigo: '1B', quantidade: 2 }, { codigo: '3A', quantidade: 1 }, { codigo: 'R064', quantidade: 1 }, { codigo: 'KT-14', quantidade: 1 }, { codigo: 'KT-02', quantidade: 1 }],
  [{ codigo: '1C', quantidade: 3 }, { codigo: '11B', quantidade: 2 }, { codigo: 'R064', quantidade: 1 }, { codigo: 'KT-92', quantidade: 1 }],
  [{ codigo: '7E', quantidade: 2 }, { codigo: '10B', quantidade: 1 }, { codigo: 'R064', quantidade: 2 }, { codigo: 'KT-35', quantidade: 2 }],
  [{ codigo: '3B', quantidade: 2 }, { codigo: '12A', quantidade: 1 }, { codigo: 'R064', quantidade: 1 }, { codigo: 'KT-12A', quantidade: 1 }, { codigo: 'KT-15', quantidade: 1 }],
  [{ codigo: '1A', quantidade: 1 }, { codigo: '7F', quantidade: 2 }, { codigo: 'R064', quantidade: 3 }, { codigo: 'KT-37', quantidade: 1 }],
  [{ codigo: '10A', quantidade: 2 }, { codigo: '11B', quantidade: 1 }, { codigo: 'R064', quantidade: 2 }, { codigo: 'KT-48', quantidade: 2 }, { codigo: 'KT-92', quantidade: 1 }],
  [{ codigo: '1B', quantidade: 1 }, { codigo: '3A', quantidade: 2 }, { codigo: '12A', quantidade: 1 }, { codigo: 'R064', quantidade: 1 }],
  [{ codigo: '1C', quantidade: 2 }, { codigo: '10B', quantidade: 2 }, { codigo: 'R064', quantidade: 2 }, { codigo: 'KT-75', quantidade: 1 }],
  [{ codigo: '7E', quantidade: 1 }, { codigo: '3B', quantidade: 1 }, { codigo: '11B', quantidade: 2 }, { codigo: 'R064', quantidade: 2 }, { codigo: 'KT-15', quantidade: 1 }],
  [{ codigo: '1A', quantidade: 2 }, { codigo: '12A', quantidade: 2 }, { codigo: 'R064', quantidade: 2 }, { codigo: 'KT-01', quantidade: 1 }, { codigo: 'KT-12A', quantidade: 1 }],
  [{ codigo: '10A', quantidade: 1 }, { codigo: '10B', quantidade: 1 }, { codigo: '7F', quantidade: 1 }, { codigo: 'R064', quantidade: 1 }, { codigo: 'KT-37', quantidade: 1 }],
  [{ codigo: '3A', quantidade: 1 }, { codigo: '3B', quantidade: 1 }, { codigo: '1B', quantidade: 2 }, { codigo: 'R064', quantidade: 2 }, { codigo: 'KT-14', quantidade: 1 }],
  [{ codigo: '11B', quantidade: 3 }, { codigo: '12A', quantidade: 1 }, { codigo: 'R064', quantidade: 2 }, { codigo: 'KT-92', quantidade: 1 }],
  [{ codigo: '1A', quantidade: 1 }, { codigo: '1C', quantidade: 1 }, { codigo: '7E', quantidade: 1 }, { codigo: '10A', quantidade: 1 }, { codigo: 'R064', quantidade: 4 }, { codigo: 'KT-48', quantidade: 1 }]
];

function buildOrderCodePrefix() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `DEMO-${year}${month}${day}${hour}${minute}${second}`;
}

async function fetchPecasByCodes(codes, connection) {
  const uniqueCodes = [...new Set(codes.map((codigo) => String(codigo).trim().toUpperCase()))];
  const placeholders = uniqueCodes.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `
      SELECT id, codigo, descricao, classificacao, massa_kg
      FROM pecas
      WHERE UPPER(codigo) IN (${placeholders})
    `,
    uniqueCodes
  );

  const map = new Map();
  rows.forEach((row) => {
    map.set(String(row.codigo).trim().toUpperCase(), {
      id: Number(row.id),
      codigo: row.codigo,
      descricao: row.descricao,
      classificacao: row.classificacao,
      massa_kg: row.massa_kg === null ? null : Number(row.massa_kg)
    });
  });

  return map;
}

function addRequired(map, idPeca, codigo, descricao, quantidade) {
  const current = map.get(idPeca) || {
    id_peca: Number(idPeca),
    codigo,
    descricao,
    quantidade: 0
  };

  current.quantidade = Number((current.quantidade + Number(quantidade || 0)).toFixed(2));
  map.set(idPeca, current);
}

async function buildRequirements(templates, pecasByCode, connection) {
  const itemIds = templates
    .flatMap((items) => items)
    .map((item) => {
      const peca = pecasByCode.get(String(item.codigo).trim().toUpperCase());
      return peca ? peca.id : null;
    })
    .filter((value) => Number.isInteger(value));

  const composicoes = await ComposicaoVendaModel.findAll({
    ids_item_venda: [...new Set(itemIds)]
  }, connection);

  const composicaoPorItemVenda = new Map();
  composicoes.forEach((linha) => {
    const idItemVenda = Number(linha.id_item_venda);
    if (!composicaoPorItemVenda.has(idItemVenda)) {
      composicaoPorItemVenda.set(idItemVenda, []);
    }
    composicaoPorItemVenda.get(idItemVenda).push(linha);
  });

  const modelosSerial = new Map();
  const avulsosExpedicao = new Map();

  templates.forEach((items) => {
    items.forEach((item) => {
      const peca = pecasByCode.get(String(item.codigo).trim().toUpperCase());
      if (!peca) {
        return;
      }

      const composicao = composicaoPorItemVenda.get(peca.id) || [];
      const linhaSerial = composicao.find((linha) => SubmontagemSerialModel.isEligibleModel(
        linha.item_atende_codigo,
        linha.item_atende_descricao
      ));

      if (linhaSerial) {
        addRequired(
          modelosSerial,
          Number(linhaSerial.id_item_atende),
          linhaSerial.item_atende_codigo,
          linhaSerial.item_atende_descricao,
          Number(item.quantidade) * Number(linhaSerial.quantidade || 1)
        );

        composicao
          .filter((linha) => Number(linha.id_item_atende) !== Number(linhaSerial.id_item_atende))
          .forEach((linha) => {
            addRequired(
              avulsosExpedicao,
              Number(linha.id_item_atende),
              linha.item_atende_codigo,
              linha.item_atende_descricao,
              Number(item.quantidade) * Number(linha.quantidade || 1)
            );
          });
        return;
      }

      if (SubmontagemSerialModel.isEligibleModel(peca.codigo, peca.descricao)) {
        addRequired(modelosSerial, peca.id, peca.codigo, peca.descricao, Number(item.quantidade));
      } else {
        addRequired(avulsosExpedicao, peca.id, peca.codigo, peca.descricao, Number(item.quantidade));
      }
    });
  });

  const mbf015 = pecasByCode.get('MBF015');
  if (mbf015) {
    const atual = modelosSerial.get(mbf015.id) || {
      id_peca: mbf015.id,
      codigo: mbf015.codigo,
      descricao: mbf015.descricao,
      quantidade: 0
    };
    atual.quantidade = Math.max(atual.quantidade, 50);
    modelosSerial.set(mbf015.id, atual);
  }

  const r064 = pecasByCode.get('R064');
  if (r064) {
    const atual = avulsosExpedicao.get(r064.id) || {
      id_peca: r064.id,
      codigo: r064.codigo,
      descricao: r064.descricao,
      quantidade: 0
    };
    atual.quantidade = Math.max(atual.quantidade, 50);
    avulsosExpedicao.set(r064.id, atual);
  }

  return {
    modelosSerial,
    avulsosExpedicao
  };
}

async function ensureMontagemForSerialModels(modelosSerial, connection) {
  const estoqueMontagem = await EstoqueModel.findStockByName(EstoqueModel.MONTAGEM_NOME, connection);
  if (!estoqueMontagem || Number(estoqueMontagem.ativo) !== 1) {
    throw new Error('Estoque da Montagem nao encontrado ou inativo.');
  }

  const requirementByComponent = new Map();

  for (const modelo of modelosSerial.values()) {
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
      [modelo.id_peca]
    );

    if (!componentRows.length) {
      continue;
    }

    componentRows.forEach((component) => {
      const current = requirementByComponent.get(Number(component.id_item_componente)) || {
        id_peca: Number(component.id_item_componente),
        codigo: component.codigo,
        descricao: component.descricao,
        quantidade_necessaria: 0
      };

      current.quantidade_necessaria = Number(
        (
          current.quantidade_necessaria
          + (Number(component.quantidade || 0) * Number(modelo.quantidade || 0))
        ).toFixed(2)
      );
      requirementByComponent.set(current.id_peca, current);
    });
  }

  const ajustes = [];

  for (const requirement of requirementByComponent.values()) {
    const saldoAtual = await EstoqueModel.findSaldoForUpdate(connection, estoqueMontagem.id, requirement.id_peca);
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
      observacao: 'Carga de teste para pedidos da expedicao com numeros de serie.'
    });

    ajustes.push({
      codigo: requirement.codigo,
      saldo_anterior: quantidadeAtual,
      saldo_atual: quantidadeDestino
    });
  }

  return {
    estoque: estoqueMontagem.nome,
    componentes_ajustados: ajustes.length,
    ajustes
  };
}

async function ensureExpedicaoStock(avulsosExpedicao, connection) {
  const estoqueExpedicao = await EstoqueModel.findStockByName(EstoqueModel.EXPEDICAO_NOME, connection);
  if (!estoqueExpedicao || Number(estoqueExpedicao.ativo) !== 1) {
    throw new Error('Estoque da Expedicao nao encontrado ou inativo.');
  }

  const ajustes = [];

  for (const requirement of avulsosExpedicao.values()) {
    const quantidadeAlvo = Math.max(Number(requirement.quantidade || 0), requirement.codigo === 'R064' ? 50 : 0);
    const saldoAtual = await EstoqueModel.findSaldoForUpdate(connection, estoqueExpedicao.id, requirement.id_peca);
    const quantidadeAtual = saldoAtual ? Number(saldoAtual.quantidade) : 0;
    const quantidadeDestino = Math.max(quantidadeAtual, quantidadeAlvo);

    if (quantidadeDestino <= quantidadeAtual) {
      continue;
    }

    await EstoqueModel.persistSaldo(
      connection,
      estoqueExpedicao.id,
      requirement.id_peca,
      quantidadeDestino,
      saldoAtual
    );

    await EstoqueModel.createMovimentacao(connection, {
      id_peca: requirement.id_peca,
      id_estoque_origem: null,
      id_estoque_destino: estoqueExpedicao.id,
      tipo_movimentacao: 'AJUSTE',
      quantidade: Number((quantidadeDestino - quantidadeAtual).toFixed(2)),
      observacao: 'Carga de teste para separacao de pedidos da expedicao.'
    });

    ajustes.push({
      codigo: requirement.codigo,
      saldo_anterior: quantidadeAtual,
      saldo_atual: quantidadeDestino
    });
  }

  return {
    estoque: estoqueExpedicao.nome,
    itens_ajustados: ajustes.length,
    ajustes
  };
}

async function createPedidos(prefix, templates, pecasByCode) {
  const created = [];

  for (let index = 0; index < templates.length; index += 1) {
    const items = templates[index];
    const cliente = CLIENTES[index % CLIENTES.length];
    const transportadora = TRANSPORTADORAS[index % TRANSPORTADORAS.length];
    const codigoPedido = `${prefix}-${String(index + 1).padStart(2, '0')}`;

    const pedido = await PedidoExpedicaoModel.create({
      codigo_pedido: codigoPedido,
      cliente_nome: cliente.cliente,
      cidade: cliente.cidade,
      data_pedido: '2026-05-23',
      observacao: `Pedido ficticio criado para testes do fluxo de expedicao (${index + 1}/15).`,
      possui_nota_fiscal: index % 4 !== 0,
      transportadora,
      vendedora: cliente.vendedora,
      itens: items.map((item) => {
        const peca = pecasByCode.get(String(item.codigo).trim().toUpperCase());
        if (!peca) {
          throw new Error(`Nao foi possivel localizar a peca ${item.codigo} para o pedido ${codigoPedido}.`);
        }

        return {
          id_peca: peca.id,
          quantidade: Number(item.quantidade)
        };
      })
    });

    created.push({
      id: pedido.id,
      codigo_pedido: pedido.codigo_pedido,
      cliente_nome: pedido.cliente_nome,
      total_itens: pedido.total_itens,
      status: pedido.status
    });
  }

  return created;
}

async function main() {
  ensureTestSeedAllowed();

  const connection = await pool.getConnection();

  try {
    const allCodes = [...new Set([
      ...PEDIDO_TEMPLATES.flatMap((items) => items.map((item) => item.codigo)),
      ...EXTRA_SUPPORT_CODES
    ])];
    const pecasByCode = await fetchPecasByCodes(allCodes, connection);

    const missingCodes = allCodes.filter((codigo) => !pecasByCode.has(String(codigo).trim().toUpperCase()));
    if (missingCodes.length) {
      throw new Error(`Codigos nao encontrados para a carga: ${missingCodes.join(', ')}`);
    }

    const requirements = await buildRequirements(PEDIDO_TEMPLATES, pecasByCode, connection);

    await connection.beginTransaction();
    const montagemResult = await ensureMontagemForSerialModels(requirements.modelosSerial, connection);
    const expedicaoResult = await ensureExpedicaoStock(requirements.avulsosExpedicao, connection);
    await connection.commit();

    const createdPedidos = await createPedidos(buildOrderCodePrefix(), PEDIDO_TEMPLATES, pecasByCode);

    console.log(JSON.stringify({
      estoque_montagem: montagemResult,
      estoque_expedicao: expedicaoResult,
      modelos_seriais_preparados: [...requirements.modelosSerial.values()],
      avulsos_preparados: [...requirements.avulsosExpedicao.values()],
      pedidos_criados: createdPedidos.length,
      pedidos: createdPedidos
    }, null, 2));
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {
      // Sem acao adicional.
    }
    throw error;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  buildRequirements,
  buildOrderCodePrefix
};
