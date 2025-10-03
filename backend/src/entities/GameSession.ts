import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
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

    @Column({ default: true })
    is_active!: boolean;

    @CreateDateColumn({ name: 'started_at' })
    startedAt!: Date;

    @Column({ type: 'timestamp', nullable: true, default: null })
    ended_at!: Date | null;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
    
    @Column({ type: 'timestamp', nullable: true, default: null })
    deleted_at!: Date | null;
}
