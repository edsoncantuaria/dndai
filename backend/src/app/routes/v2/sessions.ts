import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import createError from 'http-errors';
import { PenaiDataSource } from '../../../GameMaster/database/data-source.js';
import {
    createGameSession,
    deleteGameSessionPenai,
    renameGameSessionPenai,
} from '../../../GameMaster/sessions/sessionService.js';

const createSessionSchema = z.object({
    nome: z.string().min(1).max(100),
    heroName: z.string().min(1).max(80).optional(),
    heroWorldEntityId: z.string().uuid().optional(),
    spawnRegionSlug: z.string().min(3).max(120).optional(),
});

const renameSessionSchema = z.object({
    nome: z.string().min(1).max(100),
});

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
    const auth = { preHandler: [app.authenticate] };

    app.get('/api/v2/sessions', auth, async (request) => {
        const { listGameSessions } = await import('../../../GameMaster/sessions/sessionService.js');
        const sessions = await listGameSessions(request.userId);
        return { sessions };
    });

    app.post('/api/v2/sessions', auth, async (request, reply) => {
        const parsed = createSessionSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Dados inválidos',
                details: parsed.error.flatten(),
            });
        }
        const { penaiPipelineLog } = await import('../../../GameMaster/infra/pipelineLog.js');
        penaiPipelineLog('HTTP', 'POST /api/v2/sessions', { nome: parsed.data.nome }, { userId: request.userId });

        const session = await createGameSession({
            userId: request.userId,
            nome: parsed.data.nome,
            heroName: parsed.data.heroName,
            heroWorldEntityId: parsed.data.heroWorldEntityId,
            spawnRegionSlug: parsed.data.spawnRegionSlug,
        });
        return reply.status(201).send(session);
    });

    app.get('/api/v2/sessions/:id/mechanical', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { formatMechanicalPack } = await import(
            '../../../GameMaster/character/formatMechanicalPack.js'
        );
        const pack = await formatMechanicalPack(id);
        return pack;
    });

    app.get('/api/v2/sessions/:id/ui-state', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { assertSessionOwner } = await import(
            '../../../GameMaster/sessions/sessionExtras.js'
        );
        const { loadSessionUiState, WORLD_BOOTSTRAP_STEP_LABELS, ensureLegacyWorldBootstrapReady } =
            await import('../../../GameMaster/sessions/sessionUiState.js');
        try {
            await assertSessionOwner(id, request.userId);
            await ensureLegacyWorldBootstrapReady(id);
            const ui = await loadSessionUiState(id);
            let memoryValidation: Record<string, unknown> | null = null;
            if (ui.worldBootstrap.status === 'ready') {
                const { validateBootstrapMemory } = await import(
                    '../../../GameMaster/memory/bootstrapMemory.js'
                );
                memoryValidation = await validateBootstrapMemory(id);
            }
            return {
                sessionId: id,
                actionOptions: ui.actionOptions,
                worldPulse: ui.worldPulse,
                worldBootstrap: ui.worldBootstrap,
                stepLabels: WORLD_BOOTSTRAP_STEP_LABELS,
                memoryValidation,
            };
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.post('/api/v2/sessions/:id/world-bootstrap', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const body = (request.body ?? {}) as { offline?: boolean };
        const offline = body.offline === true;
        const { assertSessionOwner } = await import(
            '../../../GameMaster/sessions/sessionExtras.js'
        );
        const { loadSessionUiState, resetFailedWorldBootstrap } = await import(
            '../../../GameMaster/sessions/sessionUiState.js'
        );
        const { startWorldBootstrapWorkflow } = await import('../../../temporal/client.js');
        try {
            await assertSessionOwner(id, request.userId);
            const before = await loadSessionUiState(id);
            if (before.worldBootstrap.status === 'ready') {
                return {
                    sessionId: id,
                    async: false,
                    worldBootstrap: before.worldBootstrap,
                    worldPulse: before.worldPulse,
                    actionOptions: before.actionOptions,
                };
            }

            if (offline || before.worldBootstrap.status === 'failed') {
                await resetFailedWorldBootstrap(id);
                const { runSessionWorldBootstrap } = await import(
                    '../../../GameMaster/world/buildSessionWorld.js'
                );
                await runSessionWorldBootstrap(id, { offline: true });
                const after = await loadSessionUiState(id);
                return {
                    sessionId: id,
                    async: false,
                    offline: true,
                    sync: true,
                    worldBootstrap: after.worldBootstrap,
                    worldPulse: after.worldPulse,
                    actionOptions: after.actionOptions,
                };
            }

            if (before.worldBootstrap.status === 'running') {
                return reply.status(202).send({
                    sessionId: id,
                    async: true,
                    worldBootstrap: before.worldBootstrap,
                });
            }

            const wf = await startWorldBootstrapWorkflow(id);
            if (wf.started) {
                const { updateWorldBootstrap, DEFAULT_WORLD_BOOTSTRAP } = await import(
                    '../../../GameMaster/sessions/sessionUiState.js'
                );
                await updateWorldBootstrap(id, {
                    status: 'running',
                    step: 'region',
                    steps: { ...DEFAULT_WORLD_BOOTSTRAP.steps },
                    startedAt: new Date().toISOString(),
                });
                return reply.status(202).send({
                    sessionId: id,
                    async: true,
                    workflowId: wf.workflowId,
                    worldBootstrap: { status: 'running', step: 'region' },
                });
            }

            const after = await loadSessionUiState(id);
            return {
                sessionId: id,
                async: false,
                sync: wf.sync ?? true,
                worldBootstrap: after.worldBootstrap,
                worldPulse: after.worldPulse,
                actionOptions: after.actionOptions,
            };
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.get('/api/v2/sessions/:id/story-feed', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { listSessionStoryFeed } = await import(
            '../../../GameMaster/sessions/sessionStoryFeed.js'
        );
        try {
            return await listSessionStoryFeed(id, request.userId);
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.get('/api/v2/sessions/:id/world-registro', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { listSessionWorldRegistro } = await import(
            '../../../GameMaster/sessions/sessionStoryFeed.js'
        );
        try {
            return await listSessionWorldRegistro(id, request.userId);
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.get('/api/v2/sessions/:id/summary', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { buildPenaiSessionSummary } = await import(
            '../../../GameMaster/world/sessionSnapshot.js'
        );
        const summary = await buildPenaiSessionSummary(id);
        if (!summary) return reply.notFound('Sessão não encontrada');
        return summary;
    });

    app.get('/api/v2/sessions/:id/campaign', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { assertSessionOwner } = await import(
            '../../../GameMaster/sessions/sessionExtras.js'
        );
        const { loadSessionCampaignView } = await import(
            '../../../GameMaster/sessions/sessionCampaignView.js'
        );
        try {
            await assertSessionOwner(id, request.userId);
            return await loadSessionCampaignView(id);
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.get('/api/v2/sessions/:id/world-map', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { buildPenaiWorldMapSnapshot } = await import(
            '../../../GameMaster/world/sessionSnapshot.js'
        );
        const snapshot = await buildPenaiWorldMapSnapshot(id);
        if (!snapshot) return reply.notFound('Sessão não encontrada');
        return snapshot;
    });

    app.get('/api/v2/sessions/:id', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { getGameSession } = await import('../../../GameMaster/sessions/sessionService.js');
        const session = await getGameSession(id);
        if (!session) return reply.notFound('Sessão não encontrada');
        return session;
    });

    app.patch('/api/v2/sessions/:id', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const parsed = renameSessionSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Nome inválido' });
        }
        const updated = await renameGameSessionPenai(id, request.userId, parsed.data.nome);
        if (!updated) return reply.notFound('Sessão não encontrada');
        return updated;
    });

    app.delete('/api/v2/sessions/:id', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const ok = await deleteGameSessionPenai(id, request.userId);
        if (!ok) return reply.notFound('Sessão não encontrada');
        return { ok: true };
    });

    app.post('/api/v2/sessions/:id/export-hero-to-vault', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { assertSessionOwner } = await import(
            '../../../GameMaster/sessions/sessionExtras.js'
        );
        const { exportSessionHeroToVault } = await import(
            '../../../GameMaster/character/vault.js'
        );
        try {
            await assertSessionOwner(id, request.userId);
            const character = await exportSessionHeroToVault(request.userId, id);
            return { character };
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.post('/api/v2/sessions/:id/clone', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { clonePenaiSession } = await import(
            '../../../GameMaster/sessions/sessionExtras.js'
        );
        try {
            const session = await clonePenaiSession(id, request.userId);
            return reply.status(201).send(session);
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.get('/api/v2/sessions/:id/cast', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { buildPenaiSessionCast } = await import(
            '../../../GameMaster/sessions/sessionExtras.js'
        );
        try {
            return await buildPenaiSessionCast(id, request.userId);
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.patch('/api/v2/sessions/:id/cast/:memberId', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        const memberId = String((request.params as { memberId: string }).memberId);
        if (!Number.isFinite(id) || !memberId) {
            return reply.status(400).send({ error: 'Parâmetros inválidos' });
        }
        const body = request.body as Partial<{ displayName: string; role: string; vitals: string }>;
        const { updatePenaiCastMember } = await import(
            '../../../GameMaster/sessions/sessionExtras.js'
        );
        try {
            return await updatePenaiCastMember(id, request.userId, memberId, body);
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.get('/api/v2/sessions/:id/journal', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { listPenaiJournalEntries } = await import(
            '../../../GameMaster/journal/journalList.js'
        );
        try {
            const entries = await listPenaiJournalEntries(id, request.userId);
            return { sessionId: id, entries };
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.get('/api/v2/sessions/:id/replay/mechanical', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const sessionRepo = PenaiDataSource.getRepository(
            (await import('../../../GameMaster/database/entities/GameSession.js')).GameSession,
        );
        const owned = await sessionRepo.findOne({ where: { id, userId: request.userId } });
        if (!owned) return reply.notFound('Sessão não encontrada');
        const { buildMechanicalReplaySnapshot } = await import(
            '../../../GameMaster/sessions/replayMechanical.js'
        );
        return buildMechanicalReplaySnapshot(id);
    });

    app.post('/api/v2/sessions/:id/canon/proposals', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        const body = request.body as { kind?: string; displayName?: string; regionSlug?: string };
        const sessionRepo = PenaiDataSource.getRepository(
            (await import('../../../GameMaster/database/entities/GameSession.js')).GameSession,
        );
        const owned = await sessionRepo.findOne({ where: { id, userId: request.userId } });
        if (!owned) return reply.notFound('Sessão não encontrada');
        if (!body.displayName || !body.kind) {
            return reply.status(400).send({ message: 'kind e displayName são obrigatórios.' });
        }
        const { submitCanonProposal } = await import('../../../GameMaster/admin/canonApproval.js');
        const proposal = await submitCanonProposal({
            kind: body.kind as 'region' | 'poi',
            displayName: body.displayName,
            regionSlug: body.regionSlug ?? owned.currentRegionSlug ?? undefined,
        });
        return reply.status(201).send({ sessionId: id, proposal });
    });

    app.get('/api/v2/sessions/:id/replay', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        if (!Number.isFinite(id)) {
            return reply.status(400).send({ error: 'ID de sessão inválido' });
        }
        const { buildPenaiSessionReplayMarkdown } = await import(
            '../../../GameMaster/sessions/sessionExtras.js'
        );
        try {
            const markdown = await buildPenaiSessionReplayMarkdown(id, request.userId);
            return reply.type('text/markdown; charset=utf-8').send(markdown);
        } catch (err: unknown) {
            if (createError.isHttpError(err)) {
                return reply.status(err.statusCode).send({ message: err.message });
            }
            throw err;
        }
    });

    app.patch('/api/v2/sessions/:id/modules', auth, async (request, reply) => {
        const id = Number((request.params as { id: string }).id);
        const body = request.body as { moduleId?: string; action?: 'install' | 'uninstall' };
        if (!body.moduleId || !body.action) {
            return reply.status(400).send({ message: 'moduleId e action são obrigatórios.' });
        }
        const sessionRepo = PenaiDataSource.getRepository(
            (await import('../../../GameMaster/database/entities/GameSession.js')).GameSession,
        );
        const session = await sessionRepo.findOne({ where: { id, userId: request.userId } });
        if (!session) return reply.notFound('Sessão não encontrada');

        const { SessionInstalledModule } = await import(
            '../../../GameMaster/database/entities/SessionInstalledModule.js'
        );
        const moduleRepo = PenaiDataSource.getRepository(SessionInstalledModule);
        if (body.action === 'install') {
            const { validateModuleInstall } = await import(
                '../../../GameMaster/homebrew/moduleResolver.js'
            );
            const version = String(body.version ?? '1.0.0');
            const compat = await validateModuleInstall(id, {
                moduleId: body.moduleId,
                version,
                kind: 'homebrew',
            });
            if (!compat.ok) {
                return reply.status(409).send({ message: compat.reason ?? 'Conflito de módulos.' });
            }
            await moduleRepo.save(
                moduleRepo.create({
                    sessionId: id,
                    moduleId: body.moduleId,
                    version,
                    kind: 'homebrew',
                    payload: {},
                }),
            );
        } else {
            await moduleRepo.delete({ sessionId: id, moduleId: body.moduleId });
        }
        return { ok: true };
    });
}
