import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { decrypt } from './crypto';

/**
 * Fetches a user's encrypted Google API key from the database and decrypts it.
 * @param userId The ID of the user.
 * @returns The decrypted API key, or null if not found or on error.
 */
export const getUserApiKey = async (userId: number): Promise<string | null> => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id: userId } });
    
    if (!user || !user.googleApiKeyEncrypted) {
      console.warn(`Nenhuma chave de API encontrada para o usuário ${userId}`);
      return null;
    }
    
    const decryptedKey = decrypt(user.googleApiKeyEncrypted);
    if (!decryptedKey) {
        console.error(`Falha ao descriptografar a chave para o usuário ${userId}.`);
        return null;
    }

    return decryptedKey;

  } catch (error) {
    console.error("Erro ao buscar a chave de API do usuário:", error);
    return null;
  }
};
