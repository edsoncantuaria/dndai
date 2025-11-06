import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CombatantState } from './CombatantState.js';

@Entity('combat_status_effects')
@Index(['combatantStateId', 'effectKey'], { unique: true })
export class CombatStatusEffect {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    combatantStateId: number;

    @ManyToOne(() => CombatantState, combatant => combatant.statusEffects, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'combatantStateId' })
    combatant: CombatantState;

    @Column({ type: 'varchar', length: 80 })
    effectKey: string;

    @Column({ type: 'varchar', length: 160 })
    name: string;

    @Column({ type: 'int', unsigned: true, nullable: true })
    remainingRounds: number | null;

    @Column({ type: 'varchar', length: 160, nullable: true })
    source: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    description: string | null;

    @Column({ type: 'varchar', length: 10, nullable: true })
    severity: 'leve' | 'moderado' | 'grave' | null;
}
