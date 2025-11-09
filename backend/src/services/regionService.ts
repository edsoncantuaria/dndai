// backend/src/services/regionService.ts
import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { Region } from '../entities/Region.js';
import { RegionLink } from '../entities/RegionLink.js';
import { RegionPointOfInterest } from '../entities/RegionPointOfInterest.js';
import { RegionGraphPayload } from '../schemas/regionSchemas.js';

const regionRepo = AppDataSource.getRepository(Region);
const linkRepo = AppDataSource.getRepository(RegionLink);
const poiRepo = AppDataSource.getRepository(RegionPointOfInterest);

const ensureSpawnEligibility = (type: Region['type'], flag?: boolean) => {
  if (flag && type !== 'city') {
    throw createError(400, 'Apenas regiões do tipo "city" podem fazer parte do spawn pool.');
  }
};

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const listRegionsWithDetails = async () => {
  const regions = await regionRepo.find({ relations: ['parent', 'pointsOfInterest'] });
  const links = await linkRepo.find({ relations: ['fromRegion', 'toRegion'] });
  return regions.map(region => buildRegionPayload(region, links));
};

export const getRegionBySlug = async (slug: string) => {
  const normalized = slugify(slug);
  const region = await regionRepo.findOne({
    where: { slug: normalized },
    relations: ['parent', 'pointsOfInterest'],
  });
  if (!region) throw createError(404, 'Região não encontrada.');
  const links = await linkRepo.find({ relations: ['fromRegion', 'toRegion'] });
  return buildRegionPayload(region, links, true);
};

export const exportRegionGraph = async (): Promise<RegionGraphPayload> => {
  const regions = await regionRepo.find({ relations: ['parent'] });
  const links = await linkRepo.find({ relations: ['fromRegion', 'toRegion'] });
  const pois = await poiRepo.find({ relations: ['region'] });
  return {
    regions: regions.map(region => ({
      slug: region.slug,
      name: region.name,
      type: region.type,
      parentSlug: region.parent?.slug ?? null,
      summary: region.summary ?? undefined,
      description: region.description ?? undefined,
      metadata: region.metadata ?? undefined,
      isSpawnPool: region.isSpawnPool ?? undefined,
    })),
    links: links.map(link => ({
      fromSlug: link.fromRegion?.slug ?? '',
      toSlug: link.toRegion?.slug ?? '',
      travelMode: link.travelMode,
      travelTimeMinutes: link.travelTimeMinutes,
      difficulty: link.difficulty ?? undefined,
      isLocked: link.isLocked,
      notes: link.notes ?? undefined,
      metadata: link.metadata ?? undefined,
    })),
    pois: pois.map(poi => ({
      regionSlug: poi.region?.slug ?? '',
      slug: poi.slug,
      name: poi.name,
      type: poi.type,
      summary: poi.summary ?? undefined,
      description: poi.description ?? undefined,
      metadata: poi.metadata ?? undefined,
      isLocked: poi.isLocked,
      allowAiExpansion: poi.allowAiExpansion,
    })),
  };
};

export const importRegionGraph = async (
  graph: RegionGraphPayload,
  options?: { clearExisting?: boolean }
) => {
  await AppDataSource.transaction(async manager => {
    const regionRepository = manager.getRepository(Region);
    const linkRepository = manager.getRepository(RegionLink);
    const poiRepository = manager.getRepository(RegionPointOfInterest);

    if (options?.clearExisting) {
      await linkRepository.delete({});
      await poiRepository.delete({});
      await regionRepository.delete({});
    }

    const existingRegions = await regionRepository.find();
    const regionMap = new Map<string, Region>();
    existingRegions.forEach(region => regionMap.set(region.slug, region));

    // Upsert regions
    for (const regionData of graph.regions) {
      const slug = slugify(regionData.slug || regionData.name);
      let region = regionMap.get(slug);
      if (!region) {
        region = regionRepository.create({ slug });
        regionMap.set(slug, region);
      }
      region.name = regionData.name;
      region.type = regionData.type;
      region.summary = regionData.summary ?? null;
      region.description = regionData.description ?? null;
      region.metadata = regionData.metadata ?? null;
      ensureSpawnEligibility(region.type, regionData.isSpawnPool);
      region.isSpawnPool = regionData.isSpawnPool ?? false;
      region.parentRegionId = null; // resolve after
    }
    await regionRepository.save(Array.from(regionMap.values()));

    // Resolve parents
    for (const regionData of graph.regions) {
      const slug = slugify(regionData.slug || regionData.name);
      const region = regionMap.get(slug);
      if (!region) continue;
      if (regionData.parentSlug) {
        const parent = regionMap.get(slugify(regionData.parentSlug));
        region.parentRegionId = parent?.id ?? null;
      } else {
        region.parentRegionId = null;
      }
    }
    await regionRepository.save(Array.from(regionMap.values()));

    // Clear links/pois if not clearing earlier to avoid duplicates
    if (!options?.clearExisting) {
      await linkRepository.delete({});
      await poiRepository.delete({});
    }

    // Insert links
    const linkEntities: RegionLink[] = [];
    for (const linkData of graph.links ?? []) {
      const from = regionMap.get(slugify(linkData.fromSlug));
      const to = regionMap.get(slugify(linkData.toSlug));
      if (!from || !to) continue;
      const entity = linkRepository.create({
        fromRegionId: from.id,
        toRegionId: to.id,
        travelMode: linkData.travelMode ?? 'walk',
        travelTimeMinutes: linkData.travelTimeMinutes ?? 0,
        difficulty: linkData.difficulty ?? null,
        isLocked: linkData.isLocked ?? false,
        notes: linkData.notes ?? null,
        metadata: linkData.metadata ?? null,
      });
      linkEntities.push(entity);
    }
    if (linkEntities.length) await linkRepository.save(linkEntities);

    // Insert POIs
    const poiEntities: RegionPointOfInterest[] = [];
    for (const poiData of graph.pois ?? []) {
      const region = regionMap.get(slugify(poiData.regionSlug));
      if (!region) continue;
      const entity = poiRepository.create({
        regionId: region.id,
        slug: slugify(poiData.slug || poiData.name),
        name: poiData.name,
        type: poiData.type ?? 'landmark',
        summary: poiData.summary ?? null,
        description: poiData.description ?? null,
        metadata: poiData.metadata ?? null,
        isLocked: poiData.isLocked ?? false,
        allowAiExpansion: poiData.allowAiExpansion ?? true,
      });
      poiEntities.push(entity);
    }
    if (poiEntities.length) await poiRepository.save(poiEntities);
  });
};

export const createRegion = async (input: {
  name: string;
  slug: string;
  type: Region['type'];
  parentSlug?: string;
  summary?: string;
  description?: string;
  metadata?: Record<string, any>;
  isSpawnPool?: boolean;
}) => {
  const slug = slugify(input.slug || input.name);
  const existing = await regionRepo.findOne({ where: { slug } });
  if (existing) throw createError(409, 'Já existe uma região com esse slug.');
  let parent: Region | null = null;
  if (input.parentSlug) {
    parent = await regionRepo.findOne({ where: { slug: slugify(input.parentSlug) } });
    if (!parent) throw createError(404, 'Região pai não encontrada.');
  }
  ensureSpawnEligibility(input.type, input.isSpawnPool);

  const region = regionRepo.create({
    name: input.name,
    slug,
    type: input.type,
    summary: input.summary ?? null,
    description: input.description ?? null,
    metadata: input.metadata ?? null,
    parentRegionId: parent?.id ?? null,
    isSpawnPool: input.isSpawnPool ?? false,
  });
  return regionRepo.save(region);
};

export const updateRegion = async (
  id: number,
  input: Partial<{
    name: string;
    slug: string;
    type: Region['type'];
    parentSlug?: string | null;
    summary?: string | null;
    description?: string | null;
    metadata?: Record<string, any>;
    isSpawnPool?: boolean;
  }>
) => {
  const region = await regionRepo.findOne({ where: { id } });
  if (!region) throw createError(404, 'Região não encontrada.');
  if (input.slug) {
    const slug = slugify(input.slug);
    if (slug !== region.slug) {
      const conflict = await regionRepo.findOne({ where: { slug } });
      if (conflict) throw createError(409, 'Outro registro usa este slug.');
      region.slug = slug;
    }
  }
  if (input.name) region.name = input.name;
  if (input.type) {
    region.type = input.type;
  }
  if (input.summary !== undefined) region.summary = input.summary;
  if (input.metadata !== undefined) region.metadata = input.metadata;
  if (input.description !== undefined) region.description = input.description;
  if (input.parentSlug !== undefined) {
    if (input.parentSlug === null) {
      region.parentRegionId = null;
    } else {
      const parent = await regionRepo.findOne({ where: { slug: slugify(input.parentSlug) } });
      if (!parent) throw createError(404, 'Região pai não encontrada.');
      region.parentRegionId = parent.id;
    }
  }
  if (input.isSpawnPool !== undefined) {
    ensureSpawnEligibility(region.type, input.isSpawnPool);
    region.isSpawnPool = input.isSpawnPool;
  } else if (region.isSpawnPool && region.type !== 'city') {
    throw createError(400, 'Apenas regiões do tipo "city" podem fazer parte do spawn pool.');
  }
  return regionRepo.save(region);
};

export const deleteRegion = async (id: number) => {
  const region = await regionRepo.findOne({ where: { id } });
  if (!region) throw createError(404, 'Região não encontrada.');
  await regionRepo.remove(region);
};

export const createRegionLink = async (input: {
  fromRegionSlug: string;
  toRegionSlug: string;
  travelMode: RegionLink['travelMode'];
  travelTimeMinutes?: number;
  difficulty?: string;
  isLocked?: boolean;
  notes?: string;
  metadata?: Record<string, any>;
}) => {
  const fromRegion = await regionRepo.findOne({ where: { slug: slugify(input.fromRegionSlug) } });
  const toRegion = await regionRepo.findOne({ where: { slug: slugify(input.toRegionSlug) } });
  if (!fromRegion || !toRegion) throw createError(404, 'Região origem/destino não encontrada.');
  if (fromRegion.id === toRegion.id) throw createError(400, 'Uma região não pode linkar para ela mesma.');
  const existing = await linkRepo.findOne({
    where: { fromRegionId: fromRegion.id, toRegionId: toRegion.id },
  });
  if (existing) throw createError(409, 'Link já existe.');
  const link = linkRepo.create({
    fromRegionId: fromRegion.id,
    toRegionId: toRegion.id,
    travelMode: input.travelMode,
    travelTimeMinutes: input.travelTimeMinutes ?? 0,
    difficulty: input.difficulty ?? null,
    isLocked: input.isLocked ?? false,
    notes: input.notes ?? null,
    metadata: input.metadata ?? null,
  });
  return linkRepo.save(link);
};

export const updateRegionLink = async (
  id: number,
  input: Partial<{
    fromRegionSlug: string;
    toRegionSlug: string;
    travelMode: RegionLink['travelMode'];
    travelTimeMinutes: number;
    difficulty?: string | null;
    isLocked: boolean;
    notes?: string | null;
    metadata?: Record<string, any>;
  }>
) => {
  const link = await linkRepo.findOne({ where: { id } });
  if (!link) throw createError(404, 'Link não encontrado.');
  if (input.fromRegionSlug) {
    const from = await regionRepo.findOne({ where: { slug: slugify(input.fromRegionSlug) } });
    if (!from) throw createError(404, 'Região origem não encontrada.');
    link.fromRegionId = from.id;
  }
  if (input.toRegionSlug) {
    const to = await regionRepo.findOne({ where: { slug: slugify(input.toRegionSlug) } });
    if (!to) throw createError(404, 'Região destino não encontrada.');
    link.toRegionId = to.id;
  }
  if (input.travelMode) link.travelMode = input.travelMode;
  if (input.travelTimeMinutes !== undefined) link.travelTimeMinutes = input.travelTimeMinutes;
  if (input.difficulty !== undefined) link.difficulty = input.difficulty;
  if (input.isLocked !== undefined) link.isLocked = input.isLocked;
  if (input.notes !== undefined) link.notes = input.notes;
  if (input.metadata !== undefined) link.metadata = input.metadata;
  return linkRepo.save(link);
};

export const deleteRegionLink = async (id: number) => {
  const link = await linkRepo.findOne({ where: { id } });
  if (!link) throw createError(404, 'Link não encontrado.');
  await linkRepo.remove(link);
};

export const createPointOfInterest = async (input: {
  regionSlug: string;
  name: string;
  slug: string;
  type: RegionPointOfInterest['type'];
  summary?: string;
  description?: string;
  metadata?: Record<string, any>;
  isLocked?: boolean;
  allowAiExpansion?: boolean;
}) => {
  const region = await regionRepo.findOne({ where: { slug: slugify(input.regionSlug) } });
  if (!region) throw createError(404, 'Região não encontrada.');
  const slug = slugify(input.slug || input.name);
  const existing = await poiRepo.findOne({ where: { regionId: region.id, slug } });
  if (existing) throw createError(409, 'POI já existe nesta região.');
  const poi = poiRepo.create({
    regionId: region.id,
    slug,
    name: input.name,
    type: input.type,
    summary: input.summary ?? null,
    description: input.description ?? null,
    metadata: input.metadata ?? null,
    isLocked: input.isLocked ?? false,
    allowAiExpansion: input.allowAiExpansion ?? true,
  });
  return poiRepo.save(poi);
};

export const updatePointOfInterest = async (
  id: number,
  input: Partial<{
    regionSlug: string;
    name: string;
    slug: string;
    type: RegionPointOfInterest['type'];
    summary?: string | null;
    description?: string | null;
    metadata?: Record<string, any>;
    isLocked?: boolean;
    allowAiExpansion?: boolean;
  }>
) => {
  const poi = await poiRepo.findOne({ where: { id } });
  if (!poi) throw createError(404, 'Ponto de interesse não encontrado.');
  if (input.regionSlug) {
    const region = await regionRepo.findOne({ where: { slug: slugify(input.regionSlug) } });
    if (!region) throw createError(404, 'Região destino não encontrada.');
    poi.regionId = region.id;
  }
  if (input.slug) {
    const slug = slugify(input.slug);
    const conflict = await poiRepo.findOne({ where: { regionId: poi.regionId, slug } });
    if (conflict && conflict.id !== poi.id) throw createError(409, 'Slug já usado para outro POI.');
    poi.slug = slug;
  }
  if (input.name) poi.name = input.name;
  if (input.type) poi.type = input.type;
  if (input.summary !== undefined) poi.summary = input.summary;
  if (input.description !== undefined) poi.description = input.description;
  if (input.metadata !== undefined) poi.metadata = input.metadata;
  if (input.isLocked !== undefined) poi.isLocked = input.isLocked;
  if (input.allowAiExpansion !== undefined) poi.allowAiExpansion = input.allowAiExpansion;
  return poiRepo.save(poi);
};

export const deletePointOfInterest = async (id: number) => {
  const poi = await poiRepo.findOne({ where: { id } });
  if (!poi) throw createError(404, 'Ponto de interesse não encontrado.');
  await poiRepo.remove(poi);
};

const buildRegionPayload = (
  region: Region,
  links: RegionLink[],
  includeNeighbors = false
) => {
  const neighbors = links.filter(
    link => link.fromRegionId === region.id || link.toRegionId === region.id
  );
  return {
    id: region.id,
    slug: region.slug,
    name: region.name,
    summary: region.summary,
    description: region.description,
    type: region.type,
    parentRegionId: region.parentRegionId,
    parentSlug: region.parent?.slug ?? null,
    parentName: region.parent?.name ?? null,
    isSpawnPool: region.isSpawnPool,
    metadata: region.metadata ?? {},
    pointsOfInterest: (region.pointsOfInterest ?? []).map(mapPoi),
    neighbors: includeNeighbors
      ? neighbors.map(link => ({
          id: link.id,
          direction: link.fromRegionId === region.id ? 'outgoing' : 'incoming',
          targetRegionId: link.fromRegionId === region.id ? link.toRegionId : link.fromRegionId,
          targetRegionSlug:
            link.fromRegionId === region.id ? link.toRegion?.slug : link.fromRegion?.slug,
          targetRegionName:
            link.fromRegionId === region.id ? link.toRegion?.name : link.fromRegion?.name,
          travelMode: link.travelMode,
          travelTimeMinutes: link.travelTimeMinutes,
          difficulty: link.difficulty,
          isLocked: link.isLocked,
          notes: link.notes,
          metadata: link.metadata,
        }))
      : undefined,
  };
};

const mapPoi = (poi: RegionPointOfInterest) => ({
  id: poi.id,
  slug: poi.slug,
  name: poi.name,
  type: poi.type,
  summary: poi.summary,
  description: poi.description,
  metadata: poi.metadata ?? {},
  isLocked: poi.isLocked,
  allowAiExpansion: poi.allowAiExpansion,
});

const normalizeLabel = (value?: string | null) => {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export const resolveRegionByLabelOrSlug = async (label?: string | null) => {
  if (!label) return null;
  const normalizedSlug = slugify(label);
  let region = await regionRepo.findOne({ where: { slug: normalizedSlug } });
  if (region) return region;
  const normalizedName = normalizeLabel(label);
  if (!normalizedName) return null;
  region = await regionRepo
    .createQueryBuilder('region')
    .where('LOWER(region.name) = :name', { name: normalizedName })
    .getOne();
  return region ?? null;
};

export const validateRegionTransition = async (
  previousLabelOrSlug?: string | null,
  nextLabelOrSlug?: string
): Promise<{ slug: string; name: string }> => {
  if (!nextLabelOrSlug) throw createError(400, 'Região alvo não informada.');
  const nextRegion = await resolveRegionByLabelOrSlug(nextLabelOrSlug);
  if (!nextRegion) throw createError(400, 'Região alvo desconhecida.');

  const previousRegion = await resolveRegionByLabelOrSlug(previousLabelOrSlug);
  if (!previousRegion || previousRegion.slug === nextRegion.slug) {
    return { slug: nextRegion.slug, name: nextRegion.name };
  }

  const canTravel = await canTravelBetween(previousRegion.slug, nextRegion.slug);
  if (!canTravel) {
    throw createError(
      400,
      `Não há rota conhecida entre ${previousRegion.name} e ${nextRegion.name}.`
    );
  }

  return { slug: nextRegion.slug, name: nextRegion.name };
};

export const canTravelBetween = async (fromSlug: string, toSlug: string) => {
  if (fromSlug === toSlug) return true;
  const adjacency = await buildAdjacencyMap();
  if (!adjacency.has(fromSlug) || !adjacency.has(toSlug)) return false;
  const visited = new Set<string>([fromSlug]);
  const queue: string[] = [fromSlug];
  while (queue.length) {
    const currentSlug = queue.shift()!;
    const neighbors = adjacency.get(currentSlug);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (neighbor === toSlug) return true;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return false;
};

const buildAdjacencyMap = async () => {
  const links = await linkRepo.find({ relations: ['fromRegion', 'toRegion'] });
  const adjacency = new Map<string, Set<string>>();
  const ensureNode = (slug: string) => {
    if (!adjacency.has(slug)) adjacency.set(slug, new Set());
  };
  links.forEach(link => {
    const fromSlug = link.fromRegion?.slug;
    const toSlug = link.toRegion?.slug;
    if (!fromSlug || !toSlug) return;
    ensureNode(fromSlug);
    ensureNode(toSlug);
    adjacency.get(fromSlug)!.add(toSlug);
    adjacency.get(toSlug)!.add(fromSlug);
  });
  return adjacency;
};

export const getPointOfInterestBySlug = async (regionSlug: string, poiSlug: string) => {
  if (!regionSlug || !poiSlug) return null;
  const region = await regionRepo.findOne({ where: { slug: slugify(regionSlug) } });
  if (!region) return null;
  const poi = await poiRepo.findOne({
    where: { regionId: region.id, slug: slugify(poiSlug) },
    relations: ['region'],
  });
  return poi ?? null;
};

export const validatePoiEntry = async (
  regionSlug: string | null | undefined,
  poiSlug: string | null | undefined
) => {
  if (!regionSlug) throw createError(400, 'Região atual desconhecida. Saia do local atual antes de viajar.');
  if (!poiSlug) throw createError(400, 'Ponto de interesse alvo não informado.');
  const poi = await getPointOfInterestBySlug(regionSlug, poiSlug);
  if (!poi) {
    throw createError(400, 'Esse ponto de interesse não pertence à região atual.');
  }
  if (poi.isLocked) {
    throw createError(400, `O local "${poi.name}" está fechado ou protegido no momento.`);
  }
  return {
    slug: poi.slug,
    name: poi.name,
    type: poi.type,
    regionSlug: slugify(regionSlug),
  };
};

export const getRegionBreadcrumbs = async (
  slug?: string | null
): Promise<Array<{ slug: string; name: string }>> => {
  if (!slug) return [];
  const normalized = slugify(slug);
  const chain: Array<{ slug: string; name: string }> = [];
  let current = await regionRepo.findOne({
    where: { slug: normalized },
    relations: ['parent'],
  });
  const visited = new Set<number>();
  while (current && !visited.has(current.id)) {
    chain.unshift({ slug: current.slug, name: current.name });
    visited.add(current.id);
    if (!current.parentRegionId) break;
    current = await regionRepo.findOne({
      where: { id: current.parentRegionId },
      relations: ['parent'],
    });
  }
  return chain;
};

export const pickRandomSpawnRegion = async () => {
  const candidates = await regionRepo.find({ where: { type: 'city', isSpawnPool: true } });
  if (!candidates.length) {
    throw createError(400, 'Nenhuma cidade está marcada como spawn pool.');
  }
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
};
