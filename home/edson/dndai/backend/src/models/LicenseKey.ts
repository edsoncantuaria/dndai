// backend/src/models/LicenseKey.ts
import { Model, DataTypes, Sequelize } from '@sequelize/core';

export class LicenseKey extends Model {
  public id!: number;
  public key!: string;
  public userId!: number | null;
  public isActive!: boolean;
  public expiresAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const initializeLicenseKey = (sequelize: Sequelize) => {
  LicenseKey.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      key: {
        type: new DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'license_keys',
      sequelize,
    }
  );
}
