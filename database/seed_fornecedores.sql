-- Seed de fornecedores para testes do modulo administrativo.
USE safisa;

DELETE FROM fornecedores;

INSERT INTO fornecedores (
  id,
  nome,
  telefone,
  contato,
  email,
  cep,
  endereco,
  cidade,
  observacao
)
SELECT
  numero,
  CONCAT(
    CASE MOD(numero, 10)
      WHEN 0 THEN 'Metal Sul'
      WHEN 1 THEN 'Aco Forte'
      WHEN 2 THEN 'Industrial Prime'
      WHEN 3 THEN 'Tecno Supply'
      WHEN 4 THEN 'Base Estrutural'
      WHEN 5 THEN 'Uniao Industrial'
      WHEN 6 THEN 'Linha Metal'
      WHEN 7 THEN 'Polo Tecnico'
      WHEN 8 THEN 'Eixo Comercial'
      ELSE 'Fusion Parts'
    END,
    ' ',
    LPAD(numero, 3, '0')
  ),
  CONCAT('(11) 4', LPAD(numero, 3, '0'), '-', LPAD(numero * 13, 4, '0')),
  CONCAT(
    CASE MOD(numero, 8)
      WHEN 0 THEN 'Carlos'
      WHEN 1 THEN 'Marina'
      WHEN 2 THEN 'Fabio'
      WHEN 3 THEN 'Renata'
      WHEN 4 THEN 'Joao'
      WHEN 5 THEN 'Paula'
      WHEN 6 THEN 'Silvio'
      ELSE 'Camila'
    END,
    ' ',
    CASE MOD(numero, 6)
      WHEN 0 THEN 'Lima'
      WHEN 1 THEN 'Souza'
      WHEN 2 THEN 'Alves'
      WHEN 3 THEN 'Moraes'
      WHEN 4 THEN 'Fernandes'
      ELSE 'Rocha'
    END
  ),
  CONCAT('contato', LPAD(numero, 3, '0'), '@fornecedor-industrial.com.br'),
  CONCAT(LPAD(10 + MOD(numero, 90), 2, '0'), '.', LPAD(100 + MOD(numero * 7, 900), 3, '0'), '-000'),
  CONCAT('Rua Industrial ', numero, ', Galpao ', MOD(numero, 12) + 1),
  CASE MOD(numero, 8)
    WHEN 0 THEN 'Sao Paulo'
    WHEN 1 THEN 'Campinas'
    WHEN 2 THEN 'Sorocaba'
    WHEN 3 THEN 'Jundiai'
    WHEN 4 THEN 'Sao Jose dos Campos'
    WHEN 5 THEN 'Contagem'
    WHEN 6 THEN 'Joinville'
    ELSE 'Caxias do Sul'
  END,
  CONCAT('Fornecedor industrial seedado para testes do modulo. Registro ', LPAD(numero, 3, '0'))
FROM (
  SELECT ones.n + (tens.n * 10) + 1 AS numero
  FROM
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) ones
  CROSS JOIN
    (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) tens
) sequencia
WHERE numero <= 60
ORDER BY numero;

ALTER TABLE fornecedores AUTO_INCREMENT = 61;
