import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('session_faction_influence')
@Index(['sessionId', 'factionSlug', 'regionSlug'], { unique: true })
export class SessionFactionInfluence {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'varchar', length: 64 })
    factionSlug!: string;

    @Column({ type: 'varchar', length: 64 })
    regionSlug!: string;

    @Column({ type: 'int', default: 0 })
    influence!: number;

    @Column({ type: 'timestamptz', default: () => 'NOW()' })
    updatedAt!: Date;
}
