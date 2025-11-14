/**
 * WebSocket Service - Crônicas de Aventuras
 * Conexão segura com o backend via Cloudflare Tunnel.
 */

const WEBSOCKET_URL = 'wss://backend-5e.edsin-server.space/';

let socket: WebSocket | null = null;
let messageQueue: any[] = [];
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 4000;
let manualClose = false; // 🚩 Flag para controlar o fechamento manual

interface MessagePayload {
  type: string;
  payload: any;
}

const eventListeners: Record<string, ((payload: any) => void)[]> = {};

function emitEvent(type: string, payload: any) {
  const listeners = eventListeners[type] || [];
  listeners.forEach(callback => callback(payload));
}

/**
 * 🔐 Cria o WebSocket autenticado
 */
function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    console.debug('[WSS] Já existe uma conexão ativa ou pendente.');
    return;
  }
  
  manualClose = false; // Reseta a flag a cada nova tentativa de conexão
  
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('[WSS] ❌ Nenhum token encontrado. Usuário não autenticado.');
    return;
  }

  const urlWithToken = `${WEBSOCKET_URL}?token=${encodeURIComponent(token)}`;
  console.log(`[WSS] 🌐 Tentando conectar a: ${urlWithToken}`);
  isConnecting = true;

  socket = new WebSocket(urlWithToken);

  socket.onopen = () => {
    console.log('%c[WSS] ✅ Conexão estabelecida.', 'color: #4ade80');
    isConnecting = false;
    reconnectAttempts = 0;

    // Envia mensagens enfileiradas após reconexão
    messageQueue.forEach((msg) => socket?.send(JSON.stringify(msg)));
    messageQueue = [];
  };

  socket.onmessage = (event) => {
    try {
      const message: MessagePayload = JSON.parse(event.data);
      console.log('%c[WSS] 📩 Mensagem recebida:', 'color: #60a5fa', message.type);
      emitEvent(message.type, message.payload);
    } catch (error) {
      console.error('[WSS] ❌ Erro ao processar mensagem recebida:', error);
    }
  };

  socket.onclose = (event) => {
    const reason = event.reason || '—';
    console.warn(`[WSS] ⚠️ Conexão fechada (código ${event.code}) | Motivo: ${reason}`);
    socket = null;
    isConnecting = false;
    emitEvent('connectionClosed', { code: event.code, reason });

    // Apenas tenta reconectar se o fechamento não foi intencional
    if (!manualClose && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = RECONNECT_DELAY * reconnectAttempts;
      console.log(`[WSS] Tentando reconectar em ${delay / 1000}s (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(connect, delay);
    } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WSS] ❌ Número máximo de tentativas de reconexão atingido.');
    }
  };

  socket.onerror = (event) => {
    console.error('[WSS] 💥 Erro na conexão WebSocket:', event);
    isConnecting = false;

    // Força fechamento — o onclose cuidará da reconexão (se não for manual)
    socket?.close();
  };
}

/**
 * 🚀 Inicializa o WebSocket (executado no carregamento do app)
 */
export function initializeWebSocket() {
  if (typeof window !== 'undefined') {
    connect();
  }
}

/**
 * 📤 Envia uma mensagem ao servidor via WS
 */
export function sendMessage(type: string, payload: any) {
  const message = { type, payload };

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.log('[WSS] 🕓 Conexão não está aberta. Enfileirando mensagem.');
    messageQueue.push(message);
    if (!isConnecting) connect();
  }
}

/**
 * 🧩 Inscreve listeners para tipos de mensagens
 */
export function addEventListener(type: string, callback: (payload: any) => void) {
  if (!eventListeners[type]) {
    eventListeners[type] = [];
  }
  if (!eventListeners[type].includes(callback)) {
    eventListeners[type].push(callback);
  }
}

/**
 * ❌ Remove listener específico
 */
export function removeEventListener(type: string, callback: (payload: any) => void) {
  if (eventListeners[type]) {
    eventListeners[type] = eventListeners[type].filter((cb) => cb !== callback);
  }
}

/**
 * 🔒 Fecha o WebSocket e desativa reconexão automática
 */
export function closeWebSocket() {
  if (!socket || socket.readyState === WebSocket.CLOSED) return;

  manualClose = true;
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
  console.warn('[WSS] 🔒 Fechando conexão manualmente...');
  try {
    socket.close(1000, 'Closed by client');
  } catch (e) {
    console.error('[WSS] Erro ao fechar WebSocket:', e);
  }
}
