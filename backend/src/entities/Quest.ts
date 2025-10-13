// backend/src/entities/Quest.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Relationship } from './Relationship.js';

@Entity('quests')
export class Quest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'int', nullable: true })
    relationshipId: number | null;

    @ManyToOne(() => Relationship, relationship => relationship.quests, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'relationshipId' })
    relationship: Relationship | null;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({
        type: 'enum',
        enum: ['active', 'completed', 'failed'],
        default: 'active'
    })
    status: 'active' | 'completed' | 'failed';

    @Column({ type: 'json' }) // Armazena os objetivos como um array de strings
    objectives: string[];
}
