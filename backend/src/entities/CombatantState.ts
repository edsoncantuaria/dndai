import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { CombatEncounter } from './CombatEncounter.js';
import { CombatCooldown } from './CombatCooldown.js';
import { CombatStatusEffect } from './CombatStatusEffect.js';

export type CombatAttitude = 'hostile' | 'neutral' | 'ally';
export type CombatZone = 'perto' | 'medio' | 'longe' | 'coberto';

@Entity('combatant_states')
@Index(['encounterId', 'combatantId'], { unique: true })
export class CombatantState {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    encounterId: number;

    @ManyToOne(() => CombatEncounter, encounter => encounter.combatants, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'encounterId' })
    encounter: CombatEncounter;

    @Column({ type: 'varchar', length: 80 })
    combatantId: string;

    @Column({ type: 'varchar', length: 120 })
    name: string;

    @Column({ type: 'int', unsigned: true, default: 0 })
    hpCurrent: number;

    @Column({ type: 'int', unsigned: true, default: 1 })
    hpMax: number;

    @Column({ type: 'int', unsigned: true, nullable: true })
    ac: number | null;

    @Column({ type: 'int', nullable: true })
    initiative: number | null;

    @Column({ type: 'int', nullable: true })
    initiativeRoll: number | null;

    @Column({ type: 'boolean', default: false })
    isPlayer: boolean;

    @Column({ type: 'varchar', length: 16, default: 'neutral' })
    attitude: CombatAttitude;

    @Column({ type: 'simple-json', default: '[]' })
    conditions: string[];

    @Column({ type: 'boolean', default: false })
    hasMoved: boolean;

    @Column({ type: 'boolean', default: false })
    hasActed: boolean;

    @Column({ type: 'boolean', default: false })
    isDead: boolean;

    @Column({ type: 'int', unsigned: true, nullable: true })
    distance: number | null;

    @Column({ type: 'varchar', length: 16, nullable: true })
    zone: CombatZone | null;

    @Column({ type: 'int', unsigned: true, default: 0 })
    actionPoints: number;

    @Column({ type: 'int', unsigned: true, default: 0 })
    bonusActionPoints: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    readyAction: string | null;

    @Column({ type: 'json', nullable: true })
    tempModifiers: Record<string, unknown> | null;

    @Column({ type: 'json', nullable: true })
    rollHistory: Record<string, unknown>[] | null;

    @OneToMany(() => CombatCooldown, cooldown => cooldown.combatant, { cascade: true })
    cooldowns: CombatCooldown[];

    @OneToMany(() => CombatStatusEffect, effect => effect.combatant, { cascade: true })
    statusEffects: CombatStatusEffect[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
