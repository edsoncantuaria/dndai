import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('canonical_region_links')
@Index(['fromRegionId', 'toRegionId'], { unique: true })
export class CanonicalRegionLink {
    @PrimaryColumn('uuid')
    id!: string;

    @Column('uuid')
    fromRegionId!: string;

    @Column('uuid')
    toRegionId!: string;

    @Column({ type: 'float' })
    distanceKm!: number;

    /** Duração base em horas (ex.: 48h = 2 dias a pé no ritmo canônico). */
    @Column({ type: 'float' })
    baseDurationHours!: number;

    @Column({ type: 'varchar', length: 64, nullable: true })
    biome!: string | null;

    @Column({ type: 'float', default: 1 })
    terrainModifier!: number;

    @Column({ type: 'boolean', default: false })
    isLocked!: boolean;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
