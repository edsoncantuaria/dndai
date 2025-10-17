// backend/src/controllers/homebrewController.ts
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as HomebrewService from '../services/homebrewService.js';
import { CreateHomebrewSchema, CreateBundleSchema, UpdateBundleSchema } from '../schemas/validationSchemas.js';
import { HomebrewContentType } from '../entities/HomebrewContent.js';
import createError from 'http-errors';

// Criar um novo conteúdo homebrew
export const createContent = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }

    try {
        const validatedData = CreateHomebrewSchema.parse(req.body);
        const newContent = await HomebrewService.createHomebrewContent(userId, validatedData);
        res.status(201).json({ message: 'Conteúdo Homebrew criado com sucesso!', content: newContent });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};

// Atualizar um conteúdo homebrew existente
export const updateContent = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }

    try {
        const validatedData = CreateHomebrewSchema.parse(req.body);
        const updatedContent = await HomebrewService.updateHomebrewContent(id, userId, validatedData);
        res.status(200).json({ message: 'Conteúdo Homebrew atualizado com sucesso!', content: updatedContent });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};

// Listar conteúdos homebrew (públicos ou do usuário) com paginação
export const listContent = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const type = req.query.type as HomebrewContentType | undefined;
    const scope = req.query.scope as 'public' | 'mine' | undefined;
    const createdBy = req.query.createdBy as 'user' | 'ai' | undefined;
    const userId = req.user?.userId;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 100;

    try {
        let content;
        if (scope === 'mine' && userId) {
            content = await HomebrewService.getHomebrewContentByAuthor(userId, type, { page, limit });
        } else {
            content = await HomebrewService.getPublicHomebrewContent(type, createdBy, { page, limit });
        }
        res.status(200).json(content);
    } catch (error) {
        next(error);
    }
};

// Obter um conteúdo homebrew específico por ID
export const getContentById = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    let userId: number | undefined;

    if (token) {
        try {
            const jwt = (await import('jsonwebtoken')).default;
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
            userId = decoded.userId;
        } catch (e) {
            // Token inválido, usuário não autenticado.
        }
    }

    try {
        const content = await HomebrewService.getHomebrewContentById(id, userId);
        res.status(200).json(content);
    } catch (error) {
        next(error);
    }
};

// Obter dependências de um conteúdo
export const getDependencies = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        const dependencies = await HomebrewService.getHomebrewDependencies(id);
        res.status(200).json(dependencies);
    } catch (error) {
        next(error);
    }
};

// Verificar se um nome/índice já existe
export const checkName = async (req: Request, res: Response, next: NextFunction) => {
    const { name, type } = req.body;
    if (!name || !type) {
        return next(createError(400, 'Nome e tipo são obrigatórios para verificação.'));
    }
    try {
        const exists = await HomebrewService.checkIfNameExists(name, type as HomebrewContentType);
        res.status(200).json({ exists });
    } catch (error) {
        next(error);
    }
};


// --- Funções de Bundle ---

export const listBundles = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const scope = req.query.scope as 'public' | 'mine' | undefined;
    const userId = req.user?.userId;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 100;

    try {
        const bundles = await HomebrewService.getBundles({ userId, scope, page, limit });
        res.status(200).json(bundles);
    } catch (error) {
        next(error);
    }
};

export const createBundle = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }

    try {
        const validatedData = CreateBundleSchema.parse(req.body);
        const newBundle = await HomebrewService.createBundle(userId, validatedData);
        res.status(201).json({ message: "Pacote criado com sucesso!", bundle: newBundle });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};


export const updateBundle = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }
    
    try {
        const validatedData = UpdateBundleSchema.parse(req.body);
        const updatedBundle = await HomebrewService.updateBundle(id, userId, validatedData);
        res.status(200).json({ message: "Pacote atualizado com sucesso!", bundle: updatedBundle });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};

export const deleteBundle = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }

    try {
        await HomebrewService.deleteBundle(id, userId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};


export const getBundleContents = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        const contents = await HomebrewService.getContentsOfBundle(id);
        res.status(200).json(contents);
    } catch (error) {
        next(error);
    }
};
