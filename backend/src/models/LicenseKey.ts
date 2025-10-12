// backend/src/models/LicenseKey.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User';

@Entity('license_keys')
export class LicenseKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  key: string;

  @Column({ nullable: true })
  userId: number | null;

  @OneToOne(() => User, user => user.license)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
