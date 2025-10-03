import { Express, Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { LicenseKey } from '../entities/LicenseKey';
import { MoreThan } from 'typeorm';
import { authenticateToken } from '../middleware/authMiddleware';

export function setupLicenseRoutes(app: Express) {

    app.post('/api/activate-license', authenticateToken, async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const { licenseKey } = req.body;

        if (!userId || !licenseKey) {
            return res.status(400).json({ message: "UserId e Chave de Licença são obrigatórios." });
        }

        const userRepository = AppDataSource.getRepository(User);
        const licenseRepository = AppDataSource.getRepository(LicenseKey);

        try {
            const user = await userRepository.findOne({ where: { id: userId } });
            if (!user) {
                return res.status(404).json({ message: "Usuário não encontrado." });
            }

            const key = await licenseRepository.findOne({ 
                where: { 
                    key: licenseKey,
                    isActive: false, 
                    expiresAt: MoreThan(new Date())
                } 
            });

            if (!key) {
                // Adicionando uma verificação para chaves já em uso por outros
                const keyInUse = await licenseRepository.findOne({ where: { key: licenseKey, isActive: true } });
                if (keyInUse) {
                    return res.status(409).json({ message: "Chave de licença já está em uso." });
                }
                return res.status(400).json({ message: "Chave de licença inválida ou expirada." });
            }

            // Associa a chave ao usuário e a ativa
            key.isActive = true;
            key.userId = user.id;
            user.licenseKey = key;

            await licenseRepository.save(key);
            await userRepository.save(user);

            res.status(200).json({ message: "Licença ativada com sucesso!" });

        } catch (error) {
            console.error("Erro ao ativar licença:", error);
            res.status(500).json({ message: "Erro interno do servidor." });
        }
    });

}
