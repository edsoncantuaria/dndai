// backend/src/entities/CharacterResource.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Character } from './Character.js';

@Entity('character_resources')
export class CharacterResource {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    characterId: number;

    @ManyToOne(() => Character, character => character.resources, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'characterId' })
    character: Character;

    @Column({ type: 'varchar', length: 64 })
    type: string;

    @Column({ type: 'varchar', length: 128 })
    resourceKey: string;

    @Column({ type: 'int', default: 0 })
    current: number;

    @Column({ type: 'int', default: 0 })
    max: number;

    @Column({ type: 'json', nullable: true })
    metadata?: Record<string, any>;
}
