// backend/src/websocket/webSocketServer.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { parse as urlParse } from 'url';
import * as CharacterService from '../services/characterService.js';
import createError from 'http-errors';
import { cancelledActions, handleProcessAction, handleSubmitRollResult } from '../action-pipeline/index.js';
import { registerWsConnection, unregisterWsConnection } from './wsConnectionRegistry.js';

interface AuthenticatedWebSocket extends WebSocket {
    userId?: number;
    isAlive?: boolean;
}

export function configureWebSocket(httpServer: Server) {
    const wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
        console.log('[WSS] Novo cliente conectado.');
        const activeActions = new Set<string>();

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
            registerWsConnection(ws);
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
            } catch {
                ws.send(JSON.stringify({ type: 'error', payload: { message: 'Mensagem inválida (não é JSON).' } }));
                return;
            }

            console.log(`[WSS] Mensagem recebida de userId ${ws.userId}:`, data.type);

            switch (data.type) {
                case 'processAction':
                    await handleProcessAction(ws, data.payload, { activeActions });
                    break;

                case 'submitRollResult':
                    await handleSubmitRollResult(ws, data.payload);
                    break;

                case 'getCharacter':
                    try {
                        const { characterId } = data.payload;
                        if (!characterId) {
                            throw createError(400, 'ID do personagem não fornecido.');
                        }
                        const character = await CharacterService.getCharacterById(characterId, ws.userId);
                        ws.send(JSON.stringify({ type: 'characterUpdate', payload: character }));
                    } catch (error: unknown) {
                        const err = error as { message?: string };
                        ws.send(
                            JSON.stringify({
                                type: 'error',
                                payload: { message: err.message || 'Erro ao buscar personagem.' },
                            }),
                        );
                    }
                    break;

                default:
                    ws.send(
                        JSON.stringify({
                            type: 'error',
                            payload: { message: `Tipo de mensagem desconhecido: ${data.type}` },
                        }),
                    );
            }
        });

        ws.on('close', () => {
            unregisterWsConnection(ws);
            if (activeActions.size) {
                activeActions.forEach(id => cancelledActions.add(id));
                activeActions.clear();
            }
            console.log(`[WSS] Cliente (userId: ${ws.userId}) desconectado.`);
        });

        ws.on('error', error => {
            console.error(`[WSS] Erro na conexão do cliente (userId: ${ws.userId}):`, error);
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client as AuthenticatedWebSocket;

            if (ws.isAlive === false) {
                console.log(`[WSS] Cliente (userId: ${ws.userId}) inativo. Encerrando conexão.`);
                ws.terminate();
            } else {
                ws.isAlive = false;
                ws.ping();
            }
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
        console.log('[WSS] Servidor WebSocket encerrado.');
    });

    console.log('[WSS] Servidor WebSocket configurado e aguardando conexões.');
}
