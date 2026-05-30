import { PenaiDataSource } from '../database/data-source.js';
import { CanonicalRegion } from '../database/entities/CanonicalRegion.js';
import { CanonicalPoi } from '../database/entities/CanonicalPoi.js';
import { CanonProposal as CanonProposalEntity } from '../database/entities/CanonProposal.js';
import { randomUUID } from 'crypto';
import { appendWorldEvent } from '../events/store.js';

export type CanonProposal = {
    id: string;
    kind: 'region' | 'poi';
    displayName: string;
    regionSlug?: string;
    status: 'pending' | 'approved' | 'rejected';
};

export async function submitCanonProposal(
    proposal: Omit<CanonProposal, 'id' | 'status'>,
): Promise<CanonProposal> {
    const repo = PenaiDataSource.getRepository(CanonProposalEntity);
    const row = await repo.save(
        repo.create({
            id: randomUUID(),
            kind: proposal.kind,
            displayName: proposal.displayName,
            regionSlug: proposal.regionSlug ?? null,
            status: 'pending',
            locale: 'pt-BR',
        }),
    );
    return formatProposal(row);
}

export async function approveCanonProposal(id: string): Promise<{ ok: boolean; message: string }> {
    const repo = PenaiDataSource.getRepository(CanonProposalEntity);
    const p = await repo.findOne({ where: { id } });
    if (!p) return { ok: false, message: 'Proposta não encontrada' };
    if (p.status !== 'pending') return { ok: false, message: 'Proposta já processada' };

    if (p.kind === 'region') {
        const regionRepo = PenaiDataSource.getRepository(CanonicalRegion);
        const slug = p.displayName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-');
        await regionRepo.save(
            regionRepo.create({
                id: randomUUID(),
                slug,
                displayName: p.displayName,
                locale: 'pt-BR',
            }),
        );
    } else if (p.kind === 'poi' && p.regionSlug) {
        const region = await PenaiDataSource.getRepository(CanonicalRegion).findOne({
            where: { slug: p.regionSlug },
        });
        if (!region) return { ok: false, message: 'Região não encontrada' };
        const poiRepo = PenaiDataSource.getRepository(CanonicalPoi);
        await poiRepo.save(
            poiRepo.create({
                id: randomUUID(),
                regionId: region.id,
                slug: p.displayName.toLowerCase().replace(/\s+/g, '-'),
                displayName: p.displayName,
                locale: 'pt-BR',
            }),
        );
    }

    p.status = 'approved';
    await repo.save(p);

    await appendWorldEvent({
        type: 'CANON_APPROVED',
        payload: { proposalId: id, kind: p.kind },
        canonCandidate: false,
    });
    return { ok: true, message: 'Canônico aprovado e publicado no mapa.' };
}

export async function listPendingProposals(): Promise<CanonProposal[]> {
    const rows = await PenaiDataSource.getRepository(CanonProposalEntity).find({
        where: { status: 'pending' },
        order: { createdAt: 'ASC' },
    });
    return rows.map(formatProposal);
}

export async function rejectCanonProposal(id: string): Promise<{ ok: boolean; message: string }> {
    const repo = PenaiDataSource.getRepository(CanonProposalEntity);
    const p = await repo.findOne({ where: { id } });
    if (!p) return { ok: false, message: 'Proposta não encontrada' };
    if (p.status !== 'pending') return { ok: false, message: 'Proposta já processada' };
    p.status = 'rejected';
    await repo.save(p);
    return { ok: true, message: 'Proposta rejeitada.' };
}

function formatProposal(row: CanonProposalEntity): CanonProposal {
    return {
        id: row.id,
        kind: row.kind,
        displayName: row.displayName,
        regionSlug: row.regionSlug ?? undefined,
        status: row.status,
    };
}
