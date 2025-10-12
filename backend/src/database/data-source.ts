import 'reflect-metadata';
import { DataSource } from 'typeorm';
import 'dotenv/config';

import { User } from '../models/User';
import { LicenseKey } from '../models/LicenseKey';
import { Character } from '../models/Character';
import { GameSession } from '../models/GameSession';
import { Log } from '../models/Log';

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: true, // Em desenvolvimento, podemos usar isso para criar tabelas automaticamente. Mude para 'false' e use migrações em produção.
    logging: false,
    entities: [User, LicenseKey, Character, GameSession, Log],
    migrations: [],
    subscribers: [],
});
