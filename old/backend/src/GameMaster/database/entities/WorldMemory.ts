import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('world_memories')
@Index(['worldEntityId'])
export class WorldMemory {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid', nullable: true })
    worldEntityId!: string | null;

    @Column({ type: 'text' })
    text!: string;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    embeddingPointId!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
