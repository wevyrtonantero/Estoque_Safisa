const { pool } = require('../database/connection');

const CONTACTS = [
  { aliases: ['ALUMINUM'], telefone: '(11) 4538-3155', email: 'societario@jotacontabil.com.br' },
  { aliases: ['PUMA'], telefone: '(11) 96428-0355 / (11) 2914-4556', email: 'contato@pumametais.com.br' },
  { aliases: ['CALIFORNIA'], telefone: '(31) 3184-1192 / (31) 3184-1196', email: 'california@fundicaocalifornia.com.br' },
  { aliases: ['RAG ACOS', 'RAG AÇOS'], telefone: '(11) 3385-2244 / WhatsApp (11) 99682-1237', email: 'vendas@ragcom.com.br ; financeiro@ragcom.com.br' },
  { aliases: ['HIDRONTEX'], telefone: '(11) 4606-2594 / (11) 98751-4018 / (11) 99919-2114', email: 'vendas@hidrontex.com.br' },
  { aliases: ['2R LASER'], telefone: '(11) 4524-3463 / 4524-2929 / 4524-2970 / (11) 98994-4136', email: 'comercial2@2rcortelaser.com.br ; comercial@2rcortelaser.com.br' },
  { aliases: ['FUNDMETAUS'], telefone: '(48) 3476-0589' },
  { aliases: ['JATINOX'], telefone: '(11) 2172-0405 / (11) 2060-0405 / (41) 3245-5111 / (19) 3115-4300', email: 'vendas@jati.com.br' },
  { aliases: ['APERAM'], telefone: '(11) 4822-7074', email: 'tubos.comercial@aperam.com' },
  { aliases: ['CRISMOL'], telefone: '(11) 2986-9657' },
  { aliases: ['ORIGINAL MOLAS', 'ORIGINAL MOLA'], telefone: '(19) 3242-2760' },
  { aliases: ['RGR'], telefone: '(11) 4654-3008 / WhatsApp (11) 95043-8443' },
  { aliases: ['OLIVER PLAST', 'OLIVERPLAST'], telefone: '(11) 4538-3154', email: 'belem@contabildobelem.com.br' },
  { aliases: ['ITATIROL'], telefone: '(11) 4538-1504' },
  { aliases: ['MOTORBASS'], telefone: '(11) 4534-4666 / (11) 4538-6188 / (11) 97414-2776' },
  { aliases: ['RETEC'], telefone: '(11) 3906-1400 / 3901-4605', email: 'vendas@retec.com.br' },
  { aliases: ['CNP'], telefone: '(16) 3518-1818 / (11) 98117-1448', email: 'cnp@cnpautomotiva.com.br' },
  { aliases: ['IGUS'], email: 'vendas@igus.com.br' },
  { aliases: ['COBRA CONEXOES', 'COBRA CONEXÕES'], telefone: '(11) 2915-6622' },
  { aliases: ['PLASTGOLDEN'], telefone: '(11) 2283-0555 / (11) 2959-6643', email: 'sergio@plastgolden.com.br ; plastgold.brasil@gmail.com' },
  { aliases: ['LOOPAIR'], telefone: '(11) 4594-2343' },
  { aliases: ['QUIMICA ROCHA', 'QUÍMICA ROCHA'], telefone: '(41) 3347-0701', email: 'qualidade@southquim.com.br' },
  { aliases: ['MULTIELOS ZINCAGEM', 'MULTIELOS'], telefone: '(19) 3256-7675' },
  { aliases: ['GCTERM'], telefone: '(19) 3838-2086', email: 'gcterm@hotmail.com' },
  { aliases: ['JOSE CARLOS FALANGA', 'JOSE CARLOS FALANGA'], telefone: '(11) 4812-3537 / (11) 97536-0845', email: 'unitools.mf@hotmail.com ; unitoools.jcf@hotmail.com' },
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

async function main() {
  const [rows] = await pool.query('SELECT id, nome, telefone, email FROM fornecedores');
  const byName = new Map(rows.map((row) => [normalize(row.nome), row]));

  let updated = 0;
  const missing = [];

  for (const contact of CONTACTS) {
    const supplier = contact.aliases
      .map((alias) => byName.get(normalize(alias)))
      .find(Boolean);

    if (!supplier) {
      missing.push(contact.aliases[0]);
      continue;
    }

    const nextTelefone = contact.telefone || supplier.telefone || null;
    const nextEmail = contact.email || supplier.email || null;

    if (nextTelefone === supplier.telefone && nextEmail === supplier.email) {
      continue;
    }

    await pool.query(
      'UPDATE fornecedores SET telefone = ?, email = ? WHERE id = ?',
      [nextTelefone, nextEmail, supplier.id]
    );
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        updated,
        missing,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
