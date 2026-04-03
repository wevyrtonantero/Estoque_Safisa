const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: process.env.SAFISA_ENV_FILE || path.join(__dirname, '..', '.env')
});

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function createConnectionConfig(overrides = {}) {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: toInteger(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'safisa',
    charset: process.env.DB_CHARSET || 'utf8mb4',
    ...overrides
  };
}

function createPoolConfig(overrides = {}) {
  return {
    ...createConnectionConfig(),
    waitForConnections: true,
    connectionLimit: toInteger(process.env.DB_CONNECTION_LIMIT, 10),
    queueLimit: toInteger(process.env.DB_QUEUE_LIMIT, 0),
    ...overrides
  };
}

const appConfig = {
  port: toInteger(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development'
};

module.exports = {
  appConfig,
  createConnectionConfig,
  createPoolConfig
};
