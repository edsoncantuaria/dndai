// backend/src/models/User.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, BeforeInsert, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import bcrypt from 'bcryptjs';
import { Character } from './Character';
import { LicenseKey } from './LicenseKey';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @OneToMany(() => Character, character => character.user)
  characters: Character[];
  
  @OneToOne(() => LicenseKey, license => license.user)
  license: LicenseKey;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, 10);
  }

  async checkPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}
