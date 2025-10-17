// backend/src/controllers/homebrewController.ts
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as HomebrewService from '../services/homebrewService.js';
import { CreateHomebrewSchema } from '../schemas/validationSchemas.js';
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


// Listar conteúdos homebrew (públicos ou do usuário)
export const listContent = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const type = req.query.type as HomebrewContentType | undefined;
    const scope = req.query.scope as 'public' | 'mine' | undefined;
    const createdBy = req.query.createdBy as 'user' | 'ai' | undefined; // REVALIDATE
    const userId = req.user?.userId;

    try {
        let content;
        if (scope === 'mine' && userId) {
            content = await HomebrewService.getHomebrewContentByAuthor(userId, type); // REVALIDATE
        } else {
            // O padrão é listar conteúdo público
            content = await HomebrewService.getPublicHomebrewContent(type, createdBy); // REVALIDATE
        }
        res.status(200).json(content);
    } catch (error) {
        next(error);
    }
};

// Obter um conteúdo homebrew específico por ID
export const getContentById = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    // O userId pode não estar presente para conteúdo público, então tratamos como opcional.
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    let userId: number | undefined;

    if (token) {
        // Tentativa de verificar o token sem quebrar se for inválido
        try {
            const jwt = (await import('jsonwebtoken')).default;
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
            userId = decoded.userId;
        } catch (e) {
            // Token inválido ou expirado, o usuário não está autenticado.
        }
    }

    try {
        const content = await HomebrewService.getHomebrewContentById(id, userId);
        res.status(200).json(content);
    } catch (error) {
        next(error);
    }
};

// Nova função para obter dependências
export const getDependencies = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        const dependencies = await HomebrewService.getHomebrewDependencies(id);
        res.status(200).json(dependencies);
    } catch (error) {
        next(error);
    }
};
