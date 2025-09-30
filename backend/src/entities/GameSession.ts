import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Character } from './Character';

@Entity('game_sessions')
export class GameSession {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Character, character => character.gameSessions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'character_id' })
    character!: Character;

    @Column({ name: 'game_state', type: 'json' })
    gameState!: object; // Armazenará o estado completo do jogo (log, estado de combate, etc)

    @Column({ name: 'is_active', default: true })
    isActive!: boolean;

    @CreateDateColumn({ name: 'started_at' })
    startedAt!: Date;

    @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
    endedAt!: Date | null;
}
