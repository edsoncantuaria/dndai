import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from './User';
import { GameSession } from './GameSession';

@Entity('characters')
export class Character {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, user => user.characters, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({ name: 'character_data', type: 'json' })
    characterData!: object; // Armazenará o JSON completo do personagem

    @OneToMany(() => GameSession, session => session.character)
    gameSessions!: GameSession[];
    
    @Column({ default: true, name: 'is_active' })
    isActive!: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;

    @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deletedAt!: Date | null;

    @Column({ name: 'last_played_at', type: 'timestamp', nullable: true })
    lastPlayedAt!: Date | null;
    
    @Column({ name: 'total_play_time_seconds', type: 'int', default: 0 })
    totalPlayTimeSeconds!: number;
}
