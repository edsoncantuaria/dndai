// backend/src/entities/LicenseKey.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';
import { User } from './User.js';

@Entity('license_keys')
export class LicenseKey {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true, length: 255 })
    key: string;

    @Column({ default: false })
    isActivated: boolean;

    @Column({ nullable: true })
    activatedByUserId: number;
}
