import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { PenaiUser } from './PenaiUser.js';

@Entity('game_sessions')
@Index(['userId'])
export class GameSession {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    userId!: number;

    @ManyToOne(() => PenaiUser, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: PenaiUser;

    @Column({ type: 'varchar', length: 100 })
    nome!: string;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @Column({ type: 'int', default: 0 })
    stateVersion!: number;

    @Column({ type: 'int', default: 0 })
    actionSequence!: number;

    @Column({ type: 'int', default: 0 })
    actionCursor!: number;

    @Column({ type: 'uuid', nullable: true })
    heroWorldEntityId!: string | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    currentRegionSlug!: string | null;

    @Column({ type: 'jsonb', nullable: true })
    pendingLootOffer!: Record<string, unknown> | null;

    @Column({ type: 'jsonb', nullable: true })
    motorShopState!: Record<string, unknown> | null;

    @Column({ type: 'int', nullable: true })
    activeCombatEncounterId!: number | null;

    /** Relógio narrativo da campanha (dia, hora, clima). */
    @Column({ type: 'jsonb', nullable: true })
    gameClock!: Record<string, unknown> | null;

    @Column({ type: 'bigint', nullable: true })
    lastProjectedEventId!: string | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
