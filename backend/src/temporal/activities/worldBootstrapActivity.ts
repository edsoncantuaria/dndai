import { runSessionWorldBootstrap } from '../../GameMaster/world/buildSessionWorld.js';

export async function runWorldBootstrapActivity(sessionId: number): Promise<void> {
    await runSessionWorldBootstrap(sessionId);
}
