import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { Connection } from 'mysql2/promise';

import { setupDatabase } from './src/config/database';
import { setupAuthRoutes } from './src/routes/auth';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middlewares
app.use(cors());
app.use(express.json());

let dbConnection: Connection;

// Setup Inicial
async function startServer() {
    try {
        dbConnection = await setupDatabase();
        console.log("Conexão com o banco de dados MySQL estabelecida com sucesso.");

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
        console.error("Falha ao iniciar o servidor:", error);
        process.exit(1);
    }
}

startServer();
