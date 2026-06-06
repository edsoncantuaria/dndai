import { describe } from 'node:test';
import { ensurePenaiTestDb } from './penaiTestDb.js';

/** `describe` ou `describe.skip` conforme Postgres PENAI alcançável (CI / `dev:local`). */
export const penaiIntegrationReady = await ensurePenaiTestDb();
export const penaiIntegrationDescribe = penaiIntegrationReady ? describe : describe.skip;
