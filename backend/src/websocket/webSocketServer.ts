// backend/src/websocket/webSocketServer.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { parse as urlParse } from 'url';
import * as NarrarService from '../services/narrarService.js';
import * as CharacterService from '../services/characterService.js';
import createError from 'http-errors';
import { getPendingRollRequest, clearPendingRollRequest } from '../services/rollRequestService.js';
import type { PlayerRollRequest } from '../types.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  isAlive?: boolean;
}

const sanitizeRollValues = (values: unknown[]): number[] => {
    if (!Array.isArray(values)) return [];
    return values
        .map(value => Number(value))
        .filter(value => Number.isFinite(value));
};

const computeRawRollFromValues = (request: PlayerRollRequest, diceValues: number[]): number => {
    if (!diceValues.length) return 0;
    const notation = (request.dice || '').toLowerCase();
    const isAdvDis = notation === '1d20' && (request.advantage || request.disadvantage);
    if (isAdvDis) {
        return request.advantage
            ? Math.max(...diceValues)
            : Math.min(...diceValues);
    }
    return diceValues.reduce((sum, value) => sum + value, 0);
};

const buildRollResolutionPrompt = (
    request: PlayerRollRequest,
    diceValues: number[],
    rawRoll: number,
    total: number
) => {
    const modifier = request.modifier || 0;
    const modifierText = modifier
        ? ` ${modifier >= 0 ? '+' : '-'} ${Math.abs(modifier)}`
        : '';
    const dcText = typeof request.dc === 'number'
        ? ` (CD ${request.dc}, ${total >= request.dc ? 'sucesso' : 'falha'})`
        : '';
    const advText = request.advantage
        ? ' com vantagem'
        : request.disadvantage
            ? ' com desvantagem'
            : '';

    return `Resultado da rolagem "${request.reason}": ${total}. (Dados ${request.dice}${advText}: [${diceValues.join(', ')}]${modifierText})${dcText}`.trim();
};

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

                        const pendingRoll = await getPendingRollRequest(sessionId);
                        if (pendingRoll) {
                            throw createError(409, `Você precisa resolver a rolagem pendente "${pendingRoll.reason}" antes de continuar.`);
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
                
                case 'submitRollResult':
                    try {
                        const { sessionId, requestId, rolls, apiKey, combatState, useAiHomebrew } = data.payload;
                        if (!sessionId || !requestId || !apiKey) {
                            throw createError(400, 'Dados insuficientes para enviar o resultado da rolagem.');
                        }

                        const pending = await getPendingRollRequest(sessionId);
                        if (!pending) {
                            throw createError(409, 'Não há rolagens pendentes para esta sessão.');
                        }
                        if (pending.userId !== ws.userId) {
                            throw createError(403, 'Você não tem permissão para resolver esta rolagem.');
                        }
                        if (pending.requestId !== requestId) {
                            throw createError(400, 'Identificador da rolagem inválido ou expirado.');
                        }

                        const diceValues = sanitizeRollValues(rolls);
                        if (!diceValues.length) {
                            throw createError(400, 'Nenhuma rolagem válida foi recebida.');
                        }

                        const rawRoll = computeRawRollFromValues(pending, diceValues);
                        const modifier = pending.modifier || 0;
                        const total = rawRoll + modifier;
                        const actionText = buildRollResolutionPrompt(pending, diceValues, rawRoll, total);

                        ws.send(JSON.stringify({ type: 'startLoading' }));

                        let response;
                        try {
                            response = await NarrarService.processPlayerTurn(
                                sessionId,
                                ws.userId,
                                actionText,
                                apiKey,
                                combatState,
                                useAiHomebrew
                            );
                            await clearPendingRollRequest(sessionId);
                            ws.send(JSON.stringify({ type: 'gameStateUpdate', payload: response }));
                        } finally {
                            ws.send(JSON.stringify({ type: 'stopLoading' }));
                        }
                    } catch (error: any) {
                        console.error('[WSS] Erro ao enviar resultado de rolagem:', error);
                        ws.send(JSON.stringify({ type: 'error', payload: { message: error.message || 'Falha ao registrar resultado da rolagem.' } }));
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
            
            // Lógica corrigida: se estiver inativo, termina. Senão, prepara para o próximo ciclo.
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
