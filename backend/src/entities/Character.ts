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

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
