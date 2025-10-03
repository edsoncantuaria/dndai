import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface LogAttributes {
  id: number;
  userId: number;
  action: string;
  details: object;
}

interface LogCreationAttributes extends Optional<LogAttributes, 'id'> {}

class Log extends Model<LogAttributes, LogCreationAttributes> implements LogAttributes {
  public id!: number;
  public userId!: number;
  public action!: string;
  public details!: object;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Log.init(
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
    action: {
      type: new DataTypes.STRING(255),
      allowNull: false,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'logs',
    sequelize,
  }
);

export default Log;
