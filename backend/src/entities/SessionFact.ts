import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { SessaoIA } from './SessaoIA.js';
import { Character } from './Character.js';

export type SessionFactCategory = 'region' | 'npc' | 'quest' | 'general';
export type SessionFactSource = 'motor' | 'ai' | 'system';

@Entity('session_facts')
@Index(['sessaoId', 'isActive'])
@Index(['sessaoId', 'category'])
export class SessionFact {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'int' })
    sessaoId: number;

    @ManyToOne(() => SessaoIA, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessaoId' })
    sessao: SessaoIA;

    @Column({ type: 'int', nullable: true })
    characterId: number | null;

    @ManyToOne(() => Character, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'characterId' })
    character: Character | null;

    @Column({ type: 'varchar', length: 32 })
    category: SessionFactCategory;

    @Column({ type: 'varchar', length: 120, nullable: true })
    subject: string | null;

    @Column({ type: 'text' })
    fact: string;

    @Column({ type: 'varchar', length: 120, nullable: true })
    regionSlug: string | null;

    @Column({ type: 'varchar', length: 120, nullable: true })
    npcId: string | null;

    @Column({ type: 'varchar', length: 120, nullable: true })
    questId: string | null;

    @Column({ type: 'varchar', length: 16, default: 'ai' })
    source: SessionFactSource;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
