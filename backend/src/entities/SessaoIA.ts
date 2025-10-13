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

    @Column({ type: 'varchar', length: 255 })
    apiKey: string;
    
    @Column({ type: 'int' })
    userId: number;

    @ManyToOne(() => User, user => user.sessoes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ type: 'int', nullable: true }) // Permite que a coluna seja nula
    characterId: number | null;
    
    // A relação ManyToOne foi removida para evitar a constraint de FK na inicialização.
    // O character será carregado separadamente quando necessário.

    @OneToMany(() => SessionLog, log => log.sessao, { cascade: true })
    logs: SessionLog[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
