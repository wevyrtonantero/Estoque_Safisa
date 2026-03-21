-- Seed de materias-primas e vinculos com fornecedores.
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
)
SELECT
  numero,
  CONCAT('MP-', LPAD(numero, 3, '0')),
  CONCAT(
    CASE MOD(numero, 10)
      WHEN 0 THEN 'Aco carbono'
      WHEN 1 THEN 'Aluminio estrutural'
      WHEN 2 THEN 'Tubo galvanizado'
      WHEN 3 THEN 'Perfil inox'
      WHEN 4 THEN 'Barra trefilada'
      WHEN 5 THEN 'Chapa laminada'
      WHEN 6 THEN 'Redondo mecanico'
      WHEN 7 THEN 'Cantoneira'
      WHEN 8 THEN 'Perfil U'
      ELSE 'Tubo schedule'
    END,
    ' ',
    LPAD(numero, 3, '0')
  ),
  CASE MOD(numero, 6)
    WHEN 0 THEN 'BARRA REDONDA'
    WHEN 1 THEN 'CHAPA'
    WHEN 2 THEN 'TUBO'
    WHEN 3 THEN 'PERFIL U'
    WHEN 4 THEN 'CANTONEIRA'
    ELSE 'BARRA CHATA'
  END,
  CASE MOD(numero, 8)
    WHEN 0 THEN '3/8'
    WHEN 1 THEN '1/2'
    WHEN 2 THEN '3/4'
    WHEN 3 THEN '1'
    WHEN 4 THEN '30x30x2'
    WHEN 5 THEN '40x20x2'
    WHEN 6 THEN '50x50x3'
    ELSE '60x40x3'
  END,
  ROUND(0.4200 + (MOD(numero, 17) * 0.1735), 4),
  ROUND(MOD(numero, 14) * 18.750, 3)
FROM (
  SELECT ones.n + (tens.n * 10) + (hundreds.n * 100) + 1 AS numero
  FROM
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) ones
  CROSS JOIN
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) tens
  CROSS JOIN
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) hundreds
) sequencia
WHERE numero <= 450
ORDER BY numero;

ALTER TABLE materias_primas AUTO_INCREMENT = 451;

-- Cada materia-prima recebe de 1 a 3 fornecedores sem duplicidade.
INSERT INTO materia_prima_fornecedor (
  id_materia_prima,
  id_fornecedor,
  observacao
)
SELECT
  mp.id,
  ((mp.id - 1) MOD 60) + 1,
  'Fornecedor principal da materia-prima'
FROM materias_primas mp;

INSERT INTO materia_prima_fornecedor (
  id_materia_prima,
  id_fornecedor,
  observacao
)
SELECT
  mp.id,
  ((mp.id + 7) MOD 60) + 1,
  'Fornecedor alternativo homologado'
FROM materias_primas mp
WHERE MOD(mp.id, 2) = 0;

INSERT INTO materia_prima_fornecedor (
  id_materia_prima,
  id_fornecedor,
  observacao
)
SELECT
  mp.id,
  ((mp.id + 19) MOD 60) + 1,
  'Fornecedor reserva para negociacao'
FROM materias_primas mp
WHERE MOD(mp.id, 5) = 0;
