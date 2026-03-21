USE safisa;

-- Restaura os estoques operacionais com saldos sinteticos de demonstracao.
DELETE FROM estoque_movimentacoes;
DELETE FROM estoque_saldos;
DELETE FROM estoques WHERE nome = 'Inspeção';

INSERT INTO estoques (nome, descricao, ativo)
VALUES
  ('Almoxarifado', 'Estoque principal de itens e submontagens.', 1),
  ('Montagem', 'Estoque intermediario utilizado na montagem.', 1),
  ('Expedição', 'Estoque final para separacao e expedicao.', 1)
ON DUPLICATE KEY UPDATE
  descricao = VALUES(descricao),
  ativo = VALUES(ativo);

DROP TEMPORARY TABLE IF EXISTS tmp_estoque_base;

CREATE TEMPORARY TABLE tmp_estoque_base AS
SELECT
  p.id AS id_peca,
  p.classificacao,
  p.tipo,
  p.estoque_minimo,
  p.estoque_seguranca,
  ROW_NUMBER() OVER (ORDER BY p.classificacao, p.id) AS sequencia
FROM pecas p;

INSERT INTO estoque_saldos (
  id_estoque,
  id_peca,
  quantidade
)
SELECT
  estoque.id,
  base.id_peca,
  CASE
    WHEN base.classificacao = 'ITEM'
      THEN base.estoque_seguranca + (MOD(base.sequencia, 5) * 12) + 18
    ELSE base.estoque_minimo + (MOD(base.sequencia, 4) * 4) + 8
  END AS quantidade
FROM tmp_estoque_base base
INNER JOIN estoques estoque
  ON estoque.nome = 'Almoxarifado'
WHERE (
  CASE
    WHEN base.classificacao = 'ITEM'
      THEN base.estoque_seguranca + (MOD(base.sequencia, 5) * 12) + 18
    ELSE base.estoque_minimo + (MOD(base.sequencia, 4) * 4) + 8
  END
) > 0;

INSERT INTO estoque_saldos (
  id_estoque,
  id_peca,
  quantidade
)
SELECT
  estoque.id,
  base.id_peca,
  CASE
    WHEN base.classificacao = 'ITEM' AND base.tipo = 'PRODUZIDA'
      THEN base.estoque_minimo + (MOD(base.sequencia, 6) * 3) + 6
    WHEN base.classificacao = 'ITEM'
      THEN MOD(base.sequencia, 4) * 3
    ELSE base.estoque_minimo + (MOD(base.sequencia, 5) * 2) + 4
  END AS quantidade
FROM tmp_estoque_base base
INNER JOIN estoques estoque
  ON estoque.nome = 'Montagem'
WHERE (
  CASE
    WHEN base.classificacao = 'ITEM' AND base.tipo = 'PRODUZIDA'
      THEN base.estoque_minimo + (MOD(base.sequencia, 6) * 3) + 6
    WHEN base.classificacao = 'ITEM'
      THEN MOD(base.sequencia, 4) * 3
    ELSE base.estoque_minimo + (MOD(base.sequencia, 5) * 2) + 4
  END
) > 0;

INSERT INTO estoque_saldos (
  id_estoque,
  id_peca,
  quantidade
)
SELECT
  estoque.id,
  base.id_peca,
  CASE
    WHEN base.classificacao = 'ITEM' AND base.tipo = 'PRODUZIDA'
      THEN MOD(base.sequencia, 5) * 2 + 2
    WHEN base.classificacao = 'SUBMONTAGEM'
      THEN MOD(base.sequencia, 4) * 2 + 1
    ELSE MOD(base.sequencia, 3)
  END AS quantidade
FROM tmp_estoque_base base
INNER JOIN estoques estoque
  ON estoque.nome = 'Expedição'
WHERE (
  CASE
    WHEN base.classificacao = 'ITEM' AND base.tipo = 'PRODUZIDA'
      THEN MOD(base.sequencia, 5) * 2 + 2
    WHEN base.classificacao = 'SUBMONTAGEM'
      THEN MOD(base.sequencia, 4) * 2 + 1
    ELSE MOD(base.sequencia, 3)
  END
) > 0;

INSERT INTO estoque_movimentacoes (
  id_peca,
  id_estoque_origem,
  id_estoque_destino,
  tipo_movimentacao,
  quantidade,
  observacao
)
SELECT
  saldo.id_peca,
  NULL,
  saldo.id_estoque,
  'ENTRADA_INICIAL',
  saldo.quantidade,
  'Carga inicial do seed de estoques'
FROM estoque_saldos saldo;

DROP TEMPORARY TABLE IF EXISTS tmp_estoque_base;
