// backend/src/controllers/sessoesController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import createError from 'http-errors';
import { clearAiInstanceFromCache } from '../services/aiService.js';
import { IsNull } from 'typeorm';
import { Character } from '../entities/Character.js';
import { User } from '../entities/User.js';

// Função auxiliar para reconstruir o objeto completo do personagem
const buildFullCharacterObject = async (character: Character) => {
    const fullCharacter = await AppDataSource.getRepository(Character).findOne({
        where: { id: character.id },
        relations: [
            "attributes",
            "proficiencies",
            "items",
            "spells",
            "journal", // Adicionado
            "relationships", // Adicionado
            "relationships.quests" // Adicionado
        ],
    });
    if (!fullCharacter) return character;
    
    // Transforma as entidades de volta para o formato que o frontend espera
    const characterData = {
        ...fullCharacter,
        attributes: fullCharacter.attributes,
        proficiencies: fullCharacter.proficiencies,
        inventory: fullCharacter.items.map(item => item.itemData), // Pega o JSON do item
        spells: fullCharacter.spells.map(s => s.spellName),
        journal: fullCharacter.journal,
        relationships: fullCharacter.relationships,
    };
    delete (characterData as any).items;
    return characterData;
};

// Criar uma nova sessão de jogo para um personagem existente
export const createSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { nome, characterId } = req.body;
    const userId = req.user?.userId;

    if (!nome || !characterId) {
        return next(createError(400, 'Nome da sessão e ID do personagem são obrigatórios.'));
    }

    try {
        const characterRepository = AppDataSource.getRepository(Character);
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const userRepository = AppDataSource.getRepository(User);

        // Verifica se o personagem pertence ao usuário logado
        const character = await characterRepository.findOne({ where: { id: characterId, userId: userId! } });
        if (!character) {
            return next(createError(404, 'Personagem não encontrado ou você não tem permissão para usá-lo.'));
        }

        // Verifica se já existe uma sessão ativa para este personagem
        const existingSession = await sessaoRepository.findOne({ where: { characterId, userId: userId!, deletedAt: IsNull() } });

        if (existingSession) {
            // Se a sessão já existe, retorna os dados dela para continuar
            const { apiKey: sensitiveApiKey, ...sessaoParaRetorno } = existingSession;
            return res.status(200).json({ message: 'Sessão existente encontrada.', sessao: sessaoParaRetorno });
        }


        const user = await userRepository.findOne({ where: { id: userId! } });
        if (!user?.settings?.apiKey) {
            return next(createError(400, 'Nenhuma chave de API encontrada nas suas configurações. Adicione uma antes de criar a sessão.'));
        }
        const keyToUse = user.settings.apiKey;

        const novaSessao = new SessaoIA();
        novaSessao.nome = nome;
        novaSessao.character = character;
        novaSessao.userId = userId!;
        novaSessao.apiKey = keyToUse; // Salva a chave do usuário na sessão
        novaSessao.logs = [];

        const sessaoSalva = await sessaoRepository.save(novaSessao);

        const { apiKey: sensitiveApiKey, ...sessaoParaRetorno } = sessaoSalva;

        res.status(201).json({ message: 'Sessão criada com sucesso!', sessao: sessaoParaRetorno });
    } catch (error) {
        next(error);
    }
};


// Listar todas as sessões do usuário autenticado
export const getSessoes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const sessoes = await sessaoRepository.find({
            where: { userId: userId!, deletedAt: IsNull() },
            relations: ['character'], 
            select: {
                id: true,
                nome: true,
                createdAt: true,
                updatedAt: true,
                character: {
                    id: true,
                    name: true,
                    level: true,
                    characterClass: true,
                    race: true,
                }
            }
        });
        res.status(200).json(sessoes);
    } catch (error) {
        next(error);
    }
};

// Obter uma sessão específica com seus logs
export const getSessaoById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const sessao = await sessaoRepository.findOne({
            where: { id: Number(id), userId: userId!, deletedAt: IsNull() },
            relations: ['logs', 'character'] 
        });

        if (!sessao) {
            return next(createError(404, 'Sessão não encontrada ou você não tem permissão.'));
        }

        // Reconstroi o objeto do personagem completo
        if (sessao.character) {
            sessao.character = await buildFullCharacterObject(sessao.character) as Character;
        }
        
        const { apiKey, ...sessaoSegura } = sessao;

        res.status(200).json(sessaoSegura);
    } catch (error) {
        next(error);
    }
};


// Deletar uma sessão (agora usando soft delete)
export const deleteSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const result = await sessaoRepository.softDelete({ id: Number(id), userId: userId! });

        if (result.affected === 0) {
            return next(createError(404, 'Sessão não encontrada ou você não tem permissão para deletá-la.'));
        }
        
        clearAiInstanceFromCache(Number(id));

        res.status(200).json({ message: 'Sessão movida para a lixeira com sucesso.' });
    } catch (error) {
        next(error);
    }
};

    