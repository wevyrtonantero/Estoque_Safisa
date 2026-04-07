const auxSubmontagens = [
  {
    codigo: 'A-011/17',
    descricao: 'EMPURRADOR MONTADO 240mm - M14 x 2',
    componentes: [
      { codigo: '011/17', quantidade: 1 },
      { codigo: '023', quantidade: 1 },
      { codigo: '090/20', quantidade: 1 },
      { codigo: '090/1', quantidade: 1 },
      { codigo: '090/3', quantidade: 2 }
    ]
  }
];

const kits = [
  {
    codigo: 'KT-05',
    descricao: 'KIT DE INSTALACAO 2F',
    componentes: [
      { codigo: 'A-035/10', quantidade: 1 },
      { codigo: 'A-068', quantidade: 1 },
      { codigo: '038', quantidade: 1 },
      { codigo: 'A-058/4', quantidade: 1 },
      { codigo: '087', quantidade: 2 },
      { codigo: '086/1', quantidade: 2 },
      { codigo: '088/1', quantidade: 2 },
      { codigo: '173', quantidade: 2 },
      { codigo: '099/13', quantidade: 1 },
      { codigo: 'A-090', quantidade: 1 },
      { codigo: '011/21', quantidade: 1 },
      { codigo: 'A-058/10', quantidade: 1 },
      { codigo: 'A-073/1', quantidade: 1 },
      { codigo: 'A-152/2', quantidade: 1 },
      { codigo: '149', quantidade: 1 },
      { codigo: 'A-076/31', quantidade: 1 },
      { codigo: '050/1', quantidade: 1.5 },
      { codigo: '050', quantidade: 4 }
    ]
  },
  {
    codigo: 'KT-91',
    descricao: 'KIT DE INSTALACAO 2H',
    componentes: [
      { codigo: 'A-035/10', quantidade: 2 },
      { codigo: '058/8', quantidade: 1 },
      { codigo: 'A-082/1', quantidade: 1 },
      { codigo: 'A-068/5', quantidade: 1 },
      { codigo: '172/1', quantidade: 1 },
      { codigo: '087', quantidade: 2 },
      { codigo: '099/2', quantidade: 2 },
      { codigo: '086', quantidade: 2 },
      { codigo: '099/6', quantidade: 2 },
      { codigo: '099/4', quantidade: 4 },
      { codigo: '061', quantidade: 4 },
      { codigo: '076/33', quantidade: 1 },
      { codigo: '076/34', quantidade: 1 },
      { codigo: '050/1', quantidade: 4 },
      { codigo: '050', quantidade: 4 }
    ]
  },
  {
    codigo: 'KT-14',
    descricao: 'KIT DE INSTALACAO 3A',
    componentes: [
      { codigo: '035', quantidade: 1 },
      { codigo: 'A-060', quantidade: 1 },
      { codigo: 'A-058', quantidade: 1 },
      { codigo: '061', quantidade: 1 },
      { codigo: '071/2', quantidade: 1 },
      { codigo: '050', quantidade: 6 }
    ]
  },
  {
    codigo: 'KT',
    descricao: 'KIT DE INSTALACAO 5I',
    componentes: [
      { codigo: '060', quantidade: 1 },
      { codigo: '154/1', quantidade: 1 },
      { codigo: '086/2', quantidade: 2 },
      { codigo: '194', quantidade: 1 }
    ]
  },
  {
    codigo: 'KT-73',
    descricao: 'KIT DE INSTALACAO 7Z',
    componentes: [
      { codigo: 'A-011/17', quantidade: 1 },
      { codigo: 'A-083', quantidade: 1 }
    ]
  },
  {
    codigo: 'KT-29',
    descricao: 'KIT DE INSTALACAO 1H',
    componentes: [
      { codigo: '099/4', quantidade: 2 },
      { codigo: 'A-078', quantidade: 2 },
      { codigo: '035', quantidade: 1 },
      { codigo: 'A-058/2', quantidade: 1 },
      { codigo: '019', quantidade: 2 },
      { codigo: '087/1', quantidade: 3 },
      { codigo: '071/1', quantidade: 1 },
      { codigo: '099/2', quantidade: 2 },
      { codigo: '145', quantidade: 1 },
      { codigo: '086', quantidade: 3 },
      { codigo: '071/2', quantidade: 3 },
      { codigo: '073', quantidade: 1 },
      { codigo: '067', quantidade: 1 },
      { codigo: '050', quantidade: 3 },
      { codigo: '050/1', quantidade: 2 },
      { codigo: '110', quantidade: 1 },
      { codigo: '076/18', quantidade: 1 },
      { codigo: '076/19', quantidade: 1 },
      { codigo: 'A-011/12', quantidade: 1 }
    ]
  }
];

const assumptions = [
  'Os kits foram cadastrados pelas imagens enviadas, mantendo os conjuntos A-* quando eles ja existiam no cadastro.',
  'O codigo A-011/17 foi criado para representar o empurrador montado 240mm - M14 x 2 mostrado na imagem do KT-73.',
  'No kit 5I, o primeiro componente foi interpretado como 060 pela descricao Capa do empurrador 025/032.'
];

module.exports = {
  auxSubmontagens,
  kits,
  assumptions
};
