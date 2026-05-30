import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('world_entity_relations')
@Index(['fromEntityId', 'toEntityId', 'relationType'], { unique: true })
export class WorldEntityRelation {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column('uuid')
    fromEntityId!: string;

    @Column('uuid')
    toEntityId!: string;

    @Column({ type: 'varchar', length: 48 })
    relationType!: string;

    @Column({ type: 'int', default: 0 })
    score!: number;

    @Column({ type: 'int', nullable: true })
    sessionId!: number | null;

    @Column({ type: 'varchar', length: 16, default: 'pt-BR' })
    locale!: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;
}
