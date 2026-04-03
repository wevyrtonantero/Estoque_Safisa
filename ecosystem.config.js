module.exports = {
  apps: [
    {
      name: 'safisa',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT || 3000,
        DB_HOST: process.env.DB_HOST || '127.0.0.1',
        DB_PORT: process.env.DB_PORT || 3306,
        DB_NAME: process.env.DB_NAME || 'safisa',
        DB_USER: process.env.DB_USER || 'safisa_app',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        DB_CHARSET: process.env.DB_CHARSET || 'utf8mb4',
        DB_CONNECTION_LIMIT: process.env.DB_CONNECTION_LIMIT || 10,
        DB_QUEUE_LIMIT: process.env.DB_QUEUE_LIMIT || 0
      }
    }
  ]
};
