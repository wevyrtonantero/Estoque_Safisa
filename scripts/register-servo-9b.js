const { pool } = require('../database/connection');

const submontagens = [
  {
    codigo: 'A-078',
    descricao: 'CONEXÃO DE ÓLEO M14 x 1',
    componentes: [
      { codigo: '078', quantidade: 1, descricaoEsperada: 'CONEXÃO DE ÓLEO M14 MACHO' },
      { codigo: '078/1', quantidade: 1, descricaoEsperada: 'PORCA DA CONEXAO DE OLEO' },
      { codigo: '107', quantidade: 1, descricaoEsperada: 'ARRUELA DE ALUMINIO P/ Ø14 MM' },
      { codigo: '108', quantidade: 1, descricaoEsperada: 'INSERT 1/4"' },
      { codigo: '109', quantidade: 1, descricaoEsperada: 'ANILHA' }
    ]
  },
  {
    codigo: 'A-171',
    descricao: 'CONEXÃO P/ TUBO DE 10MM X FEMIA 14',
    componentes: [
      { codigo: '171', quantidade: 1, descricaoEsperada: 'CONEXÃO P/ TUBO DE 10MM X FEMIA 14' },
      { codigo: '078/1', quantidade: 1, descricaoEsperada: 'PORCA DA CONEXAO DE OLEO' },
      { codigo: '108', quantidade: 1, descricaoEsperada: 'INSERT 1/4"' },
      { codigo: '109', quantidade: 1, descricaoEsperada: 'ANILHA' }
    ]
  },
  {
    codigo: 'A-068',
    descricao: 'EMPURRADOR COM REGULAGEM',
    componentes: [
      { codigo: '068', quantidade: 1, descricaoEsperada: 'EMPURRADOR P/ BR-25 (1620)' },
      { codigo: '111', quantidade: 1, descricaoEsperada: 'PINO REG. EMP. 025 CURTO' },
      { codigo: '111/2', quantidade: 1, descricaoEsperada: 'PORCA M12x1.5' }
    ]
  },
  {
    codigo: 'A-176',
    descricao: 'NIPLE DE AR',
    componentes: [
      { codigo: '176', quantidade: 1, descricaoEsperada: 'NIPLE DE AR' },
      { codigo: '021/2', quantidade: 1, descricaoEsperada: 'ARRUELA DE AL. 16,2x22x1,5' },
      { codigo: '017/1', quantidade: 1, descricaoEsperada: 'PORCA DO CONECTOR 1/4"' }
    ]
  },
  {
    codigo: 'A-154',
    descricao: 'VARÃO ROSCADO M14 x 135',
    componentes: [
      { codigo: '154', quantidade: 1, descricaoEsperada: 'VARÃO ROSCADO M14x135' },
      { codigo: '174', quantidade: 1, descricaoEsperada: 'PORCA AUTO TRAVANTE M14x2' },
      { codigo: '164', quantidade: 1, descricaoEsperada: 'ARRUELA DE PRESSÃO M14' },
      { codigo: '172', quantidade: 1, descricaoEsperada: 'CALÇO DA BARRA ROSCADA' },
      { codigo: '155', quantidade: 1, descricaoEsperada: 'BUCHA DA FORQUILHA' },
      { codigo: '090', quantidade: 1, descricaoEsperada: 'FORQUILHA' },
      { codigo: '090/1', quantidade: 1, descricaoEsperada: 'PINO DA FORQUILHA' },
      { codigo: '090/3', quantidade: 2, descricaoEsperada: 'ANEL ELASTICO E12' },
      { codigo: '023', quantidade: 1, descricaoEsperada: 'PORCA M14x2' }
    ]
  },
  {
    codigo: 'A-152',
    descricao: 'ALAVANCA DO ELETRÔNICO (PARA ACIONAR O ROLAMENTO)',
    componentes: [
      { codigo: '152', quantidade: 1, descricaoEsperada: 'ALAVANCA DO ELETRONICO ROLAMENTO' },
      { codigo: '152/1', quantidade: 1, descricaoEsperada: 'ROLAMENTO AGULHA HK 1210' },
      { codigo: '193', quantidade: 1, descricaoEsperada: 'BUCHA PLASTICA MBB' }
    ]
  },
  {
    codigo: 'SM-MBF032',
    descricao: 'SERVO MBF032',
    componentes: [
      { codigo: '022', quantidade: 1, descricaoEsperada: 'GUARDA PÓ 025' },
      { codigo: '006/32', quantidade: 2, descricaoEsperada: 'ANÉL ELASTICO DE O32mm' },
      { codigo: '008/32', quantidade: 1, descricaoEsperada: 'PISTÃO HIDRÁULICO 032' },
      { codigo: '450', quantidade: 1, descricaoEsperada: 'CORPO DO MBF-032' },
      { codigo: '047', quantidade: 1, descricaoEsperada: 'O-RING 2-115' },
      { codigo: '046', quantidade: 1, descricaoEsperada: 'O-RING 2-112' },
      { codigo: '015', quantidade: 1, descricaoEsperada: 'PARAFUSO DA VALVULA C/SANGRADOR' },
      { codigo: '048', quantidade: 1, descricaoEsperada: 'SANGRADOR' },
      { codigo: '033', quantidade: 1, descricaoEsperada: 'RETENTOR DE 016mm' },
      { codigo: '045', quantidade: 2, descricaoEsperada: 'O-RING 2-111' },
      { codigo: '043', quantidade: 1, descricaoEsperada: 'O-RING 2-022' },
      { codigo: '007', quantidade: 1, descricaoEsperada: 'TAMPA TRASEIRA' },
      { codigo: '029/1', quantidade: 1, descricaoEsperada: 'EMBOLO' },
      { codigo: '029/2', quantidade: 1, descricaoEsperada: 'EMBÔLO DE BORRACHA' },
      { codigo: '044', quantidade: 1, descricaoEsperada: 'O-RING 2-015' },
      { codigo: '014', quantidade: 1, descricaoEsperada: 'BUJÃO DA TAMPA TRAZEIRA' },
      { codigo: '017/1', quantidade: 1, descricaoEsperada: 'PORCA DO CONECTOR 1/4"' },
      { codigo: '019', quantidade: 1, descricaoEsperada: 'PARAFUSO ALLEN M6x30' },
      { codigo: '018', quantidade: 1, descricaoEsperada: 'ABRAÇADEIRA DE INOX' },
      { codigo: '032/1', quantidade: 1, descricaoEsperada: 'GAXETA' },
      { codigo: '055/40', quantidade: 1, descricaoEsperada: 'HASTE DO PISTÃO 040' },
      { codigo: '041/32', quantidade: 1, descricaoEsperada: 'O-RING 1024 TAMPA INTER. 032' },
      { codigo: '034', quantidade: 1, descricaoEsperada: 'RETENTOR 7/16' },
      { codigo: '005/32', quantidade: 1, descricaoEsperada: 'TAMPA INTERMEDIÁRIA DO 032' },
      { codigo: '027', quantidade: 1, descricaoEsperada: 'TELA DE LATÃO' },
      { codigo: '026', quantidade: 1, descricaoEsperada: 'ANÉL ELÁSTICO DE 014mm' },
      { codigo: '032', quantidade: 1, descricaoEsperada: 'PRATO DO PISTÃO' },
      { codigo: '004', quantidade: 1, descricaoEsperada: 'CORPO DA VÁLVULA' },
      { codigo: '012', quantidade: 1, descricaoEsperada: 'VÁLVULA HIDROPNEUMÁTICA' },
      { codigo: '040/VF', quantidade: 1, descricaoEsperada: 'MOLA DA VÁLVULA DO VF' },
      { codigo: '039', quantidade: 1, descricaoEsperada: 'MOLA DO EMBÔLO' },
      { codigo: '037', quantidade: 1, descricaoEsperada: 'MOLA DE RETÔRNO' },
      { codigo: '025', quantidade: 1, descricaoEsperada: 'PORCA M10x1' },
      { codigo: '020', quantidade: 1, descricaoEsperada: 'PORCA M6x1 AUTO TRAVANTE' },
      { codigo: '092/40', quantidade: 1, descricaoEsperada: 'TAMPA DA CAMISA 040' },
      { codigo: '013', quantidade: 2, descricaoEsperada: 'PARAFUSO DE FIXAÇÃO DA CAMISA' },
      { codigo: '021', quantidade: 5, descricaoEsperada: 'ARRUELA DE VEDAÇÃO' },
      { codigo: '024/40', quantidade: 1, descricaoEsperada: 'TUBO PASSAGEM DE AR 040' }
    ]
  },
  {
    codigo: 'KT-69',
    descricao: 'KIT DE INSTALAÇÃO 9B',
    componentes: [
      { codigo: '132', quantidade: 3, descricaoEsperada: 'ABRAÇADEIRA DE NYLON' },
      { codigo: '088', quantidade: 2, descricaoEsperada: 'ARRUELA LISA P/ Ø10' },
      { codigo: '099/4', quantidade: 3, descricaoEsperada: 'ARRUELA DE PRESSÃO P/ Ø8' },
      { codigo: '078', quantidade: 1, descricaoEsperada: 'CONEXÃO DE ÓLEO M14 MACHO' },
      { codigo: '078/1', quantidade: 2, descricaoEsperada: 'PORCA DA CONEXAO DE OLEO' },
      { codigo: '107', quantidade: 1, descricaoEsperada: 'ARRUELA DE ALUMINIO P/ Ø14 MM' },
      { codigo: '108', quantidade: 2, descricaoEsperada: 'INSERT 1/4"' },
      { codigo: '109', quantidade: 2, descricaoEsperada: 'ANILHA' },
      { codigo: '171', quantidade: 1, descricaoEsperada: 'CONEXÃO P/ TUBO DE 10MM X FEMIA 14' },
      { codigo: '035', quantidade: 1, descricaoEsperada: 'COTOVELO INVERTIDO' },
      { codigo: '068', quantidade: 1, descricaoEsperada: 'EMPURRADOR P/ BR-25 (1620)' },
      { codigo: '111', quantidade: 1, descricaoEsperada: 'PINO REG. EMP. 025 CURTO' },
      { codigo: '111/2', quantidade: 1, descricaoEsperada: 'PORCA M12x1.5' },
      { codigo: '038', quantidade: 1, descricaoEsperada: 'MOLA DO PEDAL' },
      { codigo: '176', quantidade: 1, descricaoEsperada: 'NIPLE DE AR' },
      { codigo: '021/2', quantidade: 1, descricaoEsperada: 'ARRUELA DE AL. 16,2x22x1,5' },
      { codigo: '017/1', quantidade: 1, descricaoEsperada: 'PORCA DO CONECTOR 1/4"' },
      { codigo: '162', quantidade: 2, descricaoEsperada: 'PARAFUSO ALLEN C/ CABEÇA M10x50' },
      { codigo: '178', quantidade: 2, descricaoEsperada: 'PARAFUSO SEXT. M10x25 DE ROSCA POLIDA OU OXID.' },
      { codigo: '099/2', quantidade: 2, descricaoEsperada: 'PARAFUSO M 8X 30' },
      { codigo: '163', quantidade: 1, descricaoEsperada: 'PARAFUSO SEXT. M8x70' },
      { codigo: '086', quantidade: 2, descricaoEsperada: 'PORCA M10X1.5 AUTOTRAVANTE' },
      { codigo: '151', quantidade: 1, descricaoEsperada: 'REFORÇO DE FIXAÇÃO DO SERVO' },
      { codigo: '153', quantidade: 1, descricaoEsperada: 'SUPORTE DE FIXAÇÃO DO SERVO(ELETRONICO)' },
      { codigo: '173', quantidade: 2, descricaoEsperada: 'TAMPA DE PROTEÇÃO DO ELETRONICO' },
      { codigo: '154', quantidade: 1, descricaoEsperada: 'VARÃO ROSCADO M14x135' },
      { codigo: '174', quantidade: 1, descricaoEsperada: 'PORCA AUTO TRAVANTE M14x2' },
      { codigo: '164', quantidade: 1, descricaoEsperada: 'ARRUELA DE PRESSÃO M14' },
      { codigo: '172', quantidade: 1, descricaoEsperada: 'CALÇO DA BARRA ROSCADA' },
      { codigo: '155', quantidade: 1, descricaoEsperada: 'BUCHA DA FORQUILHA' },
      { codigo: '090', quantidade: 1, descricaoEsperada: 'FORQUILHA' },
      { codigo: '090/1', quantidade: 1, descricaoEsperada: 'PINO DA FORQUILHA' },
      { codigo: '090/3', quantidade: 2, descricaoEsperada: 'ANEL ELASTICO E12' },
      { codigo: '023', quantidade: 1, descricaoEsperada: 'PORCA M14x2' },
      { codigo: '152', quantidade: 1, descricaoEsperada: 'ALAVANCA DO ELETRONICO ROLAMENTO' },
      { codigo: '152/1', quantidade: 1, descricaoEsperada: 'ROLAMENTO AGULHA HK 1210' },
      { codigo: '193', quantidade: 1, descricaoEsperada: 'BUCHA PLASTICA MBB' },
      { codigo: '149', quantidade: 1, descricaoEsperada: 'BASE P/ MURINGA (ELETRONICO)' },
      { codigo: '050', quantidade: 3, descricaoEsperada: 'MANGUEIRA DE AR 8x6' },
      { codigo: '050/1', quantidade: 0.13, descricaoEsperada: 'MANGUEIRA DE OLEO 10X6' }
    ]
  },
  {
    codigo: '9B',
    descricao: 'SERVO EMBREAGEM COM KIT COMPLETO',
    componentes: [
      { codigo: '022', quantidade: 1, descricaoEsperada: 'GUARDA PÓ 025' },
      { codigo: '006/32', quantidade: 2, descricaoEsperada: 'ANÉL ELASTICO DE O32mm' },
      { codigo: '008/32', quantidade: 1, descricaoEsperada: 'PISTÃO HIDRÁULICO 032' },
      { codigo: '450', quantidade: 1, descricaoEsperada: 'CORPO DO MBF-032' },
      { codigo: '047', quantidade: 1, descricaoEsperada: 'O-RING 2-115' },
      { codigo: '046', quantidade: 1, descricaoEsperada: 'O-RING 2-112' },
      { codigo: '015', quantidade: 1, descricaoEsperada: 'PARAFUSO DA VALVULA C/SANGRADOR' },
      { codigo: '048', quantidade: 1, descricaoEsperada: 'SANGRADOR' },
      { codigo: '033', quantidade: 1, descricaoEsperada: 'RETENTOR DE 016mm' },
      { codigo: '045', quantidade: 2, descricaoEsperada: 'O-RING 2-111' },
      { codigo: '043', quantidade: 1, descricaoEsperada: 'O-RING 2-022' },
      { codigo: '007', quantidade: 1, descricaoEsperada: 'TAMPA TRASEIRA' },
      { codigo: '029/1', quantidade: 1, descricaoEsperada: 'EMBOLO' },
      { codigo: '029/2', quantidade: 1, descricaoEsperada: 'EMBÔLO DE BORRACHA' },
      { codigo: '044', quantidade: 1, descricaoEsperada: 'O-RING 2-015' },
      { codigo: '014', quantidade: 1, descricaoEsperada: 'BUJÃO DA TAMPA TRAZEIRA' },
      { codigo: '017/1', quantidade: 2, descricaoEsperada: 'PORCA DO CONECTOR 1/4"' },
      { codigo: '019', quantidade: 1, descricaoEsperada: 'PARAFUSO ALLEN M6x30' },
      { codigo: '018', quantidade: 1, descricaoEsperada: 'ABRAÇADEIRA DE INOX' },
      { codigo: '032/1', quantidade: 1, descricaoEsperada: 'GAXETA' },
      { codigo: '055/40', quantidade: 1, descricaoEsperada: 'HASTE DO PISTÃO 040' },
      { codigo: '041/32', quantidade: 1, descricaoEsperada: 'O-RING 1024 TAMPA INTER. 032' },
      { codigo: '034', quantidade: 1, descricaoEsperada: 'RETENTOR 7/16' },
      { codigo: '005/32', quantidade: 1, descricaoEsperada: 'TAMPA INTERMEDIÁRIA DO 032' },
      { codigo: '027', quantidade: 1, descricaoEsperada: 'TELA DE LATÃO' },
      { codigo: '026', quantidade: 1, descricaoEsperada: 'ANÉL ELÁSTICO DE 014mm' },
      { codigo: '032', quantidade: 1, descricaoEsperada: 'PRATO DO PISTÃO' },
      { codigo: '004', quantidade: 1, descricaoEsperada: 'CORPO DA VÁLVULA' },
      { codigo: '012', quantidade: 1, descricaoEsperada: 'VÁLVULA HIDROPNEUMÁTICA' },
      { codigo: '040/VF', quantidade: 1, descricaoEsperada: 'MOLA DA VÁLVULA DO VF' },
      { codigo: '039', quantidade: 1, descricaoEsperada: 'MOLA DO EMBÔLO' },
      { codigo: '037', quantidade: 1, descricaoEsperada: 'MOLA DE RETÔRNO' },
      { codigo: '025', quantidade: 1, descricaoEsperada: 'PORCA M10x1' },
      { codigo: '020', quantidade: 1, descricaoEsperada: 'PORCA M6x1 AUTO TRAVANTE' },
      { codigo: '092/40', quantidade: 1, descricaoEsperada: 'TAMPA DA CAMISA 040' },
      { codigo: '013', quantidade: 2, descricaoEsperada: 'PARAFUSO DE FIXAÇÃO DA CAMISA' },
      { codigo: '021', quantidade: 5, descricaoEsperada: 'ARRUELA DE VEDAÇÃO' },
      { codigo: '024/40', quantidade: 1, descricaoEsperada: 'TUBO PASSAGEM DE AR 040' },
      { codigo: '132', quantidade: 3, descricaoEsperada: 'ABRAÇADEIRA DE NYLON' },
      { codigo: '088', quantidade: 2, descricaoEsperada: 'ARRUELA LISA P/ Ø10' },
      { codigo: '099/4', quantidade: 3, descricaoEsperada: 'ARRUELA DE PRESSÃO P/ Ø8' },
      { codigo: '078', quantidade: 1, descricaoEsperada: 'CONEXÃO DE ÓLEO M14 MACHO' },
      { codigo: '078/1', quantidade: 2, descricaoEsperada: 'PORCA DA CONEXAO DE OLEO' },
      { codigo: '107', quantidade: 1, descricaoEsperada: 'ARRUELA DE ALUMINIO P/ Ø14 MM' },
      { codigo: '108', quantidade: 2, descricaoEsperada: 'INSERT 1/4"' },
      { codigo: '109', quantidade: 2, descricaoEsperada: 'ANILHA' },
      { codigo: '171', quantidade: 1, descricaoEsperada: 'CONEXÃO P/ TUBO DE 10MM X FEMIA 14' },
      { codigo: '035', quantidade: 1, descricaoEsperada: 'COTOVELO INVERTIDO' },
      { codigo: '068', quantidade: 1, descricaoEsperada: 'EMPURRADOR P/ BR-25 (1620)' },
      { codigo: '111', quantidade: 1, descricaoEsperada: 'PINO REG. EMP. 025 CURTO' },
      { codigo: '111/2', quantidade: 1, descricaoEsperada: 'PORCA M12x1.5' },
      { codigo: '038', quantidade: 1, descricaoEsperada: 'MOLA DO PEDAL' },
      { codigo: '176', quantidade: 1, descricaoEsperada: 'NIPLE DE AR' },
      { codigo: '021/2', quantidade: 1, descricaoEsperada: 'ARRUELA DE AL. 16,2x22x1,5' },
      { codigo: '162', quantidade: 2, descricaoEsperada: 'PARAFUSO ALLEN C/ CABEÇA M10x50' },
      { codigo: '178', quantidade: 2, descricaoEsperada: 'PARAFUSO SEXT. M10x25 DE ROSCA POLIDA OU OXID.' },
      { codigo: '099/2', quantidade: 2, descricaoEsperada: 'PARAFUSO M 8X 30' },
      { codigo: '163', quantidade: 1, descricaoEsperada: 'PARAFUSO SEXT. M8x70' },
      { codigo: '086', quantidade: 2, descricaoEsperada: 'PORCA M10X1.5 AUTOTRAVANTE' },
      { codigo: '151', quantidade: 1, descricaoEsperada: 'REFORÇO DE FIXAÇÃO DO SERVO' },
      { codigo: '153', quantidade: 1, descricaoEsperada: 'SUPORTE DE FIXAÇÃO DO SERVO(ELETRONICO)' },
      { codigo: '173', quantidade: 2, descricaoEsperada: 'TAMPA DE PROTEÇÃO DO ELETRONICO' },
      { codigo: '154', quantidade: 1, descricaoEsperada: 'VARÃO ROSCADO M14x135' },
      { codigo: '174', quantidade: 1, descricaoEsperada: 'PORCA AUTO TRAVANTE M14x2' },
      { codigo: '164', quantidade: 1, descricaoEsperada: 'ARRUELA DE PRESSÃO M14' },
      { codigo: '172', quantidade: 1, descricaoEsperada: 'CALÇO DA BARRA ROSCADA' },
      { codigo: '155', quantidade: 1, descricaoEsperada: 'BUCHA DA FORQUILHA' },
      { codigo: '090', quantidade: 1, descricaoEsperada: 'FORQUILHA' },
      { codigo: '090/1', quantidade: 1, descricaoEsperada: 'PINO DA FORQUILHA' },
      { codigo: '090/3', quantidade: 2, descricaoEsperada: 'ANEL ELASTICO E12' },
      { codigo: '023', quantidade: 1, descricaoEsperada: 'PORCA M14x2' },
      { codigo: '152', quantidade: 1, descricaoEsperada: 'ALAVANCA DO ELETRONICO ROLAMENTO' },
      { codigo: '152/1', quantidade: 1, descricaoEsperada: 'ROLAMENTO AGULHA HK 1210' },
      { codigo: '193', quantidade: 1, descricaoEsperada: 'BUCHA PLASTICA MBB' },
      { codigo: '149', quantidade: 1, descricaoEsperada: 'BASE P/ MURINGA (ELETRONICO)' },
      { codigo: '050', quantidade: 3, descricaoEsperada: 'MANGUEIRA DE AR 8x6' },
      { codigo: '050/1', quantidade: 0.13, descricaoEsperada: 'MANGUEIRA DE OLEO 10X6' }
    ]
  }
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

async function recalculateSubmontagemMass(connection, submontagemId) {
  await connection.query(
    `
      UPDATE pecas sub
      LEFT JOIN (
        SELECT
          es.id_submontagem,
          COALESCE(SUM(es.quantidade * p.massa_kg), 0) AS massa_total
        FROM estrutura_submontagem es
        INNER JOIN pecas p ON p.id = es.id_item_componente
        WHERE es.id_submontagem = ?
        GROUP BY es.id_submontagem
      ) calculo ON calculo.id_submontagem = sub.id
      SET sub.massa_kg = COALESCE(calculo.massa_total, 0)
      WHERE sub.id = ? AND sub.classificacao = 'SUBMONTAGEM'
    `,
    [submontagemId, submontagemId]
  );
}

async function fetchItemsByCodes(connection, codes) {
  const [rows] = await connection.query(
    `
      SELECT id, codigo, descricao, classificacao
      FROM pecas
      WHERE codigo IN (?)
    `,
    [codes]
  );

  return new Map(rows.map((row) => [row.codigo, row]));
}

async function upsertSubmontagem(connection, definition, itemsByCode, report) {
  const missingCodes = [];
  const invalidCodes = [];

  const componentes = definition.componentes.map((component) => {
    const item = itemsByCode.get(component.codigo);

    if (!item) {
      missingCodes.push(component.codigo);
      return null;
    }

    if (item.classificacao !== 'ITEM') {
      invalidCodes.push(component.codigo);
      return null;
    }

    if (normalizeText(item.descricao) !== normalizeText(component.descricaoEsperada)) {
      report.mismatchedDescriptions.push({
        submontagem: definition.codigo,
        codigo: component.codigo,
        esperado: component.descricaoEsperada,
        atual: item.descricao
      });
    }

    return {
      id_item_componente: item.id,
      quantidade: component.quantidade,
      observacao: null
    };
  });

  if (missingCodes.length) {
    throw new Error(`Itens nao encontrados para ${definition.codigo}: ${missingCodes.join(', ')}`);
  }

  if (invalidCodes.length) {
    throw new Error(`Itens com classificacao invalida para ${definition.codigo}: ${invalidCodes.join(', ')}`);
  }

  const [existingRows] = await connection.query(
    `
      SELECT id, codigo, descricao, classificacao
      FROM pecas
      WHERE codigo = ?
      LIMIT 1
    `,
    [definition.codigo]
  );

  let submontagemId;

  if (existingRows[0]) {
    if (existingRows[0].classificacao !== 'SUBMONTAGEM') {
      throw new Error(`O codigo ${definition.codigo} ja existe, mas nao esta como SUBMONTAGEM.`);
    }

    submontagemId = existingRows[0].id;

    await connection.query(
      `
        UPDATE pecas
        SET
          descricao = ?,
          tipo = 'PRODUZIDA',
          classificacao = 'SUBMONTAGEM',
          comprimento_mm = NULL,
          id_materia_prima = NULL,
          id_fornecedor = NULL,
          id_maquina = NULL
        WHERE id = ?
      `,
      [definition.descricao, submontagemId]
    );

    report.updated.push(definition.codigo);
  } else {
    const [result] = await connection.query(
      `
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
        ) VALUES (?, ?, NULL, 'PRODUZIDA', 'SUBMONTAGEM', NULL, NULL, NULL, NULL, NULL, NULL, 0)
      `,
      [definition.codigo, definition.descricao]
    );

    submontagemId = result.insertId;
    report.created.push(definition.codigo);
  }

  await connection.query(
    `
      DELETE FROM estrutura_submontagem
      WHERE id_submontagem = ?
    `,
    [submontagemId]
  );

  await connection.query(
    `
      INSERT INTO estrutura_submontagem (
        id_submontagem,
        id_item_componente,
        quantidade,
        observacao
      ) VALUES ?
    `,
    [
      componentes.map((component) => ([
        submontagemId,
        component.id_item_componente,
        component.quantidade,
        component.observacao
      ]))
    ]
  );

  await recalculateSubmontagemMass(connection, submontagemId);
}

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const componentCodes = [
      ...new Set(submontagens.flatMap((definition) => definition.componentes.map((component) => component.codigo)))
    ];
    const itemsByCode = await fetchItemsByCodes(connection, componentCodes);
    const report = {
      created: [],
      updated: [],
      mismatchedDescriptions: []
    };

    for (const definition of submontagens) {
      await upsertSubmontagem(connection, definition, itemsByCode, report);
    }

    await connection.commit();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .catch((error) => {
    console.error('Falha ao cadastrar o servo 9B:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
