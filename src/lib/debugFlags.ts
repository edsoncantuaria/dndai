/** Registro WS / debug técnico — só visível ao jogador quando ligado explicitamente. */
export function isDebugWsEnabled(): boolean {
    if (process.env.NEXT_PUBLIC_DEBUG_WS === '1') return true;
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === 'ws';
}
