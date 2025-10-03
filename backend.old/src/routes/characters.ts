import { Express, Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { Character } from '../entities/Character';
import { User } from '../entities/User';
import { authenticateToken } from '../middleware/authMiddleware';

export function setupCharacterRoutes(app: Express) {

    // GET: Listar todos os personagens ativos de um usuário
    app.get('/api/characters', authenticateToken, async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        try {
            const characterRepository = AppDataSource.getRepository(Character);
            const characters = await characterRepository.find({
                where: { userId: userId, is_active: true },
                select: ["id", "characterData", "last_played_at"], 
            });

            const characterSlots = characters.map(c => {
                const data = c.characterData as any;
                return {
                    id: c.id,
                    name: data.name,
                    level: data.level,
                    characterClass: data.characterClass,
                    race: data.race,
                    last_played_at: c.last_played_at
                }
            });

            res.json(characterSlots);
        } catch (error) {
            console.error("Erro ao buscar personagens:", error);
            res.status(500).json({ message: "Erro interno do servidor." });
        }
    });

    // POST: Criar um novo personagem
    app.post('/api/characters/create', authenticateToken, async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const characterData = req.body;

        if (!characterData) {
            return res.status(400).json({ message: "Dados do personagem são obrigatórios." });
        }

        try {
            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOne({ where: { id: userId } });

            if (!user) {
                return res.status(404).json({ message: "Usuário não encontrado." });
            }

            const characterRepository = AppDataSource.getRepository(Character);
            const newCharacter = characterRepository.create({
                userId: userId,
                characterData: characterData,
                last_played_at: new Date(),
            });

            await characterRepository.save(newCharacter);

            res.status(201).json({ message: "Personagem criado com sucesso!", characterId: newCharacter.id });

        } catch (error) {
            console.error("Erro ao criar personagem:", error);
            res.status(500).json({ message: "Erro interno do servidor." });
        }
    });

    // DELETE: Realizar soft delete de um personagem
    app.delete('/api/character/:id', authenticateToken, async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const characterId = req.params.id;

        try {
            const characterRepository = AppDataSource.getRepository(Character);
            const character = await characterRepository.findOne({ where: { id: characterId, userId: userId } });

            if (!character) {
                return res.status(404).json({ message: "Personagem não encontrado ou não pertence a este usuário." });
            }

            character.is_active = false;
            character.deleted_at = new Date();
            await characterRepository.save(character);

            res.status(200).json({ message: "Personagem deletado com sucesso." });
        } catch (error) {
            console.error("Erro ao deletar personagem:", error);
            res.status(500).json({ message: "Erro interno do servidor." });
        }
    });
}
