import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('session_snapshots')
@Index(['sessionId'])
export class SessionSnapshot {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'int', default: 0 })
    actionSequence!: number;

    @Column({ type: 'jsonb' })
    payload!: Record<string, unknown>;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
