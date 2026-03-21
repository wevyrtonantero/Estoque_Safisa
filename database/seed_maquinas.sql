-- Seed de maquinas para testes do modulo administrativo.
USE safisa;

DELETE FROM maquinas;

INSERT INTO maquinas (
  id,
  nome,
  tipo
)
SELECT
  numero,
  CONCAT(
    CASE MOD(numero, 8)
      WHEN 0 THEN 'Prensa'
      WHEN 1 THEN 'Torno'
      WHEN 2 THEN 'Furadeira'
      WHEN 3 THEN 'Dobradeira'
      WHEN 4 THEN 'Centro de Usinagem'
      WHEN 5 THEN 'Corte Laser'
      WHEN 6 THEN 'Rosqueadeira'
      ELSE 'Serra'
    END,
    ' ',
    LPAD(numero, 3, '0')
  ),
  CASE MOD(numero, 7)
    WHEN 0 THEN 'Usinagem'
    WHEN 1 THEN 'Corte'
    WHEN 2 THEN 'Dobra'
    WHEN 3 THEN 'Furacao'
    WHEN 4 THEN 'Prensagem'
    WHEN 5 THEN 'Acabamento'
    ELSE 'Preparacao'
  END
FROM (
  SELECT ones.n + (tens.n * 10) + 1 AS numero
  FROM
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) ones
  CROSS JOIN
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) tens
) sequencia
WHERE numero <= 70
ORDER BY numero;

ALTER TABLE maquinas AUTO_INCREMENT = 71;
