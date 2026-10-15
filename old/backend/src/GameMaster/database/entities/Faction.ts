import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('factions')
export class Faction {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 120, unique: true })
    slug!: string;

    @Column({ type: 'varchar', length: 160 })
    displayName!: string;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'varchar', length: 32, default: 'neutral' })
    alignment!: string;

    @Column({ type: 'varchar', length: 48, nullable: true })
    archetype!: string | null;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;
}
