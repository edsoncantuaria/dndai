import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface CharacterAttributes {
  id: number;
  userId: number;
  name: string;
  level: number;
  stats: object; // Para armazenar JSON
}

interface CharacterCreationAttributes extends Optional<CharacterAttributes, 'id'> {}

class Character extends Model<CharacterAttributes, CharacterCreationAttributes> implements CharacterAttributes {
  public id!: number;
  public userId!: number;
  public name!: string;
  public level!: number;
  public stats!: object;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Character.init(
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
    name: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    level: {
      type: DataTypes.INTEGER.UNSIGNED,
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

export default Character;
