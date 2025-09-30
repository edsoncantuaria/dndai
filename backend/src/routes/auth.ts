import { Express, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Connection } from 'mysql2/promise';
import { encrypt, decrypt } from '../utils/crypto';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';

export function setupAuthRoutes(app: Express, db: Connection) {
    
    // Lista de chaves de licença válidas (do .env)
    const validLicenseKeys: string[] = JSON.parse(process.env.LICENSE_KEYS || '[]');

    // Rota de Registro
    app.post('/register', async (req: Request, res: Response) => {
        const { username, password, licenseKey, googleApiKey } = req.body;
        const userRepository = AppDataSource.getRepository(User);

        if (!username || !password || !licenseKey) {
            return res.status(400).json({ message: "Nome de usuário, senha e chave de licença são obrigatórios." });
        }

        // 1. Validar a chave de licença
        if (!validLicenseKeys.includes(licenseKey)) {
            return res.status(403).json({ message: "Chave de licença inválida ou expirada." });
        }
        
        try {
            // 2. Verificar se o usuário já existe
            const existingUser = await userRepository.findOne({ where: { username } });
            if (existingUser) {
                return res.status(409).json({ message: "Nome de usuário já existe." });
            }

            // 3. Criptografar a senha
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // 4. Criptografar a chave de API do Google, se fornecida
            let encryptedApiKey: string | null = null;
            if (googleApiKey) {
                encryptedApiKey = encrypt(googleApiKey);
            }

            // 5. Criar e salvar o novo usuário usando TypeORM
            const newUser = new User();
            newUser.username = username;
            newUser.password = hashedPassword;
            newUser.licenseKey = licenseKey;
            newUser.googleApiKeyEncrypted = encryptedApiKey;

            await userRepository.save(newUser);

            res.status(201).json({ message: "Usuário registrado com sucesso." });

        } catch (error) {
            console.error("Erro no registro:", error);
            res.status(500).json({ message: "Erro interno do servidor." });
        }
    });

    // Rota de Login
    app.post('/login', async (req: Request, res: Response) => {
        const { username, password } = req.body;
        const userRepository = AppDataSource.getRepository(User);

        if (!username || !password) {
            return res.status(400).json({ message: "Nome de usuário e senha são obrigatórios." });
        }

        try {
            // 1. Encontrar o usuário
            const user = await userRepository.findOne({ where: { username } });
            if (!user) {
                return res.status(401).json({ message: "Credenciais inválidas." });
            }
            
            // 2. Verificar se a licença do usuário ainda é válida
            if (!validLicenseKeys.includes(user.licenseKey)) {
                return res.status(403).json({ message: "Sua licença expirou. Contate o administrador." });
            }

            // 3. Comparar a senha
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: "Credenciais inválidas." });
            }
            
            // 4. Descriptografar a chave da API para uso na sessão (NÃO enviar ao cliente)
            // Em uma implementação real, geraríamos um token JWT aqui.
            // Por enquanto, apenas retornamos uma mensagem de sucesso.
            let apiKey = null;
            if (user.googleApiKeyEncrypted) {
                apiKey = decrypt(user.googleApiKeyEncrypted);
            }
            
            // ATENÇÃO: NUNCA retorne a senha, hash da senha ou a API key descriptografada para o cliente.
            // O token JWT conteria o user.id para futuras requisições autenticadas.
            res.status(200).json({ 
                message: "Login bem-sucedido.",
                userId: user.id
                // Em um cenário real: token: "jwt_token_aqui"
            });

        } catch (error) {
            console.error("Erro no login:", error);
            res.status(500).json({ message: "Erro interno do servidor." });
        }
    });
}
