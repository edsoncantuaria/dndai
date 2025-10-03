import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface GameSessionAttributes {
  id: number;
  userId: number;
  characterId: number;
  state: object; // JSON
}

interface GameSessionCreationAttributes extends Optional<GameSessionAttributes, 'id'> {}

class GameSession extends Model<GameSessionAttributes, GameSessionCreationAttributes> implements GameSessionAttributes {
  public id!: number;
  public userId!: number;
  public characterId!: number;
  public state!: object;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GameSession.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    characterId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'characters',
        key: 'id',
      },
    },
    state: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    tableName: 'game_sessions',
    sequelize,
  }
);

export default GameSession;
