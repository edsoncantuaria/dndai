import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('travel_mode_catalog')
export class TravelModeCatalog {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    slug!: string;

    @Column({ type: 'varchar', length: 80 })
    displayName!: string;

    /** Multiplicador de velocidade (>1 = mais rápido, menor duração). */
    @Column({ type: 'float' })
    speedMultiplier!: number;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
