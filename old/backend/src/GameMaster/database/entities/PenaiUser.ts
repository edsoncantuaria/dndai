import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('penai_users')
export class PenaiUser {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 30, unique: true })
    username!: string;

    @Column({ type: 'varchar', length: 120, unique: true })
    email!: string;

    @Column({ type: 'varchar', length: 255 })
    passwordHash!: string;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @Column({ type: 'int', default: 30 })
    aiCreditsRemaining!: number;

    @Column({ type: 'int', default: 0 })
    aiCreditsUsed!: number;

    @Column({ type: 'jsonb', default: {} })
    settings!: Record<string, unknown>;

    @Column({ type: 'simple-array', nullable: true })
    installedHomebrewIds!: string[] | null;

    @Column({ type: 'boolean', default: false })
    acknowledgedHomebrewDisclaimer!: boolean;

    @Column({ type: 'varchar', length: 512, nullable: true })
    apiKey!: string | null;

    @Column({ type: 'int', nullable: true })
    licenseKeyId!: number | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
