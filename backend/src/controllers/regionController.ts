// backend/src/controllers/regionController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as RegionService from '../services/regionService.js';
import * as RegionAiService from '../services/regionAiService.js';
import {
  createRegionSchema,
  updateRegionSchema,
  createLinkSchema,
  updateLinkSchema,
  createPoiSchema,
  updatePoiSchema,
  aiRegionPromptSchema,
  createSnapshotSchema,
  importRegionGraphSchema,
  regionBackgroundUploadSchema,
} from '../schemas/regionSchemas.js';
import createError from 'http-errors';

export const listRegions = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const regions = await RegionService.listRegionsWithDetails();
    res.json({ regions });
  } catch (error) {
    next(error);
  }
};

export const getRegion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const region = await RegionService.getRegionBySlug(slug);
    res.json(region);
  } catch (error) {
    next(error);
  }
};

export const createRegion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payload = createRegionSchema.parse(req.body);
    const region = await RegionService.createRegion(payload);
    res.status(201).json(region);
  } catch (error) {
    next(error);
  }
};

export const updateRegion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const payload = updateRegionSchema.parse(req.body);
    const region = await RegionService.updateRegion(Number(id), payload);
    res.json(region);
  } catch (error) {
    next(error);
  }
};

export const deleteRegion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await RegionService.deleteRegion(Number(id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const createRegionLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payload = createLinkSchema.parse(req.body);
    const link = await RegionService.createRegionLink(payload);
    res.status(201).json(link);
  } catch (error) {
    next(error);
  }
};

export const updateRegionLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const payload = updateLinkSchema.parse({ ...req.body, id: Number(id) });
    const link = await RegionService.updateRegionLink(payload.id, payload);
    res.json(link);
  } catch (error) {
    next(error);
  }
};

export const deleteRegionLink = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await RegionService.deleteRegionLink(Number(id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const createPointOfInterest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = createPoiSchema.parse(req.body);
    const poi = await RegionService.createPointOfInterest(payload);
    res.status(201).json(poi);
  } catch (error) {
    next(error);
  }
};

export const updatePointOfInterest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const payload = updatePoiSchema.parse({ ...req.body, id: Number(id) });
    const poi = await RegionService.updatePointOfInterest(payload.id, payload);
    res.json(poi);
  } catch (error) {
    next(error);
  }
};

export const deletePointOfInterest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await RegionService.deletePointOfInterest(Number(id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const generateRegionDraft = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = aiRegionPromptSchema.parse(req.body);
    const draft = await RegionAiService.suggestRegionDraft(
      payload.prompt,
      payload.baseRegionSlug,
      payload.apiKey
    );
    res.json(draft);
  } catch (error) {
    next(error);
  }
};

export const exportRegionGraph = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const graph = await RegionService.exportRegionGraph();
    res.json(graph);
  } catch (error) {
    next(error);
  }
};

export const importRegionGraph = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = importRegionGraphSchema.parse(req.body);
    await RegionService.importRegionGraph(payload, { clearExisting: payload.clearExisting });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const listSnapshots = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const snapshots = await RegionService.listSnapshots();
    res.json({ snapshots });
  } catch (error) {
    next(error);
  }
};

export const createSnapshot = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { label } = createSnapshotSchema.parse(req.body);
    const snapshot = await RegionService.createSnapshot(label ?? '', req.user?.userId ?? null);
    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
};

export const restoreSnapshot = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await RegionService.restoreSnapshot(Number(id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const deleteSnapshot = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await RegionService.deleteSnapshot(Number(id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const listPendingAutoPois = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pois = await RegionService.listPendingAutoPois();
    const serialized = pois.map(poi => ({
      id: poi.id,
      slug: poi.slug,
      name: poi.name,
      type: poi.type,
      summary: poi.summary,
      description: poi.description,
      metadata: poi.metadata,
      isLocked: poi.isLocked,
      allowAiExpansion: poi.allowAiExpansion,
      regionSlug: poi.region?.slug ?? '',
      regionName: poi.region?.name ?? '',
    }));
    res.json({ pois: serialized });
  } catch (error) {
    next(error);
  }
};

export const approvePendingPoi = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const poi = await RegionService.approveAutoPoi(Number(id));
    res.json(poi);
  } catch (error) {
    next(error);
  }
};

export const rejectPendingPoi = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await RegionService.deletePointOfInterest(Number(id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const uploadRegionBackground = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { slug } = req.params;
    const payload = regionBackgroundUploadSchema.parse(req.body);
    const match = /^data:([^;]+);base64,(.+)$/i.exec(payload.dataUrl.trim());
    if (!match) {
      throw createError(400, 'Formato de imagem inválido.');
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length) {
      throw createError(400, 'Imagem vazia.');
    }
    const result = await RegionService.saveRegionBackground(slug, {
      buffer,
      contentType: match[1],
      originalName: payload.fileName,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteRegionBackground = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { slug } = req.params;
    await RegionService.clearRegionBackground(slug);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
