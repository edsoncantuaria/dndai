
import request from 'supertest';
import express from 'express';
import { Sequelize } from 'sequelize-typescript';
import authRoutes from '../src/routes/authRoutes';
import { errorMiddleware } from '../src/middlewares/errorMiddleware';
import { User } from '../src/models';

// Mocking do Sequelize e do modelo User
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    models: [User],
});

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorMiddleware);

beforeAll(async () => {
    await sequelize.sync({ force: true });
});

describe('Auth Routes', () => {

    // Limpa os usuários antes de cada teste para garantir a independência
    beforeEach(async () => {
        await User.destroy({ where: {} });
    });

    it('deve registrar um novo usuário com sucesso', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('message', 'Usuário registrado com sucesso!');
        expect(response.body).toHaveProperty('userId');
    });

    it('não deve registrar um usuário com um e-mail já existente', async () => {
        // Primeiro, cria um usuário
        await User.create({
            username: 'existinguser',
            email: 'test@example.com',
            password_hash: 'somehash'
        });

        // Tenta registrar com o mesmo e-mail
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'newuser',
                email: 'test@example.com',
                password: 'password123'
            });

        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('message', 'E-mail já cadastrado.');
    });

     it('não deve registrar um usuário com um nome de usuário já existente', async () => {
        await User.create({
            username: 'testuser',
            email: 'existing@example.com',
            password_hash: 'somehash'
        });

        const response = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'testuser',
                email: 'new@example.com',
                password: 'password123'
            });

        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('message', 'Nome de usuário já existe.');
    });

    it('deve retornar erro de validação para dados inválidos', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'te', // Muito curto
                email: 'not-an-email',
                password: '123' // Muito curta
            });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message', 'Erro de validação');
        expect(response.body.errors.length).toBeGreaterThan(0);
    });

});
