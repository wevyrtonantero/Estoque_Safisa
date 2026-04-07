const { pool } = require('../database/connection');
const SubmontagemModel = require('../src/models/SubmontagemModel');
const {
  auxSubmontagens,
  kits,
  assumptions
} = require('./data/kits-pendentes-2026-04-06');

async function findPecaByCodigo(codigo) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        codigo,
        descricao,
        classificacao,
        tipo
      FROM pecas
      WHERE codigo = ?
      LIMIT 1
    `,
    [codigo]
  );

  return rows[0] || null;
}

async function saveSubmontagem(definition) {
  const componentes = [];

  for (const component of definition.componentes) {
    const item = await findPecaByCodigo(component.codigo);
    if (!item) {
      throw new Error(`Componente nao encontrado para ${definition.codigo}: ${component.codigo}`);
    }

    componentes.push({
      id_item_componente: Number(item.id),
      quantidade: component.quantidade,
      observacao: null
    });
  }

  const existing = await findPecaByCodigo(definition.codigo);
  const payload = {
    codigo: definition.codigo,
    descricao: definition.descricao,
    comprimento_mm: null,
    id_materia_prima: null,
    id_fornecedor: null,
    id_maquina: null,
    estoque_minimo: null,
    estoque_seguranca: null,
    consumo_mensal: null
  };

  return existing
    ? SubmontagemModel.update(existing.id, payload, componentes)
    : SubmontagemModel.create(payload, componentes);
}

async function main() {
  const savedAux = [];
  const savedKits = [];

  for (const definition of auxSubmontagens) {
    const saved = await saveSubmontagem(definition);
    savedAux.push({
      codigo: saved.codigo,
      descricao: saved.descricao,
      total_componentes: definition.componentes.length
    });
  }

  for (const definition of kits) {
    const saved = await saveSubmontagem(definition);
    savedKits.push({
      codigo: saved.codigo,
      descricao: saved.descricao,
      total_componentes: definition.componentes.length
    });
  }

  console.log(JSON.stringify({
    assumptions,
    aux_submontagens: savedAux,
    kits: savedKits
  }, null, 2));
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error.message || error);
    await pool.end();
    process.exit(1);
  });
