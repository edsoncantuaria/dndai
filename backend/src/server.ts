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

const app = express();

// Configuração do CORS
const allowedOrigins = [
    'http://localhost:9002', 
    'https://rpg.edsin-server.space',
    'https://6000-firebase-studio-1758579208514.cluster-udxxdyopu5c7cwhhtg6mmadhvs.cloudworkstations.dev'
];
const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Permitir requisições sem 'origin' (ex: Postman, apps mobile) ou da lista de permissões
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200 // Para compatibilidade com navegadores legados
};

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

// Rota simples para verificar a saúde do servidor
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'O servidor está funcionando!' });
});

// O middleware de erro deve ser o último a ser adicionado
app.use(errorMiddleware);

/**
 * Função para iniciar o servidor.
 * Primeiro, estabelece a conexão com o banco de dados e, em caso de sucesso,
 * inicia o servidor Express para ouvir as requisições.
 */
const startServer = async () => {
    try {
        await AppDataSource.initialize();
        console.log('Conexão com o banco de dados estabelecida com sucesso.');
        
        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Não foi possível conectar ao banco de dados:', error);
        process.exit(1); // Encerra o processo se não conseguir conectar ao DB
    }
};

startServer();
