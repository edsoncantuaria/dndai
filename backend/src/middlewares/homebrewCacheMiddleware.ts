// backend/src/middleware/homebrewCacheMiddleware.ts
import { invalidateUserCache } from '../services/unifiedDataService.js';
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';

/**
 * Middleware inteligente que invalida automaticamente o cache
 * quando o usuário instala, desinstala ou modifica homebrews.
 *
 * Ele intercepta requisições POST, PUT, DELETE nas rotas /api/homebrew
 * e aciona a função `invalidateUserCache()` de forma assíncrona.
 */
export async function homebrewCacheMiddleware(req, res, next) {
  try {
    const method = req.method.toUpperCase();
    const path = req.path;

    // Interessa apenas às rotas de instalação/desinstalação/modificação
    const isMutatingHomebrew =
      path.startsWith('/install') ||
      path.startsWith('/uninstall') ||
      ['POST', 'PUT', 'DELETE'].includes(method);

    if (!isMutatingHomebrew) return next();

    // Tenta identificar o usuário (pode vir do token ou do header)
    const userId = req.user?.id || parseInt(req.headers['x-user-id'] as string) || 0;
    if (!userId) return next();

    // Aguarda a operação principal (instalar/desinstalar) ser concluída
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
          if (user) {
            await invalidateUserCache(userId);
            console.log(`[HomebrewCacheMiddleware] Cache do usuário ${userId} invalidado automaticamente após modificação de Homebrew.`);
          }
        } catch (err) {
          console.error(`[HomebrewCacheMiddleware] Erro ao invalidar cache do usuário ${userId}:`, err);
        }
      }
    });

    next();
  } catch (err) {
    console.error('[HomebrewCacheMiddleware] Erro interno:', err);
    next();
  }
}
