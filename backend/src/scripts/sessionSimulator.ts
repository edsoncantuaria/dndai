/**
 * Smoke local do pipeline (sem WebSocket).
 */
import { canTransitionCombatPhase } from '../combat/combatPhase.js';
import { isOssMinimalNarrationEnabled } from '../config/ossMinimalNarration.js';
import { isMechanicalNarrativeSplitEnabled } from '../config/mechanicalNarrativeSplit.js';
import { GAME_EVENT_PREFIX } from '../events/types.js';

const HELP = `sessionSimulator — smoke do motor

Uso:
  npm run session:smoke --prefix backend
  tsx src/scripts/sessionSimulator.ts [--help]

Arquitetura (sempre ativa, sem flags):
  - mechanicalStateUpdate antes da narração
  - fila BullMQ + worker no processo do backend (Redis)
  - OSS schema minimalista
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
    process.exit(0);
}

const steps = [
    () => assert(canTransitionCombatPhase('ROLL_PENDING', 'RESOLVING'), 'FSM'),
    () => assert(typeof GAME_EVENT_PREFIX === 'string', 'events'),
    () => assert(isMechanicalNarrativeSplitEnabled(), 'mechanical split'),
    () => assert(isOssMinimalNarrationEnabled(), 'minimal oss'),
];

function assert(cond: unknown, label: string): void {
    if (!cond) throw new Error(`sessionSimulator: ${label}`);
}

for (const step of steps) step();
console.log('[sessionSimulator] OK —', steps.length, 'checks');
