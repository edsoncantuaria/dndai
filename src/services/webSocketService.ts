// src/services/webSocketService.ts

const WEBSOCKET_URL = 'wss://backend-5e.edsin-server.space';

let socket: WebSocket | null = null;
let messageQueue: any[] = [];
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

interface MessagePayload {
    type: string;
    payload: any;
}

const eventListeners: Record<string, ((payload: any) => void)[]> = {};

function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }
    
    isConnecting = true;
    const token = localStorage.getItem('token');
    if (!token) {
        console.error("WebSocket: Token não encontrado, abortando conexão.");
        isConnecting = false;
        return;
    }

    const urlWithToken = `${WEBSOCKET_URL}?token=${token}`;
    console.log("[WSS] Tentando conectar a:", urlWithToken);
    socket = new WebSocket(urlWithToken);

    socket.onopen = () => {
        console.log('[WSS] Conexão WebSocket estabelecida.');
        isConnecting = false;
        reconnectAttempts = 0;
        // Envia mensagens enfileiradas após a conexão
        messageQueue.forEach(msg => socket?.send(JSON.stringify(msg)));
        messageQueue = [];
    };

    socket.onmessage = (event) => {
        try {
            const message: MessagePayload = JSON.parse(event.data);
            console.log('[WSS] Mensagem recebida:', message.type);

            if (eventListeners[message.type]) {
                eventListeners[message.type].forEach(callback => callback(message.payload));
            }

        } catch (error) {
            console.error('[WSS] Erro ao processar mensagem recebida:', error);
        }
    };

    socket.onclose = (event) => {
        console.warn(`[WSS] Conexão WebSocket fechada: Código ${event.code}. Motivo: ${event.reason}`);
        isConnecting = false;
        socket = null;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`[WSS] Tentando reconectar em ${RECONNECT_DELAY / 1000}s... (Tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(connect, RECONNECT_DELAY);
        } else {
            console.error('[WSS] Número máximo de tentativas de reconexão atingido.');
        }
    };

    socket.onerror = (error) => {
        console.error('[WSS] Erro na conexão WebSocket:', error);
        isConnecting = false;
        socket?.close();
    };
}

export function initializeWebSocket() {
    if (typeof window !== 'undefined') {
        connect();
    }
}

export function sendMessage(type: string, payload: any) {
    const message = { type, payload };
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    } else {
        console.log('[WSS] Conexão não está aberta. Enfileirando mensagem.');
        messageQueue.push(message);
        if (!isConnecting) {
            connect();
        }
    }
}

export function addEventListener(type: string, callback: (payload: any) => void) {
    if (!eventListeners[type]) {
        eventListeners[type] = [];
    }
    eventListeners[type].push(callback);
}

export function removeEventListener(type: string, callback: (payload: any) => void) {
    if (eventListeners[type]) {
        eventListeners[type] = eventListeners[type].filter(cb => cb !== callback);
    }
}

export function closeWebSocket() {
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Impede a reconexão
    if (socket) {
        socket.close();
    }
}
