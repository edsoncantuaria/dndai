import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('session_memories')
@Index(['sessionId'])
export class SessionMemory {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'uuid', nullable: true })
    worldEntityId!: string | null;

    @Column({ type: 'text' })
    text!: string;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @Column({ type: 'int', default: 50 })
    importanceScore!: number;

    @Column({ type: 'timestamptz', nullable: true })
    lastReferencedAt!: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    decayedAt!: Date | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
