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
  importRegionGraphSchema,
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
