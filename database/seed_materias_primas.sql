-- Seed minimo de materia-prima para a base inicial real do SAFISA.
USE safisa;

DELETE FROM materia_prima_fornecedor;
DELETE FROM materias_primas;

INSERT INTO materias_primas (
  id,
  codigo,
  nome,
  geometria,
  bitola,
  peso_por_metro,
  estoque_minimo
) VALUES
  (1, 'MP-GENERICA', 'MATERIA-PRIMA GENERICA', 'NA', 'NA', 0.0000, 0.000);

ALTER TABLE materias_primas AUTO_INCREMENT = 2;
