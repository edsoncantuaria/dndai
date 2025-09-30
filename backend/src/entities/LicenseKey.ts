import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('license_keys')
export class LicenseKey {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    key!: string;

    @Column({ name: 'is_active', default: false })
    isActive!: boolean;

    @Column({ name: 'expires_at', type: 'timestamp' })
    expiresAt!: Date;

    @Column({ name: 'user_id', type: 'int', nullable: true })
    userId!: number | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
