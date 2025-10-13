// backend/src/entities/SessionLog.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, DeleteDateColumn, UpdateDateColumn } from "typeorm";
import { SessaoIA } from "./SessaoIA.js";

/**
 * Entidade que armazena uma única interação (prompt e resposta)
 * dentro de uma sessão de IA.
 */
@Entity('session_logs')
export class SessionLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    sessaoId: number;

    @ManyToOne(() => SessaoIA, sessao => sessao.logs)
    @JoinColumn({ name: "sessaoId" })
    sessao: SessaoIA;

    @Column('text')
    prompt: string;

    @Column('text')
    response: string;

    @CreateDateColumn()
    timestamp: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
