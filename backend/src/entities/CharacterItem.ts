// backend/src/entities/CharacterItem.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Character } from './Character.js';

@Entity('character_items')
export class CharacterItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    characterId: number;

    @ManyToOne(() => Character, character => character.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'characterId' })
    character: Character;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'int' })
    quantity: number;

    @Column({ type: 'json' })
    itemData: any; // Armazena o objeto completo do item para referência futura
}
