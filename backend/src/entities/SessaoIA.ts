// backend/src/entities/SessaoIA.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, DeleteDateColumn } from "typeorm";
import { SessionLog } from "./SessionLog.js";
import { User } from "./User.js";
import { Character } from "./Character.js"; // Importa a nova entidade

@Entity('sessoes_ia')
export class SessaoIA {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100 })
    nome: string;

    @Column({ type: 'varchar', length: 255, nullable: true }) // Permitir que seja nulo
    apiKey: string;
    
    @Column({ type: 'int' })
    userId: number;

    @ManyToOne(() => User, user => user.sessoes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'int', nullable: true })
    characterId: number | null;
    
    @ManyToOne(() => Character, (character) => character.sessoes, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'characterId' })
    character: Character | null;

    @Column({ type: 'simple-json', nullable: true })
    homebrewContentIds: string[]; // Armazena os IDs do conteúdo homebrew "instalado"

    @OneToMany(() => SessionLog, log => log.sessao, { cascade: true, eager: true })
    logs: SessionLog[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
