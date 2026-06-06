import { randomUUID } from 'crypto';
import createError from 'http-errors';
import redisClient, { ensureRedisConnection } from '../database/redis-client.js';
import {
    attributesEqual,
    rollFullAttributeSet,
    type AttributeRollBreakdown,
    type BaseAttributes,
} from '../rules/characterAttributes.js';

const ROLL_SESSION_TTL_SEC = 30 * 60;
const REDIS_KEY_PREFIX = 'char-attr-roll:';

type RollSession = {
    userId: number;
    baseAttributes: BaseAttributes;
};

/** Fallback em memória quando Redis não está disponível (dev/testes). */
const memorySessions = new Map<string, RollSession>();

function redisKey(sessionId: string): string {
    return `${REDIS_KEY_PREFIX}${sessionId}`;
}

async function storeSession(sessionId: string, session: RollSession): Promise<void> {
    memorySessions.set(sessionId, session);

    const client = await ensureRedisConnection();
    if (!client?.isOpen) return;

    await client.set(redisKey(sessionId), JSON.stringify(session), { EX: ROLL_SESSION_TTL_SEC });
}

async function loadSession(sessionId: string): Promise<RollSession | null> {
    const client = await ensureRedisConnection();
    if (client?.isOpen) {
        const raw = await client.get(redisKey(sessionId));
        if (raw) {
            try {
                return JSON.parse(raw) as RollSession;
            } catch {
                return null;
            }
        }
    }
    return memorySessions.get(sessionId) ?? null;
}

async function deleteSession(sessionId: string): Promise<void> {
    memorySessions.delete(sessionId);
    const client = await ensureRedisConnection();
    if (client?.isOpen) {
        await client.del(redisKey(sessionId));
    }
}

export async function issueCharacterAttributeRoll(userId: number): Promise<{
    rollSessionId: string;
    baseAttributes: BaseAttributes;
    rolls: AttributeRollBreakdown[];
}> {
    const { baseAttributes, rolls } = rollFullAttributeSet();
    const rollSessionId = randomUUID();
    await storeSession(rollSessionId, { userId, baseAttributes });
    return { rollSessionId, baseAttributes, rolls };
}

/** Consome sessão de rolagem (uso único) — rejeita spoof do cliente. */
export async function consumeCharacterAttributeRoll(
    userId: number,
    rollSessionId: string,
    submittedBase: BaseAttributes,
): Promise<void> {
    const session = await loadSession(rollSessionId);
    if (!session) {
        throw createError(400, 'Sessão de rolagem expirada ou inválida. Role os dados novamente.');
    }
    if (session.userId !== userId) {
        throw createError(403, 'Sessão de rolagem pertence a outro usuário.');
    }
    if (!attributesEqual(session.baseAttributes, submittedBase)) {
        throw createError(400, 'Atributos base não conferem com a rolagem autorizada pelo servidor.');
    }
    await deleteSession(rollSessionId);
}

/** Limpa sessões em memória — apenas para testes. */
export function clearCharacterAttributeRollSessionsForTests(): void {
    memorySessions.clear();
}
