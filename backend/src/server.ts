import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sequelize } from './models';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import licenseRoutes from './routes/licenseRoutes';
import errorMiddleware from './middlewares/errorMiddleware';

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8071;

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/licenses', licenseRoutes);


app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'O servidor está funcionando!' });
});

// Middleware de Erro
app.use(errorMiddleware);

const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Conexão com o banco de dados estabelecida com sucesso.');
        
        // Opcional: sincroniza os modelos com o banco de dados.
        // Em desenvolvimento, você pode usar { force: true } para recriar as tabelas,
        // mas isso apaga todos os dados. Use com cuidado.
        // await sequelize.sync(); 

        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Não foi possível conectar ao banco de dados:', error);
        process.exit(1);
    }
};

startServer();

export default app;
