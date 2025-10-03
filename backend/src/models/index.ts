import User from './User';
import Character from './Character';
import GameSession from './GameSession';
import Log from './Log';

// Definir associações entre os modelos
User.hasMany(Character, { foreignKey: 'userId', as: 'characters' });
Character.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(GameSession, { foreignKey: 'userId', as: 'gameSessions' });
GameSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Character.hasMany(GameSession, { foreignKey: 'characterId', as: 'gameSessions' });
GameSession.belongsTo(Character, { foreignKey: 'characterId', as: 'character' });

User.hasMany(Log, { foreignKey: 'userId', as: 'logs' });
Log.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Exportar todos os modelos para fácil acesso
export { User, Character, GameSession, Log };
