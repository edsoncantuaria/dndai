// backend/src/server.ts
import 'reflect-metadata'; // Necessário para o TypeORM
import 'dotenv/config'; // Carrega as variáveis do .env para process.env
import express from 'express';
import cors from 'cors';
import { AppDataSource } from './database/data-source.js';
import errorMiddleware from './middlewares/errorMiddleware.js';

// Importa as rotas
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import licenseRoutes from './routes/licenseRoutes.js';
import narrarRoutes from './routes/narrarRoutes.js';
import sessoesRoutes from './routes/sessoesRoutes.js';
import characterRoutes from './routes/characterRoutes.js';
import dndApiRoutes from './routes/dndApiRoutes.js';
import homebrewRoutes from './routes/homebrewRoutes.js';
import aiRoutes from './routes/aiRoutes.js'; // Importa a nova rota de IA

const app = express();

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
    console.log(`[Server] Recebida requisição: ${req.method} ${req.originalUrl}`);
    next();
});

// Middlewares essenciais
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const PORT = process.env.PORT || 8071;

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/narrar', narrarRoutes);
app.use('/api/sessoes', sessoesRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/dnds', dndApiRoutes);
app.use('/api/homebrew', homebrewRoutes);
app.use('/api/ai', aiRoutes); // Adiciona a nova rota de IA

// Rota simples para verificar a saúde do servidor
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'O servidor está funcionando!' });
});

// O middleware de erro deve ser o último a ser adicionado
app.use(errorMiddleware);

const startServer = async () => {
    try {
        await AppDataSource.initialize();
        console.log('Conexão com o banco de dados estabelecida com sucesso.');
        
        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Não foi possível conectar ao banco de dados:', error);
        process.exit(1);
    }
};

startServer();
