import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { CombatEncounter } from './CombatEncounter.js';

@Entity('combat_log_entries')
@Index(['encounterId', 'orderIndex'])
export class CombatLogEntry {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    encounterId: number;

    @ManyToOne(() => CombatEncounter, encounter => encounter.logs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'encounterId' })
    encounter: CombatEncounter;

    @Column({ type: 'int', unsigned: true })
    orderIndex: number;

    @Column({ type: 'int', unsigned: true, nullable: true })
    round: number | null;

    @Column({ type: 'int', unsigned: true, nullable: true })
    turn: number | null;

    @Column({ type: 'varchar', length: 500 })
    message: string;

    @CreateDateColumn()
    createdAt: Date;
}
