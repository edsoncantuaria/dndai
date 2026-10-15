import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('narrative_summaries')
@Index(['sessionId'])
export class NarrativeSummary {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'text' })
    summary!: string;

    @Column({ type: 'int', default: 0 })
    fromActionSequence!: number;

    @Column({ type: 'int', default: 0 })
    toActionSequence!: number;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    embeddingPointId!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
