import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { User } from '../entities/User';
import { Character } from '../entities/Character';
import { GameSession } from '../entities/GameSession';
import { LicenseKey } from '../entities/LicenseKey';

dotenv.config({ path: 'backend/.env' });

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: true, // CUIDADO: Usar apenas em desenvolvimento. Cria o schema do BD automaticamente.
    logging: false,
    entities: [User, Character, GameSession, LicenseKey],
    migrations: [],
    subscribers: [],
});
