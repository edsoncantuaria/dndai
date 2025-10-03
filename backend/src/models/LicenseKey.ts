
import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface LicenseKeyAttributes {
  id: number;
  key: string;
  is_active: boolean;
  expires_at: Date;
  userId: number | null;
}

interface LicenseKeyCreationAttributes extends Optional<LicenseKeyAttributes, 'id' | 'is_active' | 'userId'> {}

class LicenseKey extends Model<LicenseKeyAttributes, LicenseKeyCreationAttributes> implements LicenseKeyAttributes {
  public id!: number;
  public key!: string;
  public is_active!: boolean;
  public expires_at!: Date;
  public userId!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

LicenseKey.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    key: {
      type: new DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  },
  {
    tableName: 'license_keys',
    sequelize,
  }
);

export default LicenseKey;
