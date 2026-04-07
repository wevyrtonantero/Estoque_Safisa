const submontagem = {
  codigo: 'SM-BR015',
  descricao: 'SERVO EMBREAGEM BR015',
  comprimento_mm: null,
  id_materia_prima: null,
  id_fornecedor: null,
  id_maquina: null,
  estoque_minimo: null,
  estoque_seguranca: null,
  consumo_mensal: null
};

const components = [
  { codigo: '004', quantidade: 1 },
  { codigo: '005', quantidade: 1 },
  { codigo: '006', quantidade: 2 },
  { codigo: '007', quantidade: 1 },
  { codigo: '008', quantidade: 1 },
  { codigo: '012', quantidade: 1 },
  { codigo: '013', quantidade: 2 },
  { codigo: '014', quantidade: 1 },
  { codigo: '018', quantidade: 1 },
  { codigo: '019', quantidade: 1 },
  { codigo: '020', quantidade: 1 },
  { codigo: '021', quantidade: 5 },
  { codigo: '024', quantidade: 1 },
  { codigo: '025', quantidade: 1 },
  { codigo: '026', quantidade: 1 },
  { codigo: '027', quantidade: 1 },
  { codigo: '028', quantidade: 1 },
  { codigo: '029/1', quantidade: 1 },
  { codigo: '029/2', quantidade: 1 },
  { codigo: '030', quantidade: 1 },
  { codigo: '031', quantidade: 1 },
  { codigo: '032', quantidade: 1 },
  { codigo: '033', quantidade: 1 },
  { codigo: '034', quantidade: 1 },
  { codigo: '035', quantidade: 1 },
  { codigo: '037', quantidade: 1 },
  { codigo: '039', quantidade: 1 },
  { codigo: '040', quantidade: 1 },
  { codigo: '042', quantidade: 1 },
  { codigo: '043', quantidade: 1 },
  { codigo: '044', quantidade: 1 },
  { codigo: '045', quantidade: 2 },
  { codigo: '046', quantidade: 1 },
  { codigo: '047', quantidade: 1 },
  { codigo: '048', quantidade: 1 },
  { codigo: '052', quantidade: 1 },
  { codigo: '092', quantidade: 1 },
  { codigo: '100', quantidade: 1 }
];

const assumptions = [
  'A estrutura do SM-BR015 foi montada a partir dos componentes comuns entre 4B, 4C, 4E e 4F.',
  'O componente 032/1 (GUIA DE BORRACHA) foi removido conforme a sua orientacao.',
  'As quantidades 021 = 5 e 013 = 2 foram fixadas conforme a sua orientacao.',
  'Itens variaveis de instalacao, como mangueira, empurrador e suportes, ficaram fora do SM-BR015.'
];

module.exports = {
  submontagem,
  components,
  assumptions
};
