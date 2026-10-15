import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('session_knowledge')
@Index(['sessionId', 'holderEntityId', 'factKey'], { unique: true })
export class SessionKnowledge {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'uuid' })
    holderEntityId!: string;

    @Column({ type: 'varchar', length: 128 })
    factKey!: string;

    @Column({ type: 'text' })
    factText!: string;

    @Column({ type: 'varchar', length: 16, default: 'witnessed' })
    source!: 'witnessed' | 'rumor' | 'quest';

    @CreateDateColumn({ type: 'timestamptz' })
    learnedAt!: Date;
}
