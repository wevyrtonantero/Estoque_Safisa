USE safisa;

-- Reinicia as tabelas para deixar a base pronta para testes.
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM estrutura_submontagem;
DELETE FROM pecas;
ALTER TABLE estrutura_submontagem AUTO_INCREMENT = 1;
ALTER TABLE pecas AUTO_INCREMENT = 1;
SET FOREIGN_KEY_CHECKS = 1;

-- Insere 50 itens simples para testes do modulo administrativo.
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
  ('PC-001', 'Parafuso cabeca sextavada zincado 8mm', 45.00, 'COMPRADA', 'ITEM', 101, 12, NULL, 250, 400, 1800.00, 0.018),
  ('EMB-023', 'Embalagem cartonada reforcada para kit A', 320.00, 'COMPRADA', 'ITEM', NULL, 18, NULL, 80, 120, 450.00, 0.240),
  ('SUP-AX45', 'Suporte angular usinado linha AX45', 185.00, 'PRODUZIDA', 'ITEM', 203, 7, 4, 25, 40, 90.00, 1.280),
  ('CJ-9001', 'Conjunto de fixacao para cabine 9001', 640.00, 'PRODUZIDA', 'ITEM', 215, 14, 6, 18, 30, 65.00, 3.560),
  ('BR-120/A', 'Braco articulado serie 120 revisao A', 890.00, 'PRODUZIDA', 'ITEM', 230, 9, 8, 12, 18, 42.00, 4.125),
  ('TB-014', 'Tubo de aco trefilado 14mm', 1500.00, 'COMPRADA', 'ITEM', 112, 6, 3, 35, 55, 110.00, 2.940),
  ('CHP-502', 'Chapa dobrada lateral para painel 502', 780.00, 'PRODUZIDA', 'ITEM', 301, 10, 9, 16, 22, 38.00, 5.220),
  ('ROL-778', 'Rolete transportador galvanizado 778', 420.00, 'COMPRADA', 'ITEM', 118, 20, 5, 28, 40, 95.00, 1.870),
  ('GUIA-31', 'Guia linear curta modelo 31', 260.00, 'COMPRADA', 'ITEM', NULL, 15, 2, 20, 35, 70.00, 0.920),
  ('PERF-9X', 'Perfil estrutural aluminio 9X', 2400.00, 'COMPRADA', 'ITEM', 121, 11, NULL, 14, 25, 58.00, 3.440),
  ('CH-200', 'Chaveta de travamento 200', 95.00, 'PRODUZIDA', 'ITEM', 204, 8, 7, 70, 95, 260.00, 0.065),
  ('EIX-870', 'Eixo retificado serie 870', 1100.00, 'PRODUZIDA', 'ITEM', 207, 5, 11, 10, 14, 24.00, 6.910),
  ('ARR-055', 'Arruela lisa inox 5,5mm', 22.00, 'COMPRADA', 'ITEM', 102, 12, NULL, 400, 700, 2200.00, 0.004),
  ('ALJ-430', 'Alojamento frontal linha 430', 360.00, 'PRODUZIDA', 'ITEM', 225, 16, 10, 22, 34, 88.00, 2.480),
  ('PIN-02/B', 'Pino travante com rosca serie B', 78.00, 'PRODUZIDA', 'ITEM', 214, 13, 7, 90, 140, 310.00, 0.084),
  ('MTR-1.5', 'Motorredutor auxiliar 1.5cv', 540.00, 'COMPRADA', 'ITEM', NULL, 3, 14, 4, 6, 12.00, 14.800),
  ('BCH-600', 'Bucha de bronze autocentrante 600', 48.00, 'COMPRADA', 'ITEM', 145, 17, 5, 85, 120, 360.00, 0.112),
  ('EST-PL22', 'Estrutura plana suporte 22', 1320.00, 'PRODUZIDA', 'ITEM', 240, 8, 9, 6, 10, 16.00, 8.730),
  ('MOL-77', 'Mola helicoidal de compressao 77', 210.00, 'COMPRADA', 'ITEM', 109, 4, NULL, 120, 180, 640.00, 0.188),
  ('CX-VENT', 'Caixa de ventilacao industrial compacta', 680.00, 'PRODUZIDA', 'ITEM', 276, 19, 12, 8, 12, 20.00, 6.250),
  ('FLG-904', 'Flange de acoplamento 904', 150.00, 'PRODUZIDA', 'ITEM', 233, 14, 11, 26, 34, 76.00, 1.540),
  ('PAI-TRM', 'Painel terminal de comando', 920.00, 'COMPRADA', 'ITEM', NULL, 2, 13, 5, 8, 18.00, 7.980),
  ('TAM-210', 'Tampa superior linha 210', 430.00, 'PRODUZIDA', 'ITEM', 281, 9, 6, 12, 18, 37.00, 2.910),
  ('SUP-990', 'Suporte de base soldado 990', 520.00, 'PRODUZIDA', 'ITEM', 295, 10, 8, 15, 24, 44.00, 3.880),
  ('FIX-H13', 'Fixador rapido H13', 34.00, 'COMPRADA', 'ITEM', 111, 12, 4, 180, 260, 980.00, 0.026),
  ('CAB-480', 'Cabo de acionamento 480mm', 480.00, 'COMPRADA', 'ITEM', NULL, 21, NULL, 40, 60, 150.00, 0.356),
  ('ENG-72A', 'Engrenagem reta 72 dentes modulo A', 175.00, 'PRODUZIDA', 'ITEM', 211, 6, 15, 14, 22, 48.00, 1.960),
  ('CHP-908', 'Chapa lateral de reforco 908', 610.00, 'PRODUZIDA', 'ITEM', 309, 8, 9, 18, 26, 63.00, 4.340),
  ('VAL-50', 'Valvula de bloqueio 50 bar', 250.00, 'COMPRADA', 'ITEM', NULL, 1, 16, 6, 10, 14.00, 1.430),
  ('TIR-AC8', 'Tirante regulavel AC8', 980.00, 'PRODUZIDA', 'ITEM', 244, 7, 11, 11, 16, 31.00, 2.740),
  ('BRD-115', 'Borda de protecao 115', 1450.00, 'COMPRADA', 'ITEM', 132, 15, NULL, 22, 36, 84.00, 1.620),
  ('CJ-AX12', 'Conjunto articulado AX12', 760.00, 'PRODUZIDA', 'ITEM', 252, 9, 8, 9, 14, 29.00, 5.480),
  ('TRV-300', 'Travessa estrutural 300', 1680.00, 'PRODUZIDA', 'ITEM', 267, 18, 10, 7, 11, 21.00, 9.150),
  ('DIS-019', 'Disco espacador serie 019', 66.00, 'PRODUZIDA', 'ITEM', 216, 4, 5, 55, 80, 205.00, 0.094),
  ('MNT-88', 'Montante principal 88', 2100.00, 'PRODUZIDA', 'ITEM', 288, 10, 12, 5, 8, 14.00, 12.400),
  ('EMB-ALFA', 'Embalagem tecnica linha Alfa', 355.00, 'COMPRADA', 'ITEM', NULL, 18, NULL, 34, 50, 132.00, 0.310),
  ('SUP-GR7', 'Suporte guia roletado GR7', 295.00, 'PRODUZIDA', 'ITEM', 238, 20, 7, 19, 27, 68.00, 1.875),
  ('PRS-560', 'Prisioneiro roscado 560', 88.00, 'COMPRADA', 'ITEM', 107, 13, NULL, 260, 380, 1600.00, 0.032),
  ('CJ-BR44', 'Conjunto de bracadeira BR44', 540.00, 'PRODUZIDA', 'ITEM', 250, 6, 9, 16, 24, 59.00, 2.630),
  ('MNF-027', 'Manifold pneumatico 027', 310.00, 'COMPRADA', 'ITEM', NULL, 5, 14, 7, 10, 18.00, 1.210),
  ('PLA-770', 'Placa base usinada 770', 845.00, 'PRODUZIDA', 'ITEM', 302, 11, 10, 13, 19, 46.00, 6.430),
  ('COR-112', 'Correia sincronizada 112 dentes', 1240.00, 'COMPRADA', 'ITEM', NULL, 3, 2, 9, 13, 34.00, 0.860),
  ('EIX-441', 'Eixo de transmissao 441', 1380.00, 'PRODUZIDA', 'ITEM', 219, 8, 11, 8, 12, 19.00, 7.280),
  ('CAM-605', 'Camisa de protecao 605', 470.00, 'PRODUZIDA', 'ITEM', 273, 12, 6, 17, 25, 61.00, 2.180),
  ('JUN-45X', 'Junta tecnica 45X', 130.00, 'COMPRADA', 'ITEM', 115, 16, NULL, 150, 230, 730.00, 0.045),
  ('TRI-320', 'Trilho de apoio 320', 1880.00, 'PRODUZIDA', 'ITEM', 264, 9, 13, 6, 9, 17.00, 10.360),
  ('RES-801', 'Reservatorio auxiliar 801', 590.00, 'PRODUZIDA', 'ITEM', 299, 14, 12, 10, 15, 28.00, 4.970),
  ('FCH-226', 'Fechadura industrial 226', 172.00, 'COMPRADA', 'ITEM', NULL, 1, 4, 24, 35, 92.00, 0.620),
  ('PAI-LED', 'Painel sinalizador LED de bordo', 405.00, 'COMPRADA', 'ITEM', NULL, 22, 3, 11, 17, 26.00, 1.540),
  ('ROL-TRX', 'Rolete tracionador TRX', 365.00, 'PRODUZIDA', 'ITEM', 228, 7, 15, 21, 30, 74.00, 2.320);
