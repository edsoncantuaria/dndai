// backend/src/entities/QuestKeyword.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, Unique } from 'typeorm';
import { Quest } from './Quest.js';

@Entity('quest_keywords')
@Unique('UQ_quest_keywords_slug', ['slug'])
export class QuestKeyword {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  keyword: string;

  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => Quest, quest => quest.keywords, { onDelete: 'CASCADE' })
  quests: Quest[];
}
