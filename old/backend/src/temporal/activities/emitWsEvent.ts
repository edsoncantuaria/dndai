import { publishWsToUser } from '../../GameMaster/transport/wsPubSub.js';

export async function emitWsEventActivity(opts: {
    userId: number;
    payload: unknown;
}): Promise<void> {
    await publishWsToUser(opts.userId, opts.payload);
}
