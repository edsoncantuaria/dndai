// backend/src/models/index.ts
import { Sequelize } from 'sequelize';
import 'dotenv/config';
import User, { initUser } from './User';
import LicenseKey, { initLicenseKey } from './LicenseKey';
import Character, { initCharacter } from './Character';
import GameSession, { initGameSession } from './GameSession';
import Log, { initLog } from './Log';

const env = process.env.NODE_ENV || 'development';
const dbConfig = require('../config/database')[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    logging: false, // Desative o logging de SQL no console se preferir
  }
);

// Inicializa os modelos
initUser(sequelize);
initLicenseKey(sequelize);
initCharacter(sequelize);
initGameSession(sequelize);
initLog(sequelize);

// Define as associações
User.hasMany(Character, { foreignKey: 'userId', as: 'characters' });
Character.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(LicenseKey, { foreignKey: 'userId', as: 'license' });
LicenseKey.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Character.hasMany(GameSession, { foreignKey: 'characterId', as: 'gameSessions' });
GameSession.belongsTo(Character, { foreignKey: 'characterId', as: 'character' });

GameSession.hasMany(Log, { foreignKey: 'sessionId', as: 'logs' });
Log.belongsTo(GameSession, { foreignKey: 'sessionId', as: 'session' });

export {
  sequelize,
  User,
  LicenseKey,
  Character,
  GameSession,
  Log
};
