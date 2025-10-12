// backend/src/models/Log.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { GameSession } from './GameSession';

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sessionId: number;

  @ManyToOne(() => GameSession, session => session.logs)
  @JoinColumn({ name: 'sessionId' })
  session: GameSession;

  @Column({
    type: 'enum',
    enum: ['narration', 'action', 'system', 'combat', 'insight', 'roll'],
  })
  type: 'narration' | 'action' | 'system' | 'combat' | 'insight' | 'roll';

  @Column('text')
  content: string;

  @Column('json', { nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
