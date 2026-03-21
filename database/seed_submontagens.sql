USE safisa;

-- Restaura as submontagens e suas estruturas padrao de demonstracao.
DELETE FROM estrutura_submontagem;
DELETE FROM pecas WHERE classificacao = 'SUBMONTAGEM';

INSERT INTO pecas (
  codigo,
  descricao,
  comprimento_mm,
  tipo,
  classificacao,
  id_materia_prima,
  id_fornecedor,
  id_maquina,
  estoque_minimo,
  estoque_seguranca,
  consumo_mensal,
  massa_kg
) VALUES
  ('SUB-001', 'Submontagem modular de fixacao 001', 420.00, 'PRODUZIDA', 'SUBMONTAGEM', 203, 12, 4, 6, 10, 22.00, 0),
  ('SUB-002', 'Submontagem guiada linear 002', 680.00, 'PRODUZIDA', 'SUBMONTAGEM', 121, 15, 7, 4, 8, 14.00, 0),
  ('SUB-003', 'Modulo de acionamento 003', 540.00, 'PRODUZIDA', 'SUBMONTAGEM', 211, 6, 14, 3, 6, 10.00, 0),
  ('SUB-004', 'Conjunto articulado base 004', 890.00, 'PRODUZIDA', 'SUBMONTAGEM', 244, 9, 8, 5, 8, 16.00, 0),
  ('SUB-005', 'Submontagem de ventilacao 005', 760.00, 'PRODUZIDA', 'SUBMONTAGEM', 276, 19, 12, 3, 5, 9.00, 0),
  ('SUB-006', 'Conjunto roletado 006', 520.00, 'PRODUZIDA', 'SUBMONTAGEM', 228, 20, 5, 4, 6, 12.00, 0),
  ('SUB-007', 'Modulo flangeado 007', 360.00, 'PRODUZIDA', 'SUBMONTAGEM', 233, 14, 11, 8, 12, 20.00, 0),
  ('SUB-008', 'Submontagem de painel 008', 920.00, 'PRODUZIDA', 'SUBMONTAGEM', 301, 10, 13, 2, 4, 8.00, 0),
  ('SUB-009', 'Kit de tirantes 009', 580.00, 'PRODUZIDA', 'SUBMONTAGEM', 244, 7, 11, 5, 8, 17.00, 0),
  ('SUB-010', 'Conjunto estrutural 010', 1320.00, 'PRODUZIDA', 'SUBMONTAGEM', 267, 18, 10, 2, 4, 7.00, 0),
  ('SUB-011', 'Modulo articulado 011', 845.00, 'PRODUZIDA', 'SUBMONTAGEM', 250, 6, 9, 3, 5, 11.00, 0),
  ('SUB-012', 'Submontagem roscada 012', 260.00, 'PRODUZIDA', 'SUBMONTAGEM', 107, 13, 5, 10, 14, 30.00, 0),
  ('SUB-013', 'Conjunto de transmissao 013', 640.00, 'PRODUZIDA', 'SUBMONTAGEM', 219, 8, 15, 2, 4, 8.00, 0),
  ('SUB-014', 'Montagem auxiliar 014', 470.00, 'PRODUZIDA', 'SUBMONTAGEM', 273, 12, 6, 4, 6, 13.00, 0),
  ('SUB-015', 'Kit reservatorio 015', 590.00, 'PRODUZIDA', 'SUBMONTAGEM', 299, 14, 12, 3, 5, 9.00, 0),
  ('SUB-016', 'Submontagem painel LED 016', 405.00, 'PRODUZIDA', 'SUBMONTAGEM', 302, 22, 3, 3, 5, 8.00, 0),
  ('SUB-017', 'Conjunto base soldada 017', 980.00, 'PRODUZIDA', 'SUBMONTAGEM', 295, 10, 8, 3, 5, 9.00, 0),
  ('SUB-018', 'Modulo de guias 018', 880.00, 'PRODUZIDA', 'SUBMONTAGEM', 240, 15, 13, 2, 4, 7.00, 0),
  ('SUB-019', 'Estrutura compacta 019', 780.00, 'PRODUZIDA', 'SUBMONTAGEM', 309, 8, 9, 4, 6, 10.00, 0),
  ('SUB-020', 'Conjunto terminal 020', 355.00, 'PRODUZIDA', 'SUBMONTAGEM', 111, 18, 4, 6, 10, 24.00, 0);

INSERT INTO estrutura_submontagem (
  id_submontagem,
  id_item_componente,
  quantidade,
  observacao
)
SELECT
  sub.id,
  item.id,
  mapa.quantidade,
  mapa.observacao
FROM (
  SELECT 'SUB-001' AS codigo_submontagem, 'PC-001' AS codigo_item, 8 AS quantidade, 'Fixacao principal' AS observacao UNION ALL
  SELECT 'SUB-001', 'SUP-AX45', 1, 'Suporte usinado' UNION ALL
  SELECT 'SUB-001', 'ARR-055', 8, 'Conjunto de arruelas' UNION ALL
  SELECT 'SUB-001', 'CH-200', 2, 'Travamento auxiliar' UNION ALL
  SELECT 'SUB-002', 'GUIA-31', 2, 'Guias lineares' UNION ALL
  SELECT 'SUB-002', 'PERF-9X', 1, 'Perfil estrutural' UNION ALL
  SELECT 'SUB-002', 'SUP-GR7', 2, 'Suportes roletados' UNION ALL
  SELECT 'SUB-002', 'FIX-H13', 6, 'Fixadores rapidos' UNION ALL
  SELECT 'SUB-003', 'MTR-1.5', 1, 'Motorredutor' UNION ALL
  SELECT 'SUB-003', 'FLG-904', 1, 'Flange de acoplamento' UNION ALL
  SELECT 'SUB-003', 'VAL-50', 1, 'Valvula de bloqueio' UNION ALL
  SELECT 'SUB-003', 'PC-001', 4, 'Parafusos de montagem' UNION ALL
  SELECT 'SUB-004', 'BR-120/A', 1, 'Braco articulado' UNION ALL
  SELECT 'SUB-004', 'CJ-AX12', 1, 'Conjunto articulado' UNION ALL
  SELECT 'SUB-004', 'PIN-02/B', 4, 'Pinos travantes' UNION ALL
  SELECT 'SUB-004', 'ARR-055', 4, 'Arruelas de apoio' UNION ALL
  SELECT 'SUB-005', 'CX-VENT', 1, 'Caixa de ventilacao' UNION ALL
  SELECT 'SUB-005', 'TAM-210', 1, 'Tampa superior' UNION ALL
  SELECT 'SUB-005', 'CH-200', 4, 'Chavetas internas' UNION ALL
  SELECT 'SUB-005', 'PC-001', 10, 'Parafusos de fixacao' UNION ALL
  SELECT 'SUB-006', 'ROL-778', 2, 'Roletes galvanizados' UNION ALL
  SELECT 'SUB-006', 'SUP-GR7', 2, 'Suportes de guia' UNION ALL
  SELECT 'SUB-006', 'EIX-870', 1, 'Eixo retificado' UNION ALL
  SELECT 'SUB-006', 'BCH-600', 2, 'Buchas autocentrantes' UNION ALL
  SELECT 'SUB-007', 'FLG-904', 2, 'Flanges de ligacao' UNION ALL
  SELECT 'SUB-007', 'TIR-AC8', 2, 'Tirantes regulaveis' UNION ALL
  SELECT 'SUB-007', 'DIS-019', 4, 'Discos espacadores' UNION ALL
  SELECT 'SUB-007', 'PRS-560', 4, 'Prisioneiros roscados' UNION ALL
  SELECT 'SUB-008', 'PAI-TRM', 1, 'Painel terminal' UNION ALL
  SELECT 'SUB-008', 'CHP-502', 1, 'Chapa lateral' UNION ALL
  SELECT 'SUB-008', 'FIX-H13', 12, 'Fixadores rapidos' UNION ALL
  SELECT 'SUB-008', 'CAB-480', 2, 'Cabos de acionamento' UNION ALL
  SELECT 'SUB-009', 'TIR-AC8', 2, 'Tirantes principais' UNION ALL
  SELECT 'SUB-009', 'PC-001', 6, 'Parafusos de fechamento' UNION ALL
  SELECT 'SUB-009', 'PIN-02/B', 2, 'Pinos travantes' UNION ALL
  SELECT 'SUB-009', 'ARR-055', 8, 'Arruelas de ajuste' UNION ALL
  SELECT 'SUB-010', 'EST-PL22', 1, 'Estrutura plana' UNION ALL
  SELECT 'SUB-010', 'TRV-300', 1, 'Travessa estrutural' UNION ALL
  SELECT 'SUB-010', 'PLA-770', 1, 'Placa base' UNION ALL
  SELECT 'SUB-010', 'MNT-88', 1, 'Montante principal' UNION ALL
  SELECT 'SUB-011', 'CJ-BR44', 1, 'Conjunto de bracadeira' UNION ALL
  SELECT 'SUB-011', 'BR-120/A', 1, 'Braco articulado' UNION ALL
  SELECT 'SUB-011', 'EIX-441', 1, 'Eixo de transmissao' UNION ALL
  SELECT 'SUB-011', 'ROL-TRX', 2, 'Roletes tracionadores' UNION ALL
  SELECT 'SUB-012', 'PRS-560', 10, 'Prisioneiros principais' UNION ALL
  SELECT 'SUB-012', 'DIS-019', 6, 'Discos de ajuste' UNION ALL
  SELECT 'SUB-012', 'PC-001', 12, 'Parafusos cabeca sextavada' UNION ALL
  SELECT 'SUB-012', 'FIX-H13', 10, 'Fixadores auxiliares' UNION ALL
  SELECT 'SUB-013', 'ENG-72A', 1, 'Engrenagem reta' UNION ALL
  SELECT 'SUB-013', 'COR-112', 1, 'Correia sincronizada' UNION ALL
  SELECT 'SUB-013', 'EIX-870', 1, 'Eixo principal' UNION ALL
  SELECT 'SUB-013', 'ALJ-430', 1, 'Alojamento frontal' UNION ALL
  SELECT 'SUB-014', 'CAM-605', 2, 'Camisas de protecao' UNION ALL
  SELECT 'SUB-014', 'JUN-45X', 4, 'Juntas tecnicas' UNION ALL
  SELECT 'SUB-014', 'VAL-50', 1, 'Valvula de bloqueio' UNION ALL
  SELECT 'SUB-014', 'FLG-904', 1, 'Flange de apoio' UNION ALL
  SELECT 'SUB-015', 'RES-801', 1, 'Reservatorio auxiliar' UNION ALL
  SELECT 'SUB-015', 'VAL-50', 1, 'Valvula de bloqueio' UNION ALL
  SELECT 'SUB-015', 'JUN-45X', 2, 'Juntas de vedacao' UNION ALL
  SELECT 'SUB-015', 'FCH-226', 1, 'Fechadura industrial' UNION ALL
  SELECT 'SUB-016', 'PAI-LED', 1, 'Painel sinalizador' UNION ALL
  SELECT 'SUB-016', 'PAI-TRM', 1, 'Painel terminal' UNION ALL
  SELECT 'SUB-016', 'CAB-480', 2, 'Cabos de acionamento' UNION ALL
  SELECT 'SUB-016', 'FIX-H13', 8, 'Fixadores rapidos' UNION ALL
  SELECT 'SUB-017', 'SUP-990', 1, 'Suporte de base' UNION ALL
  SELECT 'SUB-017', 'ALJ-430', 1, 'Alojamento frontal' UNION ALL
  SELECT 'SUB-017', 'TRI-320', 1, 'Trilho de apoio' UNION ALL
  SELECT 'SUB-017', 'PC-001', 10, 'Parafusos de montagem' UNION ALL
  SELECT 'SUB-018', 'GUIA-31', 2, 'Guias lineares' UNION ALL
  SELECT 'SUB-018', 'TRI-320', 1, 'Trilho de apoio' UNION ALL
  SELECT 'SUB-018', 'PERF-9X', 1, 'Perfil estrutural' UNION ALL
  SELECT 'SUB-018', 'ARR-055', 6, 'Arruelas de ajuste' UNION ALL
  SELECT 'SUB-019', 'CHP-908', 1, 'Chapa de reforco' UNION ALL
  SELECT 'SUB-019', 'EST-PL22', 1, 'Estrutura plana' UNION ALL
  SELECT 'SUB-019', 'TAM-210', 1, 'Tampa superior' UNION ALL
  SELECT 'SUB-019', 'PIN-02/B', 4, 'Pinos travantes' UNION ALL
  SELECT 'SUB-020', 'EMB-023', 1, 'Embalagem cartonada' UNION ALL
  SELECT 'SUB-020', 'EMB-ALFA', 1, 'Embalagem tecnica' UNION ALL
  SELECT 'SUB-020', 'FCH-226', 1, 'Fechadura industrial' UNION ALL
  SELECT 'SUB-020', 'FIX-H13', 6, 'Fixadores finais'
) AS mapa
INNER JOIN pecas sub
  ON sub.codigo = mapa.codigo_submontagem
  AND sub.classificacao = 'SUBMONTAGEM'
INNER JOIN pecas item
  ON item.codigo = mapa.codigo_item
  AND item.classificacao = 'ITEM';

UPDATE pecas sub
LEFT JOIN (
  SELECT
    es.id_submontagem,
    COALESCE(SUM(es.quantidade * p.massa_kg), 0) AS massa_total
  FROM estrutura_submontagem es
  INNER JOIN pecas p ON p.id = es.id_item_componente
  GROUP BY es.id_submontagem
) AS calculo
  ON calculo.id_submontagem = sub.id
SET sub.massa_kg = COALESCE(calculo.massa_total, 0)
WHERE sub.classificacao = 'SUBMONTAGEM';
