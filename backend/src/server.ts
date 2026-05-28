// backend/src/server.ts
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });
import express from 'express';
import cors from 'cors';
import http from 'http'; // Importar o módulo http
import { AppDataSource } from './database/data-source.js';
import errorMiddleware from './middlewares/errorMiddleware.js';
import { configureWebSocket } from './websocket/webSocketServer.js';
import { getTranslations } from './services/translationService.js'; // Importa o novo serviço
import { checkObjectStorageHealth } from './services/objectStorageService.js';
import { env } from './config/env.js';
import { ensureQdrantCollections } from './database/qdrant-client.js';
import { refreshEnemyTemplatesFromDatabase } from './services/enemyTemplateRegistry.js';
import { describeTtsStatus } from './services/ttsService.js';
import { getMediaHealth } from './services/mediaHealthService.js';
import { checkSrdApiHealth } from './services/srdApiAdapter.js';

// Importa as rotas
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import licenseRoutes from './routes/licenseRoutes.js';
import sessoesRoutes from './routes/sessoesRoutes.js';
import characterRoutes from './routes/characterRoutes.js';
import homebrewRoutes from './routes/homebrewRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import unifiedDataRouter from './routes/unifiedDataRouter.js'; // Substitui dndApiRoutes
import cacheRoutes from './routes/cacheRoutes.js';
import logsRoutes from './routes/logsRoutes.js';
import regionRoutes from './routes/regionRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import { getOpenRouterMetricsHandler } from './controllers/metricsController.js';
import ttsRoutes from './routes/ttsRoutes.js';
import rollRequestRoutes from './routes/rollRequestRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import srdRoutes from './routes/srdRoutes.js';
import actionRoutes from './routes/actionRoutes.js';
import adminEventsRoutes from './routes/adminEventsRoutes.js';


const app = express();
const server = http.createServer(app); // Criar um servidor HTTP a partir do app Express

// Configuração do CORS
const allowedOrigins = [
    'http://localhost:9002',
    'https://rpg.edsin-server.space',
];

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.cloudworkstations.dev') || origin.endsWith('.webcontainer-api.io')) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    optionsSuccessStatus: 200
};

// Log de requisições
app.use((req, res, next) => {
    console.log(`[Server] Recebida requisição HTTP: ${req.method} ${req.originalUrl}`);
    next();
});

// Middlewares essenciais
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const PORT = env.PORT;

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/sessoes', sessoesRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/homebrew', homebrewRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/data', unifiedDataRouter); // Nova rota unificada
app.use('/api/cache', cacheRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/regions', regionRoutes);
app.use('/metrics', metricsRoutes);
app.get('/api/admin/ai-metrics', getOpenRouterMetricsHandler);
app.use('/api/admin', adminEventsRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/roll-requests', rollRequestRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/srd', srdRoutes);
app.use('/api/sessions', actionRoutes);


// Rota de Traduções
app.get('/api/translations', async (req, res, next) => {
    try {
        const translations = await getTranslations();
        res.json(translations);
    } catch (error) {
        next(error);
    }
});


// Rota de saúde do servidor e dependências
app.get('/api/health', async (_req, res) => {
    const [srd, media] = await Promise.all([checkSrdApiHealth(), getMediaHealth()]);
    res.status(200).json({
        status: 'UP',
        message: 'Crônicas de Aventuras backend',
        srd,
        media,
        tts: media.tts.enabled ? describeTtsStatus() : 'TTS desativado',
    });
});

// O middleware de erro deve ser o último a ser adicionado
app.use(errorMiddleware);

const startServer = async () => {
    try {
        await AppDataSource.initialize();
        console.log('Conexão com o banco de dados estabelecida com sucesso.');
        await refreshEnemyTemplatesFromDatabase();
        console.log('[Startup] Templates de inimigos sincronizados.');

        const { ensureDefaultSpawnRegions } = await import('./services/regionService.js');
        const spawnReady = await ensureDefaultSpawnRegions();
        console.log(
          spawnReady
            ? '[Startup] Spawn pool de cidades pronto.'
            : '[Startup] Aviso: spawn pool de cidades vazio — novas sessões podem falhar até `npm run seed:regions`.'
        );

        const storageHealth = await checkObjectStorageHealth();
        const storageMessagePrefix = '[Startup][ObjectStorage]';
        if (storageHealth.ok) {
            console.log(`${storageMessagePrefix} ${storageHealth.message}`);
        } else {
            console.warn(`${storageMessagePrefix} ${storageHealth.message}`);
        }

        if (env.QDRANT_ENABLED) {
            try {
                await ensureQdrantCollections();
            } catch (error) {
                console.error('[Startup][QDRANT] Falha ao preparar coleções:', error);
            }
        }

        console.log(`[Startup][TTS] ${describeTtsStatus()}`);
        
        // Configurar o servidor WebSocket, passando o servidor HTTP
        configureWebSocket(server);

        const skipNarrationWorkers = ['1', 'true', 'yes', 'on'].includes(
            (process.env.SKIP_NARRATION_WORKERS ?? '').trim().toLowerCase(),
        );
        if (skipNarrationWorkers) {
            console.log('[Startup] SKIP_NARRATION_WORKERS — consumidor BullMQ não iniciado neste processo.');
        } else {
            const { startNarrationWorkers } = await import('./queue/narrationWorker.js');
            startNarrationWorkers();
        }

        server.listen(PORT, () => {
            console.log(`Servidor HTTP e WebSocket rodando em http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Não foi possível conectar ao banco de dados:', error);
        process.exit(1);
    }
};

startServer();
