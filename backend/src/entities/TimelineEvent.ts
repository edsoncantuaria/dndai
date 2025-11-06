import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { SessaoIA } from './SessaoIA.js';

@Entity('timeline_events')
@Index(['sessaoId', 'turn'], { unique: true })
export class TimelineEvent {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    sessaoId: number;

    @ManyToOne(() => SessaoIA, sessao => sessao.timelineEvents, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessaoId' })
    sessao: SessaoIA;

    @Column({ type: 'int', unsigned: true })
    turn: number;

    @Column({ type: 'datetime' })
    timestamp: Date;

    @Column({ type: 'varchar', length: 255 })
    action: string;

    @Column({ type: 'text' })
    summary: string;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
