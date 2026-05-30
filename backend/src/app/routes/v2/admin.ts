import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listPendingProposals, submitCanonProposal, rejectCanonProposal } from '../../../GameMaster/admin/canonApproval.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
    app.get('/api/v2/admin/canon/pending', async () => ({
        proposals: await listPendingProposals(),
        locale: 'pt-BR',
    }));

    app.post('/api/v2/admin/canon/proposals', async (request, reply) => {
        const schema = z.object({
            kind: z.enum(['region', 'poi']),
            displayName: z.string().min(1),
            regionSlug: z.string().optional(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos' });
        const proposal = await submitCanonProposal({
            kind: parsed.data.kind,
            displayName: parsed.data.displayName,
            regionSlug: parsed.data.regionSlug,
        });
        return reply.status(201).send(proposal);
    });

    app.post('/api/v2/admin/canon/proposals/:id/approve', async (request, reply) => {
        const { id } = request.params as { id: string };
        const { startCanonApprovalWorkflow } = await import('../../../temporal/client.js');
        const wf = await startCanonApprovalWorkflow(id);
        return { ok: true, message: 'Aprovação canônica enfileirada.', workflowId: wf.workflowId };
    });

    app.post('/api/v2/admin/canon/proposals/:id/reject', async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await rejectCanonProposal(id);
        if (!result.ok) return reply.status(400).send(result);
        return result;
    });
}
