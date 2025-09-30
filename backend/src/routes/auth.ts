import { Express, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { encrypt } from '../utils/crypto';
import { LicenseKey } from '../entities/LicenseKey';

export function setupAuthRoutes(app: Express) {

    // Rota de Registro
    app.post('/register', async (req: Request, res: Response) => {
        const { username, email, password, confirmPassword } = req.body;
        const userRepository = AppDataSource.getRepository(User);

        if (!username || !email || !password || !confirmPassword) {
            return res.status(400).json({ message: "Nome de usuário, email e senhas são obrigatórios." });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "As senhas não coincidem." });
        }

        try {
            const existingUserByUsername = await userRepository.findOne({ where: { username } });
            if (existingUserByUsername) {
                return res.status(409).json({ message: "Nome de usuário já existe." });
            }

            const existingUserByEmail = await userRepository.findOne({ where: { email } });
            if (existingUserByEmail) {
                return res.status(409).json({ message: "Email já está em uso." });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = new User();
            newUser.username = username;
            newUser.email = email;
            newUser.password = hashedPassword;
            
            await userRepository.save(newUser);

            res.status(201).json({ message: "Usuário registrado com sucesso. Faça o login para continuar." });

        } catch (error) {
            console.error("Erro no registro:", error);
            res.status(500).json({ message: "Erro interno do servidor." });
        }
    });

    // Rota de Login
    app.post('/login', async (req: Request, res: Response) => {
        const { login, password } = req.body; // 'login' can be username or email
        const userRepository = AppDataSource.getRepository(User);

        if (!login || !password) {
            return res.status(400).json({ message: "Login e senha são obrigatórios." });
        }

        try {
            const user = await userRepository.findOne({ 
                where: [{ username: login }, { email: login }],
                relations: ["licenseKey"] 
            });

            if (!user) {
                return res.status(401).json({ message: "Credenciais inválidas." });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: "Credenciais inválidas." });
            }

            const isLicenseActive = user.licenseKey ? user.licenseKey.isActive && new Date() < user.licenseKey.expiresAt : false;
            
            // Em uma implementação real, geraríamos um token JWT aqui.
            res.status(200).json({ 
                message: "Login bem-sucedido.",
                userId: user.id,
                isLicenseActive: isLicenseActive
                // No futuro: token: "jwt_token_aqui"
            });

        } catch (error) {
            console.error("Erro no login:", error);
            res.status(500).json({ message: "Erro interno do servidor." });
        }
    });
}
