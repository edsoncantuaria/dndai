import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CanonicalRegion } from './CanonicalRegion.js';

@Entity('canonical_pois')
export class CanonicalPoi {
    @PrimaryColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    regionId!: string;

    @ManyToOne(() => CanonicalRegion, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'regionId' })
    region!: CanonicalRegion;

    @Column({ type: 'varchar', length: 120 })
    slug!: string;

    @Column({ type: 'varchar', length: 160 })
    displayName!: string;

    @Column({ type: 'varchar', length: 32, default: 'landmark' })
    poiType!: string;

    @Column({ type: 'int', default: 5 })
    maxImportantNpcs!: number;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;
}
