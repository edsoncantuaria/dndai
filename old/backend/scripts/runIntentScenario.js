import 'dotenv/config';
import { register } from 'tsx/esm/api';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';

await register({
    tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
    experimentalTsImport: true,
});

const BASE_URL = process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8071/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const [, , sessionArg] = process.argv;

if (!sessionArg) {
    console.error('Usage: node scripts/runIntentScenario.js <sessionId>');
    process.exit(1);
}

const sessionId = Number(sessionArg);
if (!Number.isFinite(sessionId)) {
    console.error('sessionId must be a valid number.');
    process.exit(1);
}

const token = jwt.sign({ userId: 1, email: 'auditoria@dndai.local' }, JWT_SECRET, { expiresIn: '15m' });
const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
};

const request = async (method, url, body) => {
    const res = await fetch(`${BASE_URL}${url}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { raw: text };
        }
    }
    return { status: res.status, ok: res.ok, data };
};

const ACTIONS = [
    {
        label: 'weapon-attack',
        intent: {
            type: 'weapon-attack',
            payload: {
                weaponIndex: 'longsword',
                targetArmorClass: 13,
                targetId: 'dummy-1',
                targetName: 'Escaramuçador Goblin',
            },
        },
    },
    {
        label: 'skill-check',
        intent: {
            type: 'skill-check',
            payload: {
                skillIndex: 'perception',
                difficulty: 'medium',
            },
        },
    },
];

const scenariosDir = path.join(process.cwd(), 'logs', 'scenario-tests');

const runScenario = async () => {
    const startedAt = new Date().toISOString();
    await fs.mkdir(scenariosDir, { recursive: true });
    await request('POST', '/roll-requests/clear', null);

    let lastStateVersion = null;
    const results = [];
    for (const action of ACTIONS) {
        const actionId = `${action.label}-${Date.now()}`;
        console.log('[intentScenario] POST', `/sessions/${sessionId}/actions`, action.label);
        const payload = {
            contractVersion: 1,
            actionId,
            intent: action.intent,
            clientStateVersion: typeof lastStateVersion === 'number' ? lastStateVersion : undefined,
        };
        const response = await request('POST', `/sessions/${sessionId}/actions`, payload);
        if (!response.ok) {
            console.error('[intentScenario] request failed', response);
            throw new Error(`Action ${action.label} failed with status ${response.status}`);
        }
        const actionStatus = response.data?.actionResolution?.status;
        if (actionStatus === 'needs_roll') {
            console.warn('[intentScenario] action requires roll; issuing auto-clear to unblock queue.');
            await request('POST', '/roll-requests/clear', null);
        }
        const stateVersion = response.data?.actionResolution?.stateVersion ?? lastStateVersion;
        if (typeof stateVersion === 'number') {
            lastStateVersion = stateVersion;
        }
        results.push({
            label: action.label,
            actionId,
            requestPayload: payload,
            response,
        });
    }

    const artifact = {
        scenario: 'intent-only',
        startedAt,
        finishedAt: new Date().toISOString(),
        sessionId,
        actions: results,
    };
    const filePath = path.join(
        scenariosDir,
        `${new Date().toISOString().replace(/[:.]/g, '-')}-intent-scenario-session-${sessionId}.json`,
    );
    await fs.writeFile(filePath, JSON.stringify(artifact, null, 2), 'utf8');
    console.log('[intentScenario] artifacts saved to', filePath);
};

try {
    await runScenario();
} catch (error) {
    console.error('[intentScenario] failed', error);
    process.exitCode = 1;
}
