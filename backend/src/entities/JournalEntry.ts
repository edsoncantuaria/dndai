// backend/src/entities/JournalEntry.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Tree, TreeChildren, TreeParent } from 'typeorm';
import { Character } from './Character.js';

@Entity('journal_entries')
@Tree("closure-table")
export class JournalEntry {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'int', nullable: true })
    characterId: number | null;

    @ManyToOne(() => Character, character => character.journal, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'characterId' })
    character: Character | null;

    @Column({ type: 'varchar', length: 150 })
    name: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    region: string;

    @Column({ type: 'text', nullable: true })
    summary: string;

    @Column({ type: 'boolean', default: false })
    looted: boolean;

    @TreeChildren()
    subLocations: JournalEntry[];

    @TreeParent({ onDelete: 'CASCADE' })
    parentLocation: JournalEntry;
}
