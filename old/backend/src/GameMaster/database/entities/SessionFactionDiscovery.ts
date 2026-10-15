import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('session_faction_discovery')
@Index(['sessionId', 'factionSlug'], { unique: true })
export class SessionFactionDiscovery {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'varchar', length: 64 })
    factionSlug!: string;

    @Column({ type: 'varchar', length: 32, default: 'story' })
    source!: string;

    @CreateDateColumn({ type: 'timestamptz' })
    discoveredAt!: Date;
}
