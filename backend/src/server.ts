import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { sequelize } from './models'; // Importa a instância do sequelize

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8071;

// Rota de teste
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'O servidor está funcionando!' });
});

// Inicialização do Servidor e Conexão com o Banco de Dados
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Conexão com o banco de dados estabelecida com sucesso.');

        // Sincroniza os modelos com o banco de dados (idealmente, use migrations em produção)
        // await sequelize.sync({ alter: true }); 
        // console.log("Modelos sincronizados com o banco de dados.");

        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Não foi possível conectar ao banco de dados:', error);
        process.exit(1); // Encerra o processo se não conseguir conectar ao DB
    }
};

startServer();

export default app;
