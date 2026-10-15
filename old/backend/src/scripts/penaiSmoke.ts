/**
 * Smoke PENAI — locale, action options (sem Postgres/Temporal obrigatório).
 */
import { assertNarrationPtBr } from '../GameMaster/locale/narrationGuard.js';
import { getActionOptionsForDomain } from '../GameMaster/world/actionOptions.js';

async function main() {
    const guard = assertNarrationPtBr('A bruma recobre o pátio da cidadela. Passos ecoam nas pedras.');
    if (!guard.ok) {
        console.error('[penai:smoke] narrationGuard falhou:', guard.reason);
        process.exit(1);
    }
    const opts = getActionOptionsForDomain('exploration');
    if (!opts.length) {
        console.error('[penai:smoke] actionOptions vazio');
        process.exit(1);
    }
    console.log('[penai:smoke] OK — locale pt-BR, actionOptions=', opts.length);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
