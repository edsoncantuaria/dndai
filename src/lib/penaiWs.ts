/** Contrato WS PENAI — único barramento de gameplay (Contract V2). */
export const PENAI_WS_CONTRACT_VERSION = 2;
export const PENAI_WS_LOCALE = 'pt-BR';

export function buildPenaiWsUrl(token?: string | null): string {
    const withWsPath = (base: string) => (base.endsWith('/ws') ? base : `${base}/ws`);
    const explicit =
        process.env.NEXT_PUBLIC_PENAI_WS_URL?.replace(/\/$/, '') ??
        process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, '');
    const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8071/api';
    const origin = api.replace(/\/api\/?$/, '');
    const base = withWsPath(explicit || origin.replace(/^http/, 'ws'));
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export function validatePenaiWsConnected(payload: Record<string, unknown>): {
    ok: boolean;
    reason?: string;
} {
    const version = Number(payload.contractVersion);
    if (!Number.isFinite(version) || version < PENAI_WS_CONTRACT_VERSION) {
        return {
            ok: false,
            reason: `Contrato WS obsoleto (v${payload.contractVersion ?? '?'}). Recarregue o app.`,
        };
    }
    if (String(payload.locale ?? '') !== PENAI_WS_LOCALE) {
        return {
            ok: false,
            reason: `Locale WS inesperada (${String(payload.locale)}). Esperado ${PENAI_WS_LOCALE}.`,
        };
    }
    return { ok: true };
}
