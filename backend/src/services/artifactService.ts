// backend/src/services/artifactService.ts
import { AppDataSource } from '../database/data-source.js';
import { CampaignArtifact } from '../entities/CampaignArtifact.js';

export type ArtifactRecordInput = {
  name: string;
  description?: string;
  rarity?: string;
  sourceType?: 'loot' | 'fallback' | 'manual';
  metadata?: Record<string, any>;
  keywords?: string[];
  originLabel?: string;
  quantity?: number;
  regionSlug?: string | null;
  pointOfInterestSlug?: string | null;
};

const normalizeSlug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `artifact-${Date.now()}`;

const extractKeywords = (input: ArtifactRecordInput) => {
  if (input.keywords?.length) return input.keywords.map(k => k.toLowerCase());
  const tokens = (input.name + ' ' + (input.description ?? '')).toLowerCase().split(/[^a-zà-ú0-9]+/i);
  return Array.from(new Set(tokens.filter(Boolean)));
};

export const recordArtifactsForSession = async (
  characterId: number,
  sessionId: number | null,
  artifacts: ArtifactRecordInput[]
) => {
  if (!artifacts?.length) return;
  const repo = AppDataSource.getRepository(CampaignArtifact);
  for (const entry of artifacts) {
    if (!entry?.name) continue;
    const slug = normalizeSlug(entry.name);
    const keywords = extractKeywords(entry);
    const existing = await repo.findOne({ where: { characterId, slug } });
    if (existing) {
      existing.quantity += entry.quantity && entry.quantity > 0 ? entry.quantity : 1;
      existing.description = entry.description ?? existing.description;
      existing.metadata = { ...(existing.metadata || {}), ...(entry.metadata || {}) };
      existing.keywords = Array.from(new Set([...(existing.keywords || []), ...keywords]));
      existing.originLabel = entry.originLabel ?? existing.originLabel;
      existing.sourceType = entry.sourceType ?? existing.sourceType;
      existing.rarity = entry.rarity ?? existing.rarity;
      existing.regionSlug = entry.regionSlug ?? existing.regionSlug;
      existing.pointOfInterestSlug = entry.pointOfInterestSlug ?? existing.pointOfInterestSlug;
      await repo.save(existing);
      continue;
    }
    const artifact = repo.create({
      characterId,
      sessionId,
      name: entry.name,
      slug,
      quantity: entry.quantity && entry.quantity > 0 ? entry.quantity : 1,
      description: entry.description ?? null,
      metadata: entry.metadata ?? null,
      keywords,
      originLabel: entry.originLabel ?? null,
      sourceType: entry.sourceType ?? 'loot',
      rarity: entry.rarity ?? null,
      regionSlug: entry.regionSlug ?? null,
      pointOfInterestSlug: entry.pointOfInterestSlug ?? null,
    });
    await repo.save(artifact);
  }
};

export const listArtifactsForCharacter = async (characterId: number) => {
  return AppDataSource.getRepository(CampaignArtifact).find({ where: { characterId } });
};

export const findArtifactBySlug = async (characterId: number, slug: string) => {
  return AppDataSource.getRepository(CampaignArtifact).findOne({ where: { characterId, slug } });
};
