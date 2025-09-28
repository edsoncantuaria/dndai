import mysql, { Connection, ConnectionOptions } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig: ConnectionOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
};

let connection: Connection;

export const setupDatabase = async (): Promise<Connection> => {
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Conectado ao banco de dados MySQL.');
        return connection;
    } catch (error) {
        console.error('Erro ao conectar ao banco de dados:', error);
        throw error;
    }
};

export const getConnection = (): Connection => {
    if (!connection) {
        throw new Error("A conexão com o banco de dados não foi estabelecida.");
    }
    return connection;
};
