// Conexao com o banco de dados MySQL.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'safisa',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Testa se o banco esta acessivel antes de usar o CRUD.
async function testConnection() {
  const connection = await pool.getConnection();

  try {
    await connection.ping();
    console.log('Conexao com o MySQL realizada com sucesso.');
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  testConnection
};
