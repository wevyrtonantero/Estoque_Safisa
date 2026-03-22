-- Seed minimo de maquinas para a base inicial real do SAFISA.
USE safisa;

DELETE FROM maquinas;

INSERT INTO maquinas (
  id,
  nome,
  tipo
) VALUES
  (1, 'CNC', 'USINAGEM'),
  (2, 'FRESA FERRAMENTEIRA', 'FRESA'),
  (3, 'TORNO CNC 01', 'TORNO CNC'),
  (4, 'TORNO CNC 02', 'TORNO CNC'),
  (5, 'TORNO CNC 03', 'TORNO CNC'),
  (6, 'TORNO CONVENCIONAL', 'TORNO');

ALTER TABLE maquinas AUTO_INCREMENT = 7;
