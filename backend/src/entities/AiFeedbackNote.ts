import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('ai_feedback_notes')
@Index(['sessionId', 'scenarioLabel', 'focus'], { unique: true })
export class AiFeedbackNote {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 80 })
    sessionId: string;

    @Column({ type: 'varchar', length: 80, nullable: true })
    scenarioLabel: string | null;

    @Column({ type: 'varchar', length: 16 })
    focus: string;

    @Column({ type: 'json' })
    counts: Record<string, number>;

    @Column({ type: 'json', nullable: true })
    lastDetails: Record<string, unknown> | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

