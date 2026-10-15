import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('narration_completions')
export class NarrationCompletion {
    @PrimaryColumn({ type: 'varchar', length: 128 })
    workflowId!: string;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'int' })
    actionSequence!: number;

    @CreateDateColumn({ type: 'timestamptz' })
    completedAt!: Date;
}
