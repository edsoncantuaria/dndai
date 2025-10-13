// backend/src/entities/CharacterSpell.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Character } from './Character.js';

@Entity('character_spells')
export class CharacterSpell {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    characterId: number;

    @ManyToOne(() => Character, character => character.spells, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'characterId' })
    character: Character;

    @Column({ type: 'varchar', length: 100 })
    spellName: string; // Armazena o nome ou o índice da magia
}
