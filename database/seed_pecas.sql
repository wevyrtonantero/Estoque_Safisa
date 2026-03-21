USE safisa;

-- Limpa a base de pecas e dependencias.
DELETE FROM estrutura_submontagem;
DELETE FROM peca_fornecedor;
DELETE FROM estoque_movimentacoes;
DELETE FROM estoque_saldos;
DELETE FROM pecas;

ALTER TABLE estrutura_submontagem AUTO_INCREMENT = 1;
ALTER TABLE pecas AUTO_INCREMENT = 1;

-- A carga inicial real de pecas e estoque agora eh feita por:
-- node scripts/reset-real-initial-data.js
