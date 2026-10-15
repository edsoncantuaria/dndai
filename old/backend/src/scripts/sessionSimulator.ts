/**
 * Smoke local do pipeline PENAI (sem WebSocket).
 */
import { canTransitionCombatPhase } from '../combat/combatPhase.js';
import { isOssMinimalNarrationEnabled } from '../config/ossMinimalNarration.js';
import { isMechanicalNarrativeSplitEnabled } from '../config/mechanicalNarrativeSplit.js';
import { GAME_EVENT_PREFIX } from '../events/types.js';

const HELP = `sessionSimulator — smoke do motor PENAI

Uso:
  npm run session:smoke --prefix backend
  tsx src/scripts/sessionSimulator.ts [--help]

Arquitetura (sempre ativa):
  - mechanicalStateUpdate antes da narração (Temporal penai-narration)
  - Gemini structured + registry mecânico de actionOptions
  - Postgres + GAME_MOTOR autoritativo
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
    process.exit(0);
}

const steps = [
    () => assert(canTransitionCombatPhase('ROLL_PENDING', 'RESOLVING'), 'FSM combate'),
    () => assert(typeof GAME_EVENT_PREFIX === 'string', 'event log prefix'),
    () => assert(isMechanicalNarrativeSplitEnabled(), 'split mecânico × narrativo'),
    () => assert(isOssMinimalNarrationEnabled(), 'narração minimal JSON'),
];

function assert(cond: unknown, label: string): void {
    if (!cond) throw new Error(`sessionSimulator: ${label}`);
}

for (const step of steps) step();
console.log('[sessionSimulator] OK —', steps.length, 'checks PENAI');
