// backend/src/models/GameSession.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Character } from './Character';
import { Log } from './Log';

@Entity('game_sessions')
export class GameSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  characterId: number;

  @ManyToOne(() => Character, character => character.gameSessions)
  character: Character;

  @Column('json', { nullable: true })
  worldState: any;
  
  @OneToMany(() => Log, log => log.session)
  logs: Log[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
