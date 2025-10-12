// backend/src/models/Log.ts
import { Model, DataTypes, Sequelize } from 'sequelize';

class Log extends Model {
  public id!: number;
  public sessionId!: number;
  public type!: 'narration' | 'action' | 'system' | 'combat' | 'insight' | 'roll';
  public content!: string;
  public metadata!: any | null; // JSONB para dados extras, como resultados de rolagens

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const initLog = (sequelize: Sequelize) => {
    Log.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        sessionId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'game_sessions',
            key: 'id',
          },
        },
        type: {
          type: DataTypes.ENUM('narration', 'action', 'system', 'combat', 'insight', 'roll'),
          allowNull: false,
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
        },
      },
      {
        tableName: 'logs',
        sequelize,
      }
    );
};

export default Log;
