-- Seed inicial de fornecedores reais para a base do SAFISA.
USE safisa;

DELETE FROM materia_prima_fornecedor;
DELETE FROM peca_fornecedor;
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
) VALUES
  (
    1,
    'Oliver Plast',
    NULL,
    NULL,
    NULL,
    '13253-120',
    'Rua Lucia Piffer Baptistella, 195, Vila Rita',
    'Itatiba - SP',
    'Razao social: Oliver Plast Industria e Comercio de Plasticos Ltda | CNPJ 02.677.068/0001-35'
  ),
  (
    2,
    'Original Molas',
    NULL,
    NULL,
    NULL,
    '13063-000',
    'Rua Mario Junqueira da Silva, 1696, Jardim Eulina',
    'Campinas - SP',
    'Razao social: Original Industria de Molas e Pecas Ltda | CNPJ 72.000.128/0001-66'
  ),
  (
    3,
    'FF Calderaria Equipamentos',
    NULL,
    NULL,
    NULL,
    '13253-120',
    'Rua Lucia Piffer Baptistella, 320, Vila Rita',
    'Itatiba - SP',
    'Razao social: F F Caldeiraria Ltda | CNPJ 29.391.618/0001-01'
  ),
  (
    4,
    'Trevine Home Center',
    NULL,
    NULL,
    NULL,
    '13256-010',
    'Rua Luiz Scavone, 329, Vila Santa Clara',
    'Itatiba - SP',
    'Razao social: Trevine & Filhos Ltda | CNPJ 02.036.099/0001-07'
  ),
  (
    5,
    'Itatirol',
    NULL,
    NULL,
    NULL,
    '13251-500',
    'Avenida Prudente de Moraes, 781, Vila Santa Cruz',
    'Itatiba - SP',
    'Razao social: Itatirol Itatiba Rolamentos Ltda | CNPJ 03.411.788/0001-17'
  ),
  (
    6,
    'Fundicao Tiger',
    NULL,
    NULL,
    NULL,
    '86140-000',
    'Rodovia PR 445, Km 139,2',
    'Primeiro de Maio - PR',
    'Razao social: Fundicao Tiger Ltda | CNPJ 10.362.306/0001-41'
  ),
  (
    7,
    'Prestampas (Cajamar)',
    NULL,
    NULL,
    NULL,
    NULL,
    'Cajamar - SP',
    'Cajamar - SP',
    'Fornecedor informado pelo usuario para itens com descricao contendo TAMPA. CNPJ nao confirmado.'
  ),
  (
    8,
    'SAFISA',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'Itatiba - SP',
    'Fornecedor interno padrao para todas as pecas PRODUZIDA.'
  ),
  (
    9,
    'NOTE TESTE',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'Fornecedor fallback para pecas sem fornecedor identificado pelas regras iniciais.'
  ),
  (
    10,
    'Açovisa',
    NULL,
    NULL,
    NULL,
    '07220-030',
    'Rua Angatuba, 350, Cumbica',
    'Guarulhos - SP',
    'Razao social: Acovisa Industria e Comercio de Acos Especiais Ltda | CNPJ 00.987.098/0001-12'
  );

ALTER TABLE fornecedores AUTO_INCREMENT = 11;
