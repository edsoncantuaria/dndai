// backend/src/schemas/regionSchemas.ts
import { z } from 'zod';

export const REGION_TYPES = ['world', 'city', 'dungeon', 'wild', 'instance'] as const;
export const TRAVEL_MODES = ['walk', 'mount', 'airship', 'portal', 'ship', 'teleport'] as const;
export const POI_TYPES = ['landmark', 'dungeon', 'shop', 'story', 'wild', 'instance', 'misc'] as const;

const metadataSchema = z.record(z.any()).optional();

export const createRegionSchema = z.object({
  name: z.string().min(3),
  slug: z.string().min(3).max(120),
  type: z.enum(REGION_TYPES),
  parentSlug: z.string().min(1).optional(),
  summary: z.string().min(10).max(280).optional(),
  description: z.string().optional(),
  metadata: metadataSchema,
  isSpawnPool: z.boolean().optional(),
});

export const updateRegionSchema = createRegionSchema.partial().extend({
  name: z.string().min(3).optional(),
  slug: z.string().min(3).optional(),
});

export const createLinkSchema = z.object({
  fromRegionSlug: z.string().min(1),
  toRegionSlug: z.string().min(1),
  travelMode: z.enum(TRAVEL_MODES).default('walk'),
  travelTimeMinutes: z.number().int().min(0).default(0),
  difficulty: z.string().max(120).optional(),
  isLocked: z.boolean().optional(),
  notes: z.string().max(255).optional(),
  metadata: metadataSchema,
});

export const updateLinkSchema = createLinkSchema.partial().extend({
  id: z.number().int(),
});

export const createPoiSchema = z.object({
  regionSlug: z.string().min(1),
  name: z.string().min(3),
  slug: z.string().min(3),
  type: z.enum(POI_TYPES).default('landmark'),
  summary: z.string().max(240).optional(),
  description: z.string().optional(),
  metadata: metadataSchema,
  isLocked: z.boolean().optional(),
  allowAiExpansion: z.boolean().optional(),
});

export const updatePoiSchema = createPoiSchema.partial().extend({
  id: z.number().int(),
});

export const aiRegionPromptSchema = z.object({
  prompt: z.string().min(10),
  baseRegionSlug: z.string().min(1).optional(),
  apiKey: z.string().optional(),
});

const regionEntrySchema = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  type: z.enum(REGION_TYPES),
  parentSlug: z.string().min(1).optional().nullable(),
  summary: z.string().optional(),
  description: z.string().optional(),
  metadata: metadataSchema,
  isSpawnPool: z.boolean().optional(),
});

const linkEntrySchema = z.object({
  fromSlug: z.string().min(1),
  toSlug: z.string().min(1),
  travelMode: z.enum(TRAVEL_MODES).optional(),
  travelTimeMinutes: z.number().int().min(0).optional(),
  difficulty: z.string().max(120).optional(),
  isLocked: z.boolean().optional(),
  notes: z.string().optional(),
  metadata: metadataSchema,
});

const poiEntrySchema = z.object({
  regionSlug: z.string().min(1),
  name: z.string().min(3),
  slug: z.string().min(3),
  type: z.enum(POI_TYPES).optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  metadata: metadataSchema,
  isLocked: z.boolean().optional(),
  allowAiExpansion: z.boolean().optional(),
});

export const importRegionGraphSchema = z.object({
  clearExisting: z.boolean().optional(),
  regions: z.array(regionEntrySchema),
  links: z.array(linkEntrySchema).default([]),
  pois: z.array(poiEntrySchema).default([]),
});

export type RegionGraphPayload = z.infer<typeof importRegionGraphSchema>;
