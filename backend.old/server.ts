import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import cors from 'cors';
import { AppDataSource } from './src/config/data-source';
import { setupAuthRoutes } from './src/routes/auth';
import { setupLicenseRoutes } from './src/routes/license';
import { setupUserRoutes } from './src/routes/user';
import { setupCharacterRoutes } from './src/routes/characters';
import { setupGameRoutes } from './src/routes/game';
import { UserFacingError } from 'genkit';


const app: Express = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

async function startServer() {
    try {
        await AppDataSource.initialize();
        console.log("Conexão com o banco de dados estabelecida com sucesso via TypeORM.");

        // Configuração de Rotas
        setupAuthRoutes(app);
        setupLicenseRoutes(app);
        setupUserRoutes(app);
        setupCharacterRoutes(app);
        setupGameRoutes(app);

        app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (err instanceof UserFacingError) {
                res.status(400).json({
                    code: err.code,
                    message: err.message,
                });
            } else {
                console.error("Unhandled error:", err);
                res.status(500).json({
                    code: 'INTERNAL',
                    message: err.message || 'An internal server error occurred.',
                });
            }
        });

        const PORT = process.env.PORT || 8071;
        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
            console.log('Rotas da Fase 2 (IA) e Fase 3 (Jogo) estão ativas.');
        });

    } catch (error) {
        console.error("Falha ao iniciar o servidor ou conectar ao banco de dados:", error);
        process.exit(1);
    }
}

startServer();
