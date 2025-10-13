// backend/src/entities/Relationship.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Character } from './Character.js';
import { Quest } from './Quest.js';

@Entity('relationships')
export class Relationship {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    characterId: number;

    @ManyToOne(() => Character, character => character.relationships, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'characterId' })
    character: Character;

    @Column({ type: 'varchar', length: 100 })
    npcId: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({
        type: 'enum',
        enum: ['hostile', 'unfriendly', 'neutral', 'friendly', 'ally'],
        default: 'neutral'
    })
    status: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'ally';

    @Column({ type: 'int', default: 0 })
    affinity: number;

    @OneToMany(() => Quest, quest => quest.relationship, { cascade: true })
    quests: Quest[];
}

    