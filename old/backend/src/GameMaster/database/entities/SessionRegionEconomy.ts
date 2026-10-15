import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('session_region_economy')
@Index(['sessionId', 'regionSlug', 'itemSlug'], { unique: true })
export class SessionRegionEconomy {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'varchar', length: 64 })
    regionSlug!: string;

    @Column({ type: 'varchar', length: 64 })
    itemSlug!: string;

    @Column({ type: 'float', default: 10 })
    basePrice!: number;

    @Column({ type: 'float', default: 10 })
    currentPrice!: number;

    @Column({ type: 'float', default: 0 })
    scarcity!: number;

    @Column({ type: 'timestamptz', default: () => 'NOW()' })
    updatedAt!: Date;
}
