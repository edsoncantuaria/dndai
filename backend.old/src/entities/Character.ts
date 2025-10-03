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

    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ name: 'character_data', type: 'json' })
    characterData!: object; // Armazenará o JSON completo do personagem

    @OneToMany(() => GameSession, session => session.character)
    gameSessions!: GameSession[];
    
    @Column({ default: true })
    is_active!: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;

    @Column({ type: 'timestamp', nullable: true, default: null })
    deleted_at!: Date | null;

    @Column({ type: 'timestamp', nullable: true, default: null })
    last_played_at!: Date | null;
    
    @Column({ type: 'int', default: 0 })
    total_play_time_seconds!: number;
}
