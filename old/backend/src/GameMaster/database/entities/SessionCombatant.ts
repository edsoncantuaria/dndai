import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { SessionCombatEncounter } from './SessionCombatEncounter.js';

@Entity('session_combatants')
@Index(['encounterId', 'entityKey'], { unique: true })
export class SessionCombatant {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    encounterId!: number;

    @ManyToOne(() => SessionCombatEncounter, e => e.combatants, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'encounterId' })
    encounter!: SessionCombatEncounter;

    @Column({ type: 'varchar', length: 64 })
    entityKey!: string;

    @Column({ type: 'varchar', length: 120 })
    displayName!: string;

    @Column({ type: 'varchar', length: 16, default: 'enemy' })
    side!: 'hero' | 'ally' | 'enemy';

    @Column({ type: 'int' })
    hpCurrent!: number;

    @Column({ type: 'int' })
    hpMax!: number;

    @Column({ type: 'int', default: 10 })
    armorClass!: number;

    @Column({ type: 'int', default: 0 })
    initiative!: number;

    @Column({ type: 'jsonb', default: [] })
    conditions!: string[];
}
