USE safisa;

-- Limpa os estoques e mantem apenas os locais operacionais padrao.
DELETE FROM estoque_movimentacoes;
DELETE FROM estoque_saldos;
DELETE FROM estoques WHERE nome IN ('Inspecao', 'Inspeção');

INSERT INTO estoques (nome, descricao, ativo)
VALUES
  ('Almoxarifado', 'Estoque principal de itens e submontagens.', 1),
  ('Montagem', 'Estoque intermediario utilizado na montagem.', 1),
  ('Expedição', 'Estoque final para separacao e expedicao.', 1)
ON DUPLICATE KEY UPDATE
  descricao = VALUES(descricao),
  ativo = VALUES(ativo);

-- A carga inicial real de estoque agora eh feita por:
-- node scripts/reset-real-initial-data.js
