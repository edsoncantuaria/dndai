import dotenv from 'dotenv';
dotenv.config(); // Carrega as variáveis do arquivo .env na raiz do diretório do backend

import 'reflect-metadata';
import express, { Express, Request, Response } from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { AppDataSource } from './src/config/data-source';
import { setupAuthRoutes } from './src/routes/auth';
import { setupLicenseRoutes } from './src/routes/license';
import { setupUserRoutes } from './src/routes/user';
import { gameMasterFlow, testAiConnectionFlow } from './src/services/geminiService';
import { expressHandler } from '@genkit-ai/express';
import { UserFacingError } from 'genkit';
import { getUserApiKey } from './src/utils/user-service';

const app: Express = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middlewares
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Setup Inicial
async function startServer() {
    try {
        await AppDataSource.initialize();
        console.log("Conexão com o banco de dados estabelecida com sucesso via TypeORM.");

        // Configuração de Rotas
        setupAuthRoutes(app);
        setupLicenseRoutes(app);
        setupUserRoutes(app);

        // Endpoint para o Game Master Flow do Genkit
        app.post(
          '/api/game-master',
          expressHandler({
            flow: gameMasterFlow,
            context: async (req: Request) => {
              const { userId } = req.body;
              if (!userId) {
                throw new UserFacingError(
                  "INVALID_ARGUMENT",
                  'userId é obrigatório.'
                );
              }
              const apiKey = await getUserApiKey(userId);
              if (!apiKey) {
                throw new UserFacingError(
                  "UNAUTHENTICATED",
                  'A chave de API do Google do usuário não foi encontrada ou é inválida.'
                );
              }
              return { apiKey };
            },
          })
        );
        
        // Endpoint para Teste da IA
        app.post(
            '/api/test-ai',
             expressHandler({
                flow: testAiConnectionFlow,
                context: async (req: Request) => {
                    const { userId } = req.body;
                     if (!userId) {
                        throw new UserFacingError("INVALID_ARGUMENT",'userId é obrigatório.');
                    }
                    const apiKey = await getUserApiKey(userId);
                    if (!apiKey) {
                        throw new UserFacingError("UNAUTHENTICATED",'A chave de API do Google do usuário não foi encontrada ou é inválida.');
                    }
                    return { apiKey };
                }
            })
        );


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

        const PORT = process.env.PORT || 8071;
        server.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
        });

    } catch (error) {
        console.error("Falha ao iniciar o servidor ou conectar ao banco de dados:", error);
        process.exit(1);
    }
}

startServer();
