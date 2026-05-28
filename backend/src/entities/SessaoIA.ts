// backend/src/entities/SessaoIA.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, DeleteDateColumn, Index } from "typeorm";
import { SessionLog } from "./SessionLog.js";
import { User } from "./User.js";
import { Character } from "./Character.js";
import { CombatEncounter } from "./CombatEncounter.js";
import { TimelineEvent } from "./TimelineEvent.js";
import { StorySummary } from "./StorySummary.js";

@Entity('sessoes_ia')
export class SessaoIA {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100 })
    nome: string;

    @Column({ type: 'varchar', length: 255, nullable: true }) // Permitir que seja nulo
    apiKey: string;
    
    @Column({ type: 'int' })
    userId: number;

    @ManyToOne(() => User, user => user.sessoes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'int', nullable: true })
    characterId: number | null;
    
    @ManyToOne(() => Character, (character) => character.sessoes, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'characterId' })
    character: Character | null;

    @OneToMany(() => SessionLog, log => log.sessao, { cascade: true })
    logs: SessionLog[];

    @OneToMany(() => CombatEncounter, combat => combat.sessao)
    combatEncounters: CombatEncounter[];

    @OneToMany(() => TimelineEvent, event => event.sessao)
    timelineEvents: TimelineEvent[];

    @OneToMany(() => StorySummary, summary => summary.sessao)
    storySummaries: StorySummary[];
    
    @Column({ type: 'simple-json', nullable: true })
    homebrewContentIds: string[]; // Armazena IDs de todo o conteúdo necessário para esta sessão

    @Column({ type: 'int', default: 0 })
    stateVersion: number;

    @Column({ type: 'varchar', length: 64, nullable: true })
    leaseOwnerClientId: string | null;

    @Column({ type: 'datetime', nullable: true })
    leaseExpiresAt: Date | null;

    @Column({ type: 'datetime', nullable: true })
    lastHeartbeatAt: Date | null;

    @Column({ type: 'int', default: 0 })
    actionCursor: number;

    /** P4.1 — sequence monotônico servidor (narração enfileirada); ordenação de entrega. */
    @Column({ type: 'int', default: 0 })
    actionSequence: number;

    @Column({ type: 'varchar', length: 64, nullable: true })
    currentActionId: string | null;

    @Column({ type: 'varchar', length: 32, nullable: true })
    currentActionPhase: string | null;

    @Column({ type: 'datetime', nullable: true })
    actionPhaseUpdatedAt: Date | null;

    /** Loot pendente de coleta (motor autoritativo — Fase 5.1) */
    @Column({ type: 'simple-json', nullable: true })
    pendingLootOffer: Record<string, unknown> | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
