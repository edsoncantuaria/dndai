// backend/src/entities/Character.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.js';
import { SessaoIA } from './SessaoIA.js';

@Entity('characters')
export class Character {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'int' })
    userId: number;

    @ManyToOne(() => User, user => user.characters, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'json' })
    characterData: any; // Armazenará o objeto completo da ficha do personagem

    @Column({ type: 'int', default: 1 })
    level: number;

    @Column({ type: 'varchar', length: 50 })
    characterClass: string;

    @Column({ type: 'varchar', length: 50 })
    race: string;

    @OneToMany(() => SessaoIA, (sessao) => sessao.character)
    sessoes: SessaoIA[];
    
    // Novas colunas para persistência de narrativa e estado do mundo
    @Column({ type: 'text', nullable: true })
    storySoFar: string; // "Crônicas da Aventura" do personagem

    @Column({ type: 'json', nullable: true })
    factionReputation: Record<string, number>; // ex: {"Harpers": 10, "Zhentarim": -5}

    @Column({ type: 'json', nullable: true })
    worldState: Record<string, any>; // ex: {"tyrant_deposed": true}


    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
