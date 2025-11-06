import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, UpdateDateColumn, Index } from 'typeorm';
import { SessaoIA } from './SessaoIA.js';

@Entity('story_summaries')
@Index(['sessaoId'], { unique: true })
export class StorySummary {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    sessaoId: number;

    @ManyToOne(() => SessaoIA, sessao => sessao.storySummaries, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessaoId' })
    sessao: SessaoIA;

    @Column({ type: 'text' })
    summary: string;

    @Column({ type: 'int', unsigned: true, default: 0 })
    entriesSummarized: number;

    @UpdateDateColumn()
    updatedAt: Date;
}
