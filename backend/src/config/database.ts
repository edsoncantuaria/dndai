import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Configuração da conexão com o banco de dados usando Sequelize
export const sequelize = new Sequelize(
  process.env.DB_DATABASE || 'cfa_game_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false, // Desative o logging de queries SQL no console
  }
);
