// backend/src/models/GameSession.ts
import { Model, DataTypes, Sequelize } from 'sequelize';

class GameSession extends Model {
  public id!: number;
  public characterId!: number;
  public worldState!: any; // JSONB
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public static initialize(sequelize: Sequelize) {
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        characterId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'characters',
            key: 'id',
          },
        },
        worldState: {
          type: DataTypes.JSON,
          allowNull: true, // Pode começar nulo
        },
      },
      {
        tableName: 'game_sessions',
        sequelize,
      }
    );
  }
}

export default GameSession;
