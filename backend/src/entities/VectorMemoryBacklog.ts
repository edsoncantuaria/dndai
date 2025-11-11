// backend/src/entities/VectorMemoryBacklog.ts
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'vector_memory_backlog' })
export class VectorMemoryBacklog {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    id!: string;

    @Column({ type: 'varchar', length: 64 })
    collection!: string;

    @Column({ type: 'longtext' })
    text!: string;

    @Column({ type: 'json' })
    metadata!: Record<string, unknown>;

    @Column({ type: 'varchar', length: 128 })
    apiKeyHash!: string;

    @Column({ type: 'boolean', default: false })
    embedded!: boolean;

    @Column({ type: 'datetime', nullable: true })
    embeddedAt!: Date | null;

    @Column({ type: 'text', nullable: true })
    lastError!: string | null;

    @Column({ type: 'int', default: 0 })
    retryCount!: number;

    @CreateDateColumn({ type: 'datetime' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'datetime' })
    updatedAt!: Date;
}
