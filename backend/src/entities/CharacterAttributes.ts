// backend/src/entities/CharacterAttributes.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, AfterLoad } from 'typeorm';
import { Character } from './Character.js';

@Entity('character_attributes')
export class CharacterAttributes {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int', unique: true })
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
    
    @Column({ type: 'int', default: 10 })
    hp: number;
    
    @Column({ type: 'int', default: 0 })
    maxHp: number;

    @Column({ type: 'int', default: 10 })
    ac: number;

    @Column({ type: 'json', nullable: true })
    conditions: any[];
}
