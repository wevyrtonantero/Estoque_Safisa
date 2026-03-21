-- Seed minimo de maquinas para a base inicial real do SAFISA.
USE safisa;

DELETE FROM maquinas;

INSERT INTO maquinas (
  id,
  nome,
  tipo
) VALUES
  (1, 'CNC', 'USINAGEM');

ALTER TABLE maquinas AUTO_INCREMENT = 2;
