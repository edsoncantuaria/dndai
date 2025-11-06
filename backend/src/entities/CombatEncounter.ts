// backend/src/entities/CombatEncounter.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { SessaoIA } from './SessaoIA.js';
import { CombatantState } from './CombatantState.js';
import { CombatLogEntry } from './CombatLogEntry.js';

@Entity('combat_encounters')
export class CombatEncounter {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({ type: 'int' })
    sessaoId: number;

    @ManyToOne(() => SessaoIA, sessao => sessao.combatEncounters, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessaoId' })
    sessao: SessaoIA;

    @Column({ type: 'boolean', default: false })
    isActive: boolean;

    @Column({ type: 'int', default: 1 })
    round: number;

    @Column({ type: 'int', default: 0 })
    turn: number;

    @Column({ type: 'simple-json', nullable: true })
    initiativeOrder: string[] | null;

    @Column({ type: 'json', nullable: true, name: 'state' })
    legacyState?: Record<string, any> | null;

    @OneToMany(() => CombatantState, combatant => combatant.encounter, { cascade: true })
    combatants: CombatantState[];

    @OneToMany(() => CombatLogEntry, log => log.encounter, { cascade: true })
    logs: CombatLogEntry[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
