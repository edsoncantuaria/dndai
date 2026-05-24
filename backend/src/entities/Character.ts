// backend/src/entities/Character.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    OneToOne,
    Index,
} from 'typeorm';
import { User } from './User.js';
import { SessaoIA } from './SessaoIA.js';
import { CharacterAttributes } from './CharacterAttributes.js';
import { CharacterProficiency } from './CharacterProficiency.js';
import { CharacterItem } from './CharacterItem.js';
import { CharacterSpell } from './CharacterSpell.js';
import { JournalEntry } from './JournalEntry.js';
import { Relationship } from './Relationship.js';
import { CharacterResource } from './CharacterResource.js';

const jsonColumnTransformer = {
    to: (value: unknown) => {
        if (value === null || value === undefined) return null;
        try {
            return JSON.stringify(value);
        } catch {
            return JSON.stringify(null);
        }
    },
    from: (value: string | null) => {
        if (!value) return null;
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    },
};

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
    
    @Column({ type: 'longtext', nullable: true, transformer: jsonColumnTransformer })
    feats: any[] | null;
    
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

    @OneToMany(() => CharacterResource, resource => resource.character, { cascade: true })
    resources: CharacterResource[];

    @OneToMany(() => SessaoIA, (sessao) => sessao.character)
    sessoes: SessaoIA[];
    
    @OneToMany(() => JournalEntry, journal => journal.character, { cascade: true })
    journal: JournalEntry[];

    @OneToMany(() => Relationship, relationship => relationship.character, { cascade: true })
    relationships: Relationship[];
    
    // Campos de narrativa persistente que permanecem aqui
    @Column({ type: 'text', nullable: true })
    storySoFar: string; 

    @Column({ type: 'longtext', nullable: true, transformer: jsonColumnTransformer })
    factionReputation: Record<string, number> | null;

    @Column({ type: 'longtext', nullable: true, transformer: jsonColumnTransformer })
    worldState: Record<string, any> | null;

    @Column({ type: 'longtext', nullable: true, transformer: jsonColumnTransformer })
    gameClock:
        | {
              day?: number;
              hour?: number;
              weather?: string;
          }
        | null;

    /** Moedas autoritativas (pp/gp/ep/sp/cp) — Fase 5.3 */
    @Column({ type: 'longtext', nullable: true, transformer: jsonColumnTransformer })
    coins: Record<string, number> | null;
    
    @Column({ type: 'varchar', length: 100, nullable: true })
    currentRegion: string;

    @Column({ type: 'boolean', default: true })
    isTemplate: boolean;

    /** ID do personagem-template no cofre (quando este registro é um clone de sessão). */
    @Column({ type: 'int', nullable: true })
    templateCharacterId: number | null;

    @Column({ type: 'int', nullable: true })
    sessionId: number | null;


    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
