
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

const app = express();

// Middlewares essenciais
app.use(cors()); // Habilita o Cross-Origin Resource Sharing
app.use(express.json()); // Permite que o Express entenda JSON no corpo das requisições

const PORT = process.env.PORT || 8071;

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/narrar', narrarRoutes);
app.use('/api/sessoes', sessoesRoutes);


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
