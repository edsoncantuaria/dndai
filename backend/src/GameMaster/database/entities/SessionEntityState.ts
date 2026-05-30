import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { GameSession } from './GameSession.js';
import { WorldEntity } from './WorldEntity.js';

@Entity('session_entity_state')
@Index(['sessionId', 'worldEntityId'], { unique: true })
export class SessionEntityState {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    sessionId!: number;

    @ManyToOne(() => GameSession, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessionId' })
    session!: GameSession;

    @Column({ type: 'uuid' })
    worldEntityId!: string;

    @ManyToOne(() => WorldEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'worldEntityId' })
    worldEntity!: WorldEntity;

    @Column({ type: 'boolean', default: false })
    appeared!: boolean;

    @Column({ type: 'boolean', default: true })
    sessionAlive!: boolean;

    @Column({ type: 'boolean', default: true })
    canAppear!: boolean;

    @Column({ type: 'jsonb', default: {} })
    relationshipToHero!: Record<string, unknown>;

    @Column({ type: 'jsonb', nullable: true })
    sessionStatsSnapshot!: Record<string, unknown> | null;

    @Column({ type: 'jsonb', nullable: true })
    sessionOverlay!: Record<string, unknown> | null;

    @Column({ type: 'timestamptz', nullable: true })
    lastSeenAt!: Date | null;
}
