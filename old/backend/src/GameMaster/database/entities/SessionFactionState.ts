import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('session_faction_state')
@Index(['sessionId', 'factionSlug'], { unique: true })
export class SessionFactionState {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'varchar', length: 64 })
    factionSlug!: string;

    @Column({ type: 'int', default: 0 })
    reputationScore!: number;

    @Column({ type: 'timestamptz', default: () => 'NOW()' })
    updatedAt!: Date;
}
