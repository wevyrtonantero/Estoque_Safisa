USE safisa;

-- Limpa totalmente as submontagens.
DELETE FROM estrutura_submontagem;
DELETE FROM pecas WHERE classificacao = 'SUBMONTAGEM';

ALTER TABLE estrutura_submontagem AUTO_INCREMENT = 1;
