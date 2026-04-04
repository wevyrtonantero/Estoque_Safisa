const mysql = require('mysql2/promise');
const { createConnectionConfig } = require('../database/config');
const UsuarioModel = require('../src/models/UsuarioModel');
const { hashPassword } = require('../src/security/passwordUtils');
const { ALL_ROLES, normalizeRole } = require('../src/security/roles');

async function main() {
  const login = String(process.argv[2] || '').trim();
  const password = String(process.argv[3] || '').trim();
  const role = normalizeRole(process.argv[4] || '');
  const nome = String(process.argv[5] || login).trim();

  if (!login || !password || !role) {
    console.error('Uso: node scripts/upsert-user.js <login> <senha> <perfil> [nome]');
    console.error(`Perfis validos: ${ALL_ROLES.join(', ')}`);
    process.exit(1);
  }

  const connection = await mysql.createConnection(createConnectionConfig());

  try {
    await connection.beginTransaction();
    const senhaHash = hashPassword(password);
    const userId = await UsuarioModel.upsertUser({
      nome,
      login,
      senhaHash,
      role,
      ativo: true
    }, connection);
    await connection.commit();

    console.log(JSON.stringify({
      id: userId,
      login: UsuarioModel.normalizeLogin(login),
      nome,
      role
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    console.error('Falha ao criar/atualizar o usuario.');
    console.error(error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
