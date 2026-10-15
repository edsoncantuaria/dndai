import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    ManyToOne,
    JoinColumn,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { GameSession } from './GameSession.js';
import { SessionCombatant } from './SessionCombatant.js';

@Entity('session_combat_encounters')
@Index(['sessionId', 'isActive'])
export class SessionCombatEncounter {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    sessionId!: number;

    @ManyToOne(() => GameSession, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessionId' })
    session!: GameSession;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    @Column({ type: 'int', default: 1 })
    round!: number;

    @Column({ type: 'int', default: 0 })
    turn!: number;

    @Column({ type: 'varchar', length: 32, default: 'ACTIVE' })
    phase!: string;

    @Column({ type: 'jsonb', nullable: true })
    initiativeOrder!: string[] | null;

    @OneToMany(() => SessionCombatant, c => c.encounter, { cascade: true })
    combatants!: SessionCombatant[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
