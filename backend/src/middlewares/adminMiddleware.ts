
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { User } from '../models';

// Middleware de exemplo para bloquear rotas para não-admins
export const blockNonAdmins = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    try {
        const user = await User.findByPk(req.user.id);
        
        // Supondo que existe um campo 'isAdmin' no modelo User.
        // Adicione este campo ao seu modelo User.ts se necessário.
        // if (user && (user as any).isAdmin) {
        //     return next();
        // }
        
        // Lógica de admin de exemplo - remover ou adaptar
        return res.status(403).json({ message: 'Acesso negado. Recurso para administradores.' });
        
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao verificar permissões de usuário.' });
    }
};
