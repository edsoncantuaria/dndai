import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CombatantState } from './CombatantState.js';

@Entity('combat_cooldowns')
@Index(['combatantStateId', 'cooldownKey'], { unique: true })
export class CombatCooldown {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    combatantStateId: number;

    @ManyToOne(() => CombatantState, combatant => combatant.cooldowns, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'combatantStateId' })
    combatant: CombatantState;

    @Column({ type: 'varchar', length: 80 })
    cooldownKey: string;

    @Column({ type: 'varchar', length: 160 })
    name: string;

    @Column({ type: 'int', unsigned: true })
    remainingRounds: number;

    @Column({ type: 'int', unsigned: true, nullable: true })
    totalRounds: number | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    description: string | null;

    @Column({ type: 'varchar', length: 80, nullable: true })
    resource: string | null;
}
