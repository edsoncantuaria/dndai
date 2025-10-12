// backend/src/models/Character.ts
import { DataTypes, Model, Sequelize } from '@sequelize/core';

export class Character extends Model {
  public id!: number;
  public userId!: number;
  public name!: string;
  public level!: number;
  public stats!: any; // JSONB para armazenar a ficha completa

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const initializeCharacter = (sequelize: Sequelize) => {
  Character.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      name: {
        type: new DataTypes.STRING(128),
        allowNull: false,
      },
      level: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
      },
      stats: {
        type: DataTypes.JSON,
        allowNull: false,
      },
    },
    {
      tableName: 'characters',
      sequelize,
    }
  );
}
