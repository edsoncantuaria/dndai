
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { LicenseKey, User } from '../models';
import { z } from 'zod';
import { Op } from 'sequelize';

const activateLicenseSchema = z.object({
  key: z.string().min(1, "A chave de licença é obrigatória."),
});

export const activateLicense = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { key } = activateLicenseSchema.parse(req.body);

    const license = await LicenseKey.findOne({
      where: {
        key,
        is_active: false,
        expires_at: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!license) {
      return res.status(400).json({ message: "Chave de licença inválida, expirada ou já em uso." });
    }

    const user = await User.findByPk(userId);
    if (!user) {
         return res.status(404).json({ message: "Usuário não encontrado." });
    }

    license.userId = userId;
    license.is_active = true;
    await license.save();
    
    res.json({ message: "Licença ativada com sucesso!" });

  } catch (error) {
    next(error);
  }
};

export const getLicenseStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const license = await LicenseKey.findOne({ where: { userId } });

    if (!license) {
      return res.status(404).json({ isActive: false, message: 'Nenhuma licença encontrada para este usuário.' });
    }
    
    const isActive = license.is_active && license.expires_at > new Date();

    res.json({ 
        isActive, 
        key: license.key,
        expires_at: license.expires_at 
    });

  } catch (error) {
    next(error);
  }
};
