import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('canonical_regions')
export class CanonicalRegion {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 120, unique: true })
    slug!: string;

    @Column({ type: 'varchar', length: 160 })
    displayName!: string;

    @Column({ type: 'text', nullable: true })
    summary!: string | null;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
