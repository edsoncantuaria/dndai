// backend/src/entities/Quest.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { Relationship } from './Relationship.js';
import { QuestKeyword } from './QuestKeyword.js';

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

    @ManyToMany(() => QuestKeyword, keyword => keyword.quests, { cascade: false })
    @JoinTable({
        name: 'quest_keyword_links',
        joinColumn: { name: 'questId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'keywordId', referencedColumnName: 'id' },
    })
    keywords: QuestKeyword[];
}
