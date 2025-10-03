import { Express, Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { encrypt, decrypt } from '../utils/crypto';
import { authenticateToken } from '../middleware/authMiddleware';


export function setupUserRoutes(app: Express) {
  // Rota para salvar/atualizar a chave da API do Google do usuário
  app.post('/api/user/google-key', authenticateToken, async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { apiKey } = req.body;

    if (!userId || !apiKey) {
      return res.status(400).json({ message: 'ApiKey é obrigatório.' });
    }

    const userRepository = AppDataSource.getRepository(User);
    try {
      const user = await userRepository.findOne({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      user.googleApiKeyEncrypted = encrypt(apiKey);
      await userRepository.save(user);

      res.status(200).json({ message: 'Chave de API do Google salva com sucesso.' });
    } catch (error) {
      console.error('Erro ao salvar a chave de API do Google:', error);
      res.status(500).json({ message: 'Erro interno do servidor.' });
    }
  });

  // Rota para obter a chave de API do Google
  app.get('/api/user/google-key', authenticateToken, async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;

    if (!userId) {
        return res.status(400).json({ message: "Autenticação falhou, ID do usuário não encontrado." });
    }
    
    const userRepository = AppDataSource.getRepository(User);
    try {
      const user = await userRepository.findOne({ where: { id: Number(userId) } });

      if (!user || !user.googleApiKeyEncrypted) {
        return res.status(404).json({ message: 'Chave de API não encontrada para este usuário.' });
      }

      const decryptedKey = decrypt(user.googleApiKeyEncrypted);
      if (decryptedKey) {
        res.status(200).json({ apiKey: decryptedKey });
      } else {
        res.status(500).json({ message: 'Erro ao descriptografar a chave.' });
      }
    } catch (error) {
      console.error('Erro ao obter a chave de API do Google:', error);
      res.status(500).json({ message: 'Erro interno do servidor.' });
    }
  });
}
