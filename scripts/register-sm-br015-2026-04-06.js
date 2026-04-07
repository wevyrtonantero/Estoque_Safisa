const { pool } = require('../database/connection');
const SubmontagemModel = require('../src/models/SubmontagemModel');
const {
  submontagem,
  components,
  assumptions
} = require('./data/sm-br015-2026-04-06');

async function findByCodigo(codigo) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        codigo,
        descricao,
        classificacao
      FROM pecas
      WHERE codigo = ?
      LIMIT 1
    `,
    [codigo]
  );

  return rows[0] || null;
}

async function main() {
  const componentesResolvidos = [];

  for (const component of components) {
    const item = await findByCodigo(component.codigo);
    if (!item) {
      throw new Error(`Componente nao encontrado para o SM-BR015: ${component.codigo}`);
    }

    componentesResolvidos.push({
      id_item_componente: Number(item.id),
      quantidade: component.quantidade,
      observacao: null
    });
  }

  const existing = await findByCodigo(submontagem.codigo);

  const saved = existing
    ? await SubmontagemModel.update(existing.id, submontagem, componentesResolvidos)
    : await SubmontagemModel.create(submontagem, componentesResolvidos);

  if (!saved) {
    throw new Error('Nao foi possivel salvar o SM-BR015.');
  }

  console.log(JSON.stringify({
    codigo: saved.codigo,
    descricao: saved.descricao,
    total_componentes: componentesResolvidos.length,
    assumptions
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
