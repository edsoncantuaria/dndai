// backend/src/entities/CharacterAttributes.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Character } from './Character.js';

@Entity('character_attributes')
export class CharacterAttributes {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    characterId: number;

    @OneToOne(() => Character, character => character.attributes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'characterId' })
    character: Character;

    @Column({ type: 'int' })
    strength: number;

    @Column({ type: 'int' })
    dexterity: number;

    @Column({ type: 'int' })
    constitution: number;

    @Column({ type: 'int' })
    intelligence: number;

    @Column({ type: 'int' })
    wisdom: number;

    @Column({ type: 'int' })
    charisma: number;
}
