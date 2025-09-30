import 'reflect-metadata';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppDataSource } from './src/config/data-source';
import { setupAuthRoutes } from './src/routes/auth';
import { Connection } from 'mysql2/promise';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middlewares
app.use(cors());
app.use(express.json());

// Setup Inicial
async function startServer() {
    try {
        await AppDataSource.initialize();
        console.log("Conexão com o banco de dados estabelecida com sucesso via TypeORM.");

        // Para as rotas de autenticação existentes, ainda precisamos da conexão mysql2.
        // Isso será refatorado nas próximas fases para usar o TypeORM completamente.
        const dbConnection: Connection = AppDataSource.driver.master as any;

        // Configuração de Rotas
        setupAuthRoutes(app, dbConnection);

        // Configuração do WebSocket
        wss.on('connection', ws => {
            console.log('Cliente WebSocket conectado.');

            ws.on('message', message => {
                console.log('Mensagem recebida: %s', message);
                // Lógica de manipulação de mensagens do WebSocket virá aqui
            });

            ws.on('close', () => {
                console.log('Cliente WebSocket desconectado.');
            });

            ws.on('error', error => {
                console.error('Erro no WebSocket:', error);
            });
        });

        const PORT = process.env.PORT || 8080;
        server.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
        });

    } catch (error) {
        console.error("Falha ao iniciar o servidor ou conectar ao banco de dados:", error);
        process.exit(1);
    }
}

startServer();
