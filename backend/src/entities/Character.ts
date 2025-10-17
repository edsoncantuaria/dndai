// backend/src/entities/Character.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToMany, OneToOne, Index } from 'typeorm';
import { User } from './User.js';
import { SessaoIA } from './SessaoIA.js';
import { CharacterAttributes } from './CharacterAttributes.js';
import { CharacterProficiency } from './CharacterProficiency.js';
import { CharacterItem } from './CharacterItem.js';
import { CharacterSpell } from './CharacterSpell.js';
import { JournalEntry } from './JournalEntry.js';
import { Relationship } from './Relationship.js';


@Entity('characters')
export class Character {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int' })
    userId: number;

    @ManyToOne(() => User, user => user.characters, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'varchar', length: 100 })
    name: string;
    
    @Column({ type: 'varchar', length: 50 })
    race: string;
    
    @Column({ type: 'varchar', length: 50, nullable: true })
    subrace: string | null;

    @Column({ type: 'varchar', length: 50 })
    characterClass: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    subclassFlavor: string;

    @Column({ type: 'int', default: 1 })
    level: number;
    
    @Column({type: 'int', default: 0})
    xp: number;

    @Column({ type: 'varchar', length: 50 })
    background: string;

    @Column({ type: 'varchar', length: 50 })
    alignment: string;
    
    @Column({ type: 'text', nullable: true })
    backstory: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    ideal: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    bond: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    flaw: string;
    
    @Column({ type: 'varchar', length: 20, nullable: true })
    sex: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    hairStyle: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    beardStyle: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    skinColor: string;
    
    @Column({ type: 'json', nullable: true })
    feats: any[];
    
    @Index()
    @Column({ type: 'simple-json', nullable: true })
    homebrewContentIds: string[]; // Armazena IDs de raça, classe, antecedente, etc.

    // Relações com as novas entidades
    @OneToOne(() => CharacterAttributes, attributes => attributes.character, { cascade: true })
    attributes: CharacterAttributes;

    @OneToMany(() => CharacterProficiency, proficiency => proficiency.character, { cascade: true })
    proficiencies: CharacterProficiency[];

    @OneToMany(() => CharacterItem, item => item.character, { cascade: true })
    items: CharacterItem[];
    
    @OneToMany(() => CharacterSpell, spell => spell.character, { cascade: true })
    spells: CharacterSpell[];

    @OneToMany(() => SessaoIA, (sessao) => sessao.character)
    sessoes: SessaoIA[];
    
    @OneToMany(() => JournalEntry, journal => journal.character, { cascade: true, eager: true })
    journal: JournalEntry[];

    @OneToMany(() => Relationship, relationship => relationship.character, { cascade: true, eager: true })
    relationships: Relationship[];
    
    // Campos de narrativa persistente que permanecem aqui
    @Column({ type: 'text', nullable: true })
    storySoFar: string; 

    @Column({ type: 'json', nullable: true })
    factionReputation: Record<string, number>;

    @Column({ type: 'json', nullable: true })
    worldState: Record<string, any>; 
    
    @Column({ type: 'varchar', length: 100, nullable: true })
    currentRegion: string;


    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
