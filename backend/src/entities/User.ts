// backend/src/entities/User.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { LicenseKey } from './LicenseKey.js';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true, length: 50 })
    username: string;

    @Column({ unique: true, length: 100 })
    email: string;

    @Column({ length: 255 })
    password: string;

    @Column({ nullable: true })
    licenseKeyId: number;

    @OneToOne(() => LicenseKey)
    @JoinColumn()
    licenseKey: LicenseKey;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
