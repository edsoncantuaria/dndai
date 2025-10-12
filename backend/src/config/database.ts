// backend/src/config/database.ts
import 'dotenv/config';

const config = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  dialect: 'mysql' as const, // Assegura que o dialeto é do tipo correto
};

// O Sequelize-CLI espera que o módulo exporte diretamente as configurações
// para cada ambiente.
module.exports = {
  development: config,
  test: config,
  production: config,
};
