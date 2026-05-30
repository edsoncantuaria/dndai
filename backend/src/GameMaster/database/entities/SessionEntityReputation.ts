import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('session_entity_reputation')
@Index(['sessionId', 'worldEntityId', 'targetSlug'], { unique: true })
export class SessionEntityReputation {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    sessionId!: number;

    @Column({ type: 'uuid' })
    worldEntityId!: string;

    @Column({ type: 'varchar', length: 64 })
    targetSlug!: string;

    @Column({ type: 'int', default: 0 })
    score!: number;

    @Column({ type: 'timestamptz', default: () => 'NOW()' })
    updatedAt!: Date;
}
