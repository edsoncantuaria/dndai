
import { Response, NextFunction } from 'express';
import { User } from '../models';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

export const getCurrentUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk(req.user!.id, {
      attributes: { exclude: ['password_hash'] }, // Nunca retorne o hash da senha
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};


export const getUserById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await User.findByPk(id, {
        attributes: { exclude: ['password_hash'] },
      });
  
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }
  
      // Em uma aplicação real, você pode querer restringir quem pode ver quais dados
      res.json(user);
    } catch (error) {
      next(error);
    }
  };
