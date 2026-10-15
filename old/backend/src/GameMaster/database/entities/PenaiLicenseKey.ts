import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from 'typeorm';

@Entity('penai_license_keys')
export class PenaiLicenseKey {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255, unique: true })
    key!: string;

    @Column({ type: 'boolean', default: false })
    isActivated!: boolean;

    @Column({ type: 'int', nullable: true })
    activatedByUserId!: number | null;

    @Column({ type: 'timestamptz', nullable: true })
    expiresAt!: Date | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @DeleteDateColumn()
    deletedAt!: Date | null;
}
