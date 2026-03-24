const { pool } = require('../database/connection');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function buildObservation(supplier) {
  const parts = [
    supplier.tipo ? `Tipo fornecido: ${supplier.tipo}` : '',
    supplier.endereco ? `Endereco: ${supplier.endereco}` : '',
    supplier.cep ? `CEP: ${supplier.cep}` : '',
    supplier.cidade ? `Cidade: ${supplier.cidade}` : '',
    supplier.estado ? `Estado: ${supplier.estado}` : '',
    supplier.notes || ''
  ].filter(Boolean);

  return parts.join(' | ');
}

function uniqueNumbers(values) {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value))));
}

const SUPPLIERS = [
  {
    nome: 'Aluminum',
    aliases: ['ALUMINUM'],
    tipo: 'Prato Pistao',
    endereco: 'Rua Marcos Dian, 61 - Jardim de Lucca',
    cep: '13255-210',
    cidade: 'Itatiba',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['PRATO DO PISTAO']
  },
  {
    nome: 'AMF',
    aliases: ['AMF'],
    tipo: 'Suporte Mecanico',
    endereco: 'Rua Sao Jose dos Campos, 120 - Jardim Paulista',
    cep: '13222-015',
    cidade: 'Varzea Paulista',
    estado: 'Sao Paulo',
    exactCodes: ['110'],
    descriptionTerms: ['SUPORTE']
  },
  {
    nome: 'PUMA',
    aliases: ['PUMA'],
    tipo: 'BR Aluminio',
    endereco: 'Rua Antonio Frederico, 350 - Vila Independencia',
    cep: '04224-030',
    cidade: 'Sao Paulo',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'California',
    aliases: ['CALIFORNIA', 'FUNDICAO CALIFORNIA'],
    tipo: 'Fundicao Diversos',
    endereco: 'Rua Carlos Penido Filho, 510',
    cep: '35488-000',
    cidade: 'Itaguara',
    estado: 'Minas Gerais',
    exactCodes: [],
    descriptionTerms: ['CORPO', 'FUNDICAO']
  },
  {
    nome: 'Fundicao Tiger',
    aliases: ['TIGER', 'FUNDICAO TIGER'],
    tipo: 'Fundicao Diversos',
    endereco: 'Rodovia PR-445, km 139,2',
    cep: '86140-000',
    cidade: 'Primeiro de Maio',
    estado: 'Parana',
    exactCodes: ['110'],
    descriptionTerms: ['CORPO', 'FUNDICAO']
  },
  {
    nome: 'KENTUCKY',
    aliases: ['KENTUCKY'],
    tipo: 'Aluminios red./sext.',
    endereco: 'Rua Antonio Frederico, 360 - Vila Independencia',
    cep: '04224-030',
    cidade: 'Sao Paulo',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'RAG ACOS',
    aliases: ['RAG ACOS', 'RAG AÇOS'],
    tipo: 'Acos Diversos',
    endereco: 'Avenida Bento Guelfi, 740 - Jardim Alto Alegre',
    cep: '08381-750',
    cidade: 'Sao Paulo',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'Açovisa',
    aliases: ['AÇOSVISA', 'ACOSVISA', 'ACOVISA', 'AÇOVISA'],
    tipo: 'Acos Diversos',
    endereco: 'Rua Angatuba, 350 - Cidade Industrial Satelite de Sao Paulo',
    cep: '07220-030',
    cidade: 'Guarulhos',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'Hidrontex',
    aliases: ['HIDRONTEX'],
    tipo: 'Tubo 8x6 carbono',
    endereco: 'Rua Amazonas, 419 - Vila Popular',
    cep: '13225-140',
    cidade: 'Varzea Paulista',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['TUBO 8X6']
  },
  {
    nome: '2R Laser',
    aliases: ['2R LASER', '2 R LASER', '2 R CORTE LASER'],
    tipo: 'Suportes Diversos',
    endereco: 'Avenida Alexandre Jose Barbosa, 215 - Jardim Sao Luiz II',
    cep: '13253-080',
    cidade: 'Itatiba',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['SUPORTE']
  },
  {
    nome: 'Fundmetaus',
    aliases: ['FUNDMETAUS'],
    tipo: 'Forquilha / suporte G',
    endereco: 'Rua Joaquim Tomazi, 40 - Caravaggio',
    cep: '88865-000',
    cidade: 'Nova Veneza',
    estado: 'Santa Catarina',
    exactCodes: [],
    descriptionTerms: ['FORQUILHA']
  },
  {
    nome: 'JATINOX',
    aliases: ['JATINOX', 'JATI-SERVICOS'],
    tipo: 'Inox red. 7/16 e 5/16',
    endereco: 'Rua Roberto Koch, 363 - Vila Independencia',
    cep: '04221-060',
    cidade: 'Sao Paulo',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'Aperam',
    aliases: ['APERAM'],
    tipo: 'Chapas 0,8 x 1220 x 2000',
    endereco: 'Rodovia Indio Tibirica, km 50 - Barro Branco',
    cep: '09431-600',
    cidade: 'Ribeirao Pires',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'Crismol',
    aliases: ['CRISMOL'],
    tipo: 'Molas Diversos',
    endereco: 'Rua Soldado Alcebiades Bobadilha da Cunha, 715 - Parque Novo Mundo',
    cep: '02146-010',
    cidade: 'Sao Paulo',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['MOLA']
  },
  {
    nome: 'Original Molas',
    aliases: ['ORIGINAL MOLA', 'ORIGINAL MOLAS'],
    tipo: 'Trava 136 e mola MC 038/1',
    endereco: 'Rua Mario Junqueira da Silva, 1696 - Jardim Eulina',
    cep: '13063-000',
    cidade: 'Campinas',
    estado: 'Sao Paulo',
    exactCodes: ['136', '040MC'],
    descriptionTerms: ['MOLA']
  },
  {
    nome: 'RGR',
    aliases: ['RGR'],
    tipo: 'Mangueiras ar',
    endereco: 'Rua Licatem, 275 - Jardim Fazenda Rincao',
    cep: '07428-280',
    cidade: 'Aruja',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['MANGUEIRA DE AR']
  },
  {
    nome: 'Tectubos',
    aliases: ['TECTUBOS'],
    tipo: 'Mangueiras ar',
    endereco: 'Rua Forte do Rio Branco, 721 - Parque Sao Lourenco',
    cep: '08340-140',
    cidade: 'Sao Paulo',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['MANGUEIRA DE AR']
  },
  {
    nome: 'Termicar',
    aliases: ['TERMICAR'],
    tipo: 'Terminal',
    endereco: 'Rua Princesa Maria Pia, 100 - Vila Santa Clara',
    cep: '03274-120',
    cidade: 'Sao Paulo',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['TERMINAL']
  },
  {
    nome: 'Oliver Plast',
    aliases: ['OLIVERPLAST', 'OLIVER PLAST'],
    tipo: 'Mangueiras oleo',
    endereco: 'Rua Lucia Piffer Baptistella, 195 - Vila Rita',
    cep: '13253-120',
    cidade: 'Itatiba',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['MANGUEIRA DE OLEO']
  },
  {
    nome: 'MHM',
    aliases: ['MHM'],
    tipo: 'Arruelas',
    endereco: 'Alameda Jose Lopes de Almeida, 319 - Capao Redondo',
    cep: '05859-080',
    cidade: 'Sao Paulo',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['ARRUELA']
  },
  {
    nome: 'Itatirol',
    aliases: ['ITATIROL'],
    tipo: 'Aneis, rolamentos',
    endereco: 'Avenida Prudente de Moraes, 781 - Vila Santa Cruz',
    cep: '13251-500',
    cidade: 'Itatiba',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['ROLAMENTO', 'ANEL']
  },
  {
    nome: 'Collina',
    aliases: ['COLLINA'],
    tipo: 'Diversos',
    endereco: 'Rua Rui Barbosa, 247 - Centro',
    cep: '13250-280',
    cidade: 'Itatiba',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'Motorbass',
    aliases: ['MOTORBASS'],
    tipo: 'Diversos',
    endereco: 'Rua Luiz Felipe Vilaboim Sydow, 12 - Vila Rita',
    cep: '13253-125',
    cidade: 'Itatiba',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'Retec',
    aliases: ['RETEC'],
    tipo: 'Borrachas',
    endereco: 'Rua Manuel Antonio Carvalho, 209 - Vila Clarice',
    cep: '05177-120',
    cidade: 'Sao Paulo',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['BORRACHA', 'GUARDA PO', 'GAXETA', 'O-RING', 'ORING', 'RETENTOR']
  },
  {
    nome: 'CBV',
    aliases: ['CBV'],
    tipo: 'Borrachas',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: ['BORRACHA', 'GUARDA PO', 'GAXETA', 'O-RING', 'ORING', 'RETENTOR']
  },
  {
    nome: 'CNP',
    aliases: ['CNP'],
    tipo: 'Mancal',
    endereco: 'Rua Paletrans, 500 - Industrial',
    cep: '14140-000',
    cidade: 'Cravinhos',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['MANCAL']
  },
  {
    nome: 'Prestampas (Cajamar)',
    aliases: ['PRESTAMPA', 'PRESTAMPA', 'PRESTAMPAS'],
    tipo: 'Tampas camisas',
    endereco: 'Rua Osasco, 335 - Parque Empresarial Anhanguera',
    cep: '07753-040',
    cidade: 'Cajamar',
    estado: 'Sao Paulo',
    exactCodes: [],
    descriptionTerms: ['TAMPA']
  },
  {
    nome: 'SR Products',
    aliases: ['SR PRODUCTS'],
    tipo: 'Pote graxa / bisnaga',
    endereco: 'Rua do Bosque, 69 - Barra Funda',
    cep: '01136-000',
    cidade: 'Sao Paulo',
    estado: 'Sao Paulo',
    exactCodes: ['054', '1000'],
    descriptionTerms: ['POTE DE GRAXA', 'BISNAGA DE GRAXA']
  },
  {
    nome: 'IGUS',
    aliases: ['IGUS'],
    tipo: 'Buchas 005/2 e 152/1',
    endereco: 'Rua Antonio Christi, 611 - Parque Industrial',
    cep: '13213-183',
    cidade: 'Jundiai',
    estado: 'Sao Paulo',
    exactCodes: ['005/2', '152/1'],
    descriptionTerms: []
  },
  {
    nome: 'Cobra Conexoes',
    aliases: ['COBRA CONEXOES', 'COBRA CONEXÕES'],
    tipo: 'Insert / anilha',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: ['INSERT', 'ANILHA']
  },
  {
    nome: 'Plastgolden',
    aliases: ['PLASTGOLDEN'],
    tipo: 'Saco bolha',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: ['SACO', 'BOLHA']
  },
  {
    nome: 'Com. Caixa',
    aliases: ['COM. CAIXA', 'COM CAIXA'],
    tipo: 'Caixa papelao',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: ['CAIXA']
  },
  {
    nome: 'Master Caixa',
    aliases: ['MASTER CAIXA'],
    tipo: 'Caixa papelao',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: ['CAIXA']
  },
  {
    nome: 'Loopair',
    aliases: ['LOOPAIR'],
    tipo: 'Almofada de ar',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: ['ALMOFADA DE AR', 'BOLHA']
  },
  {
    nome: 'Cyclopak (D.A. dos Santos)',
    aliases: ['CYCLOPAK', 'D.A. DOS SANTOS', 'D A DOS SANTOS'],
    tipo: 'Fita c/logo e gomada',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: ['FITA']
  },
  {
    nome: 'Quimica Rocha',
    aliases: ['QUIMICA ROCHA', 'QUÍMICA ROCHA'],
    tipo: 'Oleos diversos',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: ['OLEO']
  },
  {
    nome: 'Multielos Zincagem',
    aliases: ['MULTIELOS'],
    tipo: 'Zincagem',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Fornecedor de tratamento externo.',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'GCTerm',
    aliases: ['GCTERM'],
    tipo: 'Tempera',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Fornecedor de tratamento externo.',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'OXIBAM',
    aliases: ['OXIBAM'],
    tipo: 'Gas diversos',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'Lava Pano',
    aliases: ['LAVA PANO'],
    tipo: 'Pano industrial',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'Jose Carlos Falanga',
    aliases: ['JOSE CARLOS FALANGA'],
    tipo: 'Pastilhas etc.',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: []
  },
  {
    nome: 'Premena',
    aliases: ['PREMENA'],
    tipo: 'Ferramentas',
    endereco: null,
    cep: null,
    cidade: null,
    estado: null,
    notes: 'Precisa validar pelo nome.',
    exactCodes: [],
    descriptionTerms: []
  }
];

function matchesSupplierRule(piece, supplier) {
  const code = String(piece.codigo || '').trim().toUpperCase();
  const normalizedDescription = normalizeText(piece.descricao);

  if (supplier.exactCodes.includes(code)) {
    return true;
  }

  return supplier.descriptionTerms.some((term) => normalizedDescription.includes(normalizeText(term)));
}

async function loadCurrentSuppliers(connection) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        nome,
        telefone,
        contato,
        email,
        cep,
        endereco,
        cidade,
        observacao
      FROM fornecedores
      ORDER BY id ASC
    `
  );

  const index = new Map();
  rows.forEach((supplier) => {
    index.set(normalizeText(supplier.nome), supplier);
  });

  return { rows, index };
}

async function upsertSuppliers(connection) {
  const current = await loadCurrentSuppliers(connection);
  const supplierIdsByName = new Map();
  let created = 0;
  let updated = 0;

  for (const supplier of SUPPLIERS) {
    const existing = [supplier.nome, ...(supplier.aliases || [])]
      .map((name) => current.index.get(normalizeText(name)))
      .find(Boolean);

    const payload = {
      nome: existing ? existing.nome : supplier.nome,
      cep: supplier.cep,
      endereco: supplier.endereco,
      cidade: supplier.cidade ? `${supplier.cidade}${supplier.estado ? ` - ${supplier.estado}` : ''}` : null,
      observacao: buildObservation(supplier)
    };

    if (!existing) {
      const [result] = await connection.query(
        `
          INSERT INTO fornecedores (
            nome,
            telefone,
            contato,
            email,
            cep,
            endereco,
            cidade,
            observacao
          ) VALUES (?, NULL, NULL, NULL, ?, ?, ?, ?)
        `,
        [payload.nome, payload.cep, payload.endereco, payload.cidade, payload.observacao]
      );

      const inserted = { id: result.insertId, nome: payload.nome };
      created += 1;
      supplierIdsByName.set(supplier.nome, inserted.id);
      current.index.set(normalizeText(inserted.nome), inserted);
      (supplier.aliases || []).forEach((alias) => current.index.set(normalizeText(alias), inserted));
      continue;
    }

    const shouldUpdate = (
      String(existing.cep || '') !== String(payload.cep || '')
      || String(existing.endereco || '') !== String(payload.endereco || '')
      || String(existing.cidade || '') !== String(payload.cidade || '')
      || String(existing.observacao || '') !== String(payload.observacao || '')
    );

    if (shouldUpdate) {
      await connection.query(
        `
          UPDATE fornecedores
          SET
            cep = ?,
            endereco = ?,
            cidade = ?,
            observacao = ?
          WHERE id = ?
        `,
        [payload.cep, payload.endereco, payload.cidade, payload.observacao, existing.id]
      );
      updated += 1;
    }

    supplierIdsByName.set(supplier.nome, existing.id);
    current.index.set(normalizeText(existing.nome), existing);
    (supplier.aliases || []).forEach((alias) => current.index.set(normalizeText(alias), existing));
  }

  return { supplierIdsByName, created, updated };
}

async function loadPieces(connection) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        codigo,
        descricao,
        id_fornecedor
      FROM pecas
      WHERE classificacao = 'ITEM'
      ORDER BY codigo ASC
    `
  );

  return rows;
}

async function loadExistingLinks(connection) {
  const [rows] = await connection.query(
    `
      SELECT
        id_peca,
        id_fornecedor
      FROM peca_fornecedor
    `
  );

  const links = new Set(
    rows.map((row) => `${row.id_peca}:${row.id_fornecedor}`)
  );

  return links;
}

async function applySupplierLinks(connection, supplierIdsByName) {
  const pieces = await loadPieces(connection);
  const existingLinks = await loadExistingLinks(connection);
  const linksToCreate = [];
  const piecePrimaryUpdates = [];
  const matchedByCode = new Map();

  for (const piece of pieces) {
    const supplierIds = uniqueNumbers(
      SUPPLIERS
        .filter((supplier) => matchesSupplierRule(piece, supplier))
        .map((supplier) => supplierIdsByName.get(supplier.nome))
    );

    if (supplierIds.length === 0) {
      continue;
    }

    matchedByCode.set(piece.codigo, supplierIds.length);

    for (const supplierId of supplierIds) {
      const linkKey = `${piece.id}:${supplierId}`;
      if (existingLinks.has(linkKey)) {
        continue;
      }

      linksToCreate.push([piece.id, supplierId, null]);
      existingLinks.add(linkKey);
    }

    if (!Number.isInteger(piece.id_fornecedor) || Number(piece.id_fornecedor) === 9) {
      piecePrimaryUpdates.push([supplierIds[0], piece.id]);
    }
  }

  if (linksToCreate.length > 0) {
    await connection.query(
      `
        INSERT INTO peca_fornecedor (
          id_peca,
          id_fornecedor,
          observacao
        ) VALUES ?
      `,
      [linksToCreate]
    );
  }

  for (const [supplierId, pieceId] of piecePrimaryUpdates) {
    await connection.query(
      `
        UPDATE pecas
        SET id_fornecedor = ?
        WHERE id = ?
      `,
      [supplierId, pieceId]
    );
  }

  return {
    linksCreated: linksToCreate.length,
    primaryUpdated: piecePrimaryUpdates.length,
    matchedPieceCount: matchedByCode.size
  };
}

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { supplierIdsByName, created, updated } = await upsertSuppliers(connection);
    const linkSummary = await applySupplierLinks(connection, supplierIdsByName);

    const [counts] = await connection.query(
      `
        SELECT
          (SELECT COUNT(*) FROM fornecedores) AS fornecedores_total,
          (SELECT COUNT(*) FROM peca_fornecedor) AS vinculos_total
      `
    );

    await connection.commit();

    console.log(JSON.stringify({
      created,
      updated,
      ...linkSummary,
      fornecedoresTotal: counts[0].fornecedores_total,
      vinculosTotal: counts[0].vinculos_total,
      destaque: 'Codigo 110 vinculado a AMF e Fundicao Tiger.'
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao sincronizar catalogo de fornecedores:', error);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
