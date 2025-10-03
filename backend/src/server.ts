
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { sequelize } from './config/database';
import { errorMiddleware } from './middlewares/errorMiddleware';

// Importar rotas
import authRoutes from './routes/authRoutes';
import characterRoutes from './routes/characterRoutes';
import gameSessionRoutes from './routes/gameSessionRoutes';
import logRoutes from './routes/logRoutes';
import userRoutes from './routes/userRoutes';
import licenseRoutes from './routes/licenseRoutes';

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8071;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev')); // Middleware de logging

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/game-sessions', gameSessionRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/licenses', licenseRoutes);


// Rota de Teste
app.get('/', (req, res) => {
  res.send('Servidor Crônicas de Aventuras está no ar!');
});

// Middleware de Erros (deve ser o último)
app.use(errorMiddleware);

// Iniciar o servidor
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso via Sequelize.');

    // Sincronizar modelos com o banco de dados (cria tabelas se não existirem)
    await sequelize.sync({ alter: true }); // Use { force: true } para recriar as tabelas em desenvolvimento
    console.log('Modelos sincronizados com o banco de dados.');

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Não foi possível conectar ao banco de dados:', error);
    process.exit(1);
  }
};

startServer();
