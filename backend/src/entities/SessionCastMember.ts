import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { SessaoIA } from './SessaoIA.js';
import { Character } from './Character.js';
import { User } from './User.js';

export type CastRole = 'pc' | 'npc' | 'ally' | 'enemy';
export type CastVitals = 'alive' | 'dead' | 'unconscious' | 'unknown';

@Entity('session_cast_members')
@Index(['sessionId', 'displayName'])
export class SessionCastMember {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    sessionId: number;

    @ManyToOne(() => SessaoIA, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessionId' })
    session: SessaoIA;

    /** Dono que adicionou o personagem ao elenco da sessão. */
    @Column({ type: 'int' })
    ownerUserId: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ownerUserId' })
    owner: User;

    /** Personagem do cofre (opcional) — permite reutilizar ficha entre sessões. */
    @Column({ type: 'int', nullable: true })
    characterId: number | null;

    @ManyToOne(() => Character, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'characterId' })
    character: Character | null;

    @Column({ type: 'varchar', length: 120 })
    displayName: string;

    @Column({ type: 'varchar', length: 16, default: 'npc' })
    role: CastRole;

    @Column({ type: 'varchar', length: 20, default: 'alive' })
    vitals: CastVitals;

    @Column({ type: 'simple-json', nullable: true })
    sheetSnapshot: Record<string, unknown> | null;

    @Column({ type: 'simple-json', nullable: true })
    metadata: Record<string, unknown> | null;

    /** Visível para narrativa / outros jogadores da mesa. */
    @Column({ type: 'boolean', default: true })
    visibleToParty: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
