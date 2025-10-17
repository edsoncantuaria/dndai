// backend/src/websocket/webSocketServer.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { parse as urlParse } from 'url';
import * as NarrarService from '../services/narrarService.js';
import * as CharacterService from '../services/characterService.js';
import createError from 'http-errors';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  isAlive?: boolean;
}

export function configureWebSocket(httpServer: Server) {
    const wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
        console.log('[WSS] Novo cliente conectado.');

        // Autenticação via token na URL
        const query = urlParse(req.url || '', true).query;
        const token = query.token as string;
        
        if (!token) {
            console.warn('[WSS] Cliente conectado sem token. Encerrando conexão.');
            ws.close(1008, 'Token não fornecido');
            return;
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
            ws.userId = decoded.userId;
            ws.isAlive = true;
            console.log(`[WSS] Cliente autenticado para userId: ${ws.userId}`);
        } catch (error) {
            console.error('[WSS] Falha na verificação do token:', error);
            ws.close(1008, 'Token inválido');
            return;
        }

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('message', async (message: string) => {
            if (!ws.userId) return;

            let data;
            try {
                data = JSON.parse(message);
            } catch (e) {
                ws.send(JSON.stringify({ type: 'error', payload: { message: 'Mensagem inválida (não é JSON).' } }));
                return;
            }

            console.log(`[WSS] Mensagem recebida de userId ${ws.userId}:`, data.type);

            switch (data.type) {
                case 'processAction':
                    try {
                        const { sessionId, prompt, combatState, useAiHomebrew, apiKey } = data.payload;
                        if (!sessionId || !prompt || !apiKey) {
                            throw createError(400, "Dados insuficientes para processar a ação.");
                        }

                        ws.send(JSON.stringify({ type: 'startLoading' }));

                        const response = await NarrarService.processPlayerTurn(
                            sessionId,
                            ws.userId,
                            prompt,
                            apiKey,
                            combatState,
                            useAiHomebrew
                        );

                        ws.send(JSON.stringify({ type: 'gameStateUpdate', payload: response }));

                    } catch (error: any) {
                        console.error('[WSS] Erro ao processar ação:', error);
                        ws.send(JSON.stringify({ type: 'error', payload: { message: error.message || 'Erro interno no servidor.' } }));
                    } finally {
                        ws.send(JSON.stringify({ type: 'stopLoading' }));
                    }
                    break;
                
                case 'getCharacter':
                     try {
                        const { characterId } = data.payload;
                        if (!characterId) {
                            throw createError(400, "ID do personagem não fornecido.");
                        }
                        const character = await CharacterService.getCharacterById(characterId, ws.userId);
                        ws.send(JSON.stringify({ type: 'characterUpdate', payload: character }));

                     } catch(error: any) {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: error.message || 'Erro ao buscar personagem.' } }));
                     }
                     break;

                default:
                    ws.send(JSON.stringify({ type: 'error', payload: { message: `Tipo de mensagem desconhecido: ${data.type}` } }));
            }
        });

        ws.on('close', () => {
            console.log(`[WSS] Cliente (userId: ${ws.userId}) desconectado.`);
        });

        ws.on('error', (error) => {
            console.error(`[WSS] Erro na conexão do cliente (userId: ${ws.userId}):`, error);
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client as AuthenticatedWebSocket;
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping(() => {});
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
        console.log('[WSS] Servidor WebSocket encerrado.');
    });

    console.log('[WSS] Servidor WebSocket configurado e aguardando conexões.');
}
