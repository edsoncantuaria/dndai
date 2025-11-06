// backend/src/entities/CombatEncounter.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { SessaoIA } from './SessaoIA.js';

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

    @Column({ type: 'json' })
    state: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
