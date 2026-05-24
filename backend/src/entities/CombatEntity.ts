import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { CombatEncounter } from './CombatEncounter.js';

export type CombatEntityKind = 'npc' | 'monster' | 'summon' | 'trap' | 'environment';

export interface ScheduledEffectPayload {
    id: string;
    label: string;
    trigger: {
        round?: number;
        turn?: number;
        event?: string;
    };
    effect: Record<string, any>;
}

@Entity('combat_entities')
@Index(['encounterId', 'entityId'], { unique: true })
export class CombatEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    encounterId: number;

    @ManyToOne(() => CombatEncounter, encounter => encounter.entities, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'encounterId' })
    encounter: CombatEncounter;

    @Column({ type: 'varchar', length: 64 })
    entityId: string;

    @Column({ type: 'varchar', length: 120 })
    name: string;

    @Column({ type: 'varchar', length: 24, default: 'npc' })
    kind: CombatEntityKind;

    @Column({ type: 'int', unsigned: true, default: 1 })
    hpMax: number;

    @Column({ type: 'int', unsigned: true, default: 1 })
    hpCurrent: number;

    @Column({ type: 'int', unsigned: true, nullable: true })
    ac: number | null;

    @Column({ type: 'json', nullable: true })
    metadata?: Record<string, any> | null;

    @Column({ type: 'json', nullable: true })
    pendingEffects: ScheduledEffectPayload[];

    @Column({ type: 'json', nullable: true })
    activeConditions?: string[] | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
