// backend/src/database/data-source.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import 'dotenv/config';

import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { User } from '../entities/User.js';
import { LicenseKey } from '../entities/LicenseKey.js';
import { Character } from '../entities/Character.js';

/**
 * Configuração da fonte de dados para o TypeORM.
 * Lê as credenciais do banco de dados do arquivo .env.
 */
export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    
    /**
     * `synchronize: true` cria o esquema do banco de dados automaticamente
     * com base nas entidades. Ótimo para desenvolvimento, mas para produção
     * é recomendado usar migrações (`synchronize: false`).
     */
    synchronize: true, 
    logging: false, // Mude para true para ver as queries SQL no console
    
    // Lista de todas as entidades que o TypeORM deve gerenciar
    entities: [SessaoIA, SessionLog, User, LicenseKey, Character], 
    
    migrations: [],
    subscribers: [],
});
