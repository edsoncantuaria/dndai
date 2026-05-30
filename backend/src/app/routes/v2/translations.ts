import type { FastifyInstance } from 'fastify';
import { PenaiDataSource } from '../../../GameMaster/database/data-source.js';
import { PenaiHomebrewContent } from '../../../GameMaster/database/entities/HomebrewContent.js';
import { SYSTEM_AUTHOR_ID } from '../../../GameMaster/database/seed/seedSrdPtBrHomebrew.js';

export async function translationRoutes(app: FastifyInstance): Promise<void> {
    app.get('/api/v2/translations', async (_request, reply) => {
        if (!PenaiDataSource.isInitialized) {
            return reply.code(503).send({ error: 'Banco indisponível' });
        }
        const rows = await PenaiDataSource.getRepository(PenaiHomebrewContent).find({
            where: { type: 'translation', authorId: SYSTEM_AUTHOR_ID },
        });
        const out: Record<string, Record<string, string>> = {};
        for (const row of rows) {
            const content = row.content as Record<string, string>;
            if (content && typeof content === 'object') {
                out[row.name] = content;
            }
        }
        return out;
    });
}
