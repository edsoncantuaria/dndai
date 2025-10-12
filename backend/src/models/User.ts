// backend/src/models/User.ts
import { Model, DataTypes, Sequelize } from 'sequelize';
import bcrypt from 'bcryptjs';

class User extends Model {
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public async checkPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}

export const initUser = (sequelize: Sequelize) => {
    User.init(
      {
        id: {
          type: DataTypes.INTEGER,
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
        password: {
          type: new DataTypes.STRING(255),
          allowNull: false,
        },
      },
      {
        tableName: 'users',
        sequelize,
        hooks: {
          beforeCreate: async (user: any) => {
            if (user.password) {
              const salt = await bcrypt.genSalt(10);
              user.password = await bcrypt.hash(user.password, salt);
            }
          },
          beforeUpdate: async (user: any) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
          }
        },
      }
    );
};

export default User;
