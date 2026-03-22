-- Seed minimo de materia-prima para a base inicial real do SAFISA.
USE safisa;

DELETE FROM materia_prima_fornecedor;
DELETE FROM materias_primas;

INSERT INTO materias_primas (
  id,
  codigo,
  nome,
  material,
  geometria,
  bitola,
  bitola_mm,
  comprimento_padrao_mm,
  peso_por_metro,
  peso_unitario_kg,
  densidade_g_cm3,
  estoque_minimo,
  observacao
) VALUES
  (1, 'MP-GENERICA', 'MATERIA-PRIMA GENERICA', 'NA', 'NA', 'NA', NULL, NULL, NULL, NULL, NULL, 0.000, 'Registro generico legado para pecas produzidas ainda nao mapeadas.'),
  (2, '250FD', 'CORPO CJ--015', 'Ferro fundido cinzento ou ferro fundido nodular', 'FUNDIDO', NULL, NULL, NULL, NULL, NULL, 7.2000, 0.000, 'Materia-prima fundida.'),
  (3, '300FD', 'CORPO MBF-040', 'Ferro fundido cinzento ou ferro fundido nodular', 'FUNDIDO', NULL, NULL, NULL, NULL, NULL, 7.2000, 0.000, 'Materia-prima fundida.'),
  (4, '350FD', 'CORPO BR-040', 'Ferro fundido cinzento ou ferro fundido nodular', 'FUNDIDO', NULL, NULL, NULL, NULL, NULL, 7.2000, 0.000, 'Materia-prima fundida.'),
  (5, '355FD', 'CORPO PRINCIPAL DO BR-040 C/ FURAÇÃO', 'Ferro fundido cinzento ou ferro fundido nodular', 'FUNDIDO', NULL, NULL, NULL, NULL, NULL, 7.2000, 0.000, 'Materia-prima fundida.'),
  (6, '400FD', 'CORPO DO VF', 'Ferro fundido cinzento ou ferro fundido nodular', 'FUNDIDO', NULL, NULL, NULL, NULL, NULL, 7.2000, 0.000, 'Materia-prima fundida.'),
  (7, '401FD', 'CORPO MC-040', 'Ferro fundido cinzento ou ferro fundido nodular', 'FUNDIDO', NULL, NULL, NULL, NULL, NULL, 7.2000, 0.000, 'Materia-prima fundida.'),
  (8, '450FD', 'CORPO DO MBF-032', 'Ferro fundido cinzento ou ferro fundido nodular', 'FUNDIDO', NULL, NULL, NULL, NULL, NULL, 7.2000, 0.000, 'Materia-prima fundida.'),
  (9, '500FD', 'CORPO DO TR - 100', 'Ferro fundido cinzento ou ferro fundido nodular', 'FUNDIDO', NULL, NULL, NULL, NULL, NULL, 7.2000, 0.000, 'Materia-prima fundida.');

INSERT INTO materia_prima_fornecedor (
  id_materia_prima,
  id_fornecedor,
  observacao
) VALUES
  (2, 6, 'Fornecedor padrao para fundidos'),
  (3, 6, 'Fornecedor padrao para fundidos'),
  (4, 6, 'Fornecedor padrao para fundidos'),
  (5, 6, 'Fornecedor padrao para fundidos'),
  (6, 6, 'Fornecedor padrao para fundidos'),
  (7, 6, 'Fornecedor padrao para fundidos'),
  (8, 6, 'Fornecedor padrao para fundidos'),
  (9, 6, 'Fornecedor padrao para fundidos');

ALTER TABLE materias_primas AUTO_INCREMENT = 10;
