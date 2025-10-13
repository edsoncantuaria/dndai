// backend/src/entities/LicenseKey.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('license_keys')
export class LicenseKey {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', unique: true, length: 255 })
    key: string;

    @Column({ type: 'boolean', default: false })
    isActivated: boolean;

    @Column({ type: 'int', nullable: true })
    activatedByUserId: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
