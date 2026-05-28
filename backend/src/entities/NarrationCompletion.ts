import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

/** P4.2 — idempotência de persistência pós-narração (retry BullMQ). */
@Entity('narration_completions')
@Unique('UQ_narration_completion_session_action', ['sessionId', 'actionId'])
@Index(['sessionId', 'actionSequence'])
export class NarrationCompletion {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    sessionId: number;

    @Column({ type: 'varchar', length: 64 })
    actionId: string;

    @Column({ type: 'int', nullable: true })
    actionSequence: number | null;

    @CreateDateColumn()
    completedAt: Date;
}
