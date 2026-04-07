const fs = require('fs');
const path = require('path');

const { pool } = require('../database/connection');
const ComposicaoVendaModel = require('../src/models/ComposicaoVendaModel');

function parseLine(line, lineNumber) {
  const parts = line.split('|').map((entry) => entry.trim());

  if (parts.length !== 3) {
    throw new Error(`Linha ${lineNumber}: formato invalido. Use CODIGO_VENDA | QTD | CODIGO_ATENDE.`);
  }

  const [codigoVenda, quantidadeRaw, codigoAtende] = parts;
  const quantidade = Number.parseFloat(String(quantidadeRaw).replace(',', '.'));

  if (!codigoVenda || !codigoAtende) {
    throw new Error(`Linha ${lineNumber}: informe o codigo de venda e o codigo que atende.`);
  }

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error(`Linha ${lineNumber}: a quantidade deve ser maior que zero.`);
  }

  return {
    codigo_venda: codigoVenda,
    quantidade,
    codigo_atende: codigoAtende
  };
}

async function findItemByCodigo(codigo, connection) {
  const [rows] = await connection.query(
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
  const inputPath = process.argv[2];

  if (!inputPath) {
    throw new Error('Informe o caminho do arquivo txt/csv com as composicoes de venda.');
  }

  const absolutePath = path.resolve(process.cwd(), inputPath);
  const rawContent = fs.readFileSync(absolutePath, 'utf8');
  const lines = rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !/^CODIGO_VENDA/i.test(line));

  if (!lines.length) {
    throw new Error('Nenhuma linha valida encontrada no arquivo informado.');
  }

  const parsed = lines.map((line, index) => parseLine(line, index + 1));
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ComposicaoVendaModel.ensureSchema(connection);

    const itensVendaPorCodigo = new Map();
    const itensAtendePorCodigo = new Map();

    for (const row of parsed) {
      if (!itensVendaPorCodigo.has(row.codigo_venda)) {
        const itemVenda = await findItemByCodigo(row.codigo_venda, connection);
        if (!itemVenda) {
          throw new Error(`Codigo de venda nao encontrado: ${row.codigo_venda}`);
        }
        itensVendaPorCodigo.set(row.codigo_venda, itemVenda);
      }

      if (!itensAtendePorCodigo.has(row.codigo_atende)) {
        const itemAtende = await findItemByCodigo(row.codigo_atende, connection);
        if (!itemAtende) {
          throw new Error(`Codigo que atende nao encontrado: ${row.codigo_atende}`);
        }
        itensAtendePorCodigo.set(row.codigo_atende, itemAtende);
      }
    }

    const idsVenda = Array.from(new Set(parsed.map((row) => itensVendaPorCodigo.get(row.codigo_venda).id)));

    if (idsVenda.length > 0) {
      await connection.query(
        `DELETE FROM composicoes_venda WHERE id_item_venda IN (${idsVenda.map(() => '?').join(', ')})`,
        idsVenda
      );
    }

    for (const row of parsed) {
      const itemVenda = itensVendaPorCodigo.get(row.codigo_venda);
      const itemAtende = itensAtendePorCodigo.get(row.codigo_atende);

      await connection.query(
        `
          INSERT INTO composicoes_venda (
            id_item_venda,
            id_item_atende,
            quantidade,
            ordem
          ) VALUES (?, ?, ?, ?)
        `,
        [itemVenda.id, itemAtende.id, row.quantidade, 0]
      );
    }

    await connection.commit();

    console.log(JSON.stringify({
      arquivo: absolutePath,
      linhas_processadas: parsed.length,
      itens_venda_atualizados: idsVenda.length
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
    console.error(error.message || error);
    process.exit(1);
  });
