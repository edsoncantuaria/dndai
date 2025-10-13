// backend/src/entities/CharacterProficiency.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Character } from './Character.js';

@Entity('character_proficiencies')
export class CharacterProficiency {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    characterId: number;

    @ManyToOne(() => Character, character => character.proficiencies, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'characterId' })
    character: Character;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'varchar', length: 50 })
    type: string; // Ex: 'skill', 'language', 'weapon', 'armor'
}
