import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import Character from './Character';

interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password_hash: string;
}

// Para a criação, o 'id' é opcional
interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public email!: string;
  public password_hash!: string;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associações (opcional, para tipagem forte)
  public readonly characters?: Character[];
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: new DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    email: {
      type: new DataTypes.STRING(128),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: new DataTypes.STRING(256),
      allowNull: false,
    },
  },
  {
    tableName: 'users',
    sequelize, // Conexão
  }
);

export default User;
