
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3, "O nome de usuário deve ter pelo menos 3 caracteres."),
  email: z.string().email("Formato de e-mail inválido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "E-mail já cadastrado." });
    }
    
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(409).json({ message: "Nome de usuário já existe." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, email, password_hash });

    res.status(201).json({ message: "Usuário registrado com sucesso!", userId: newUser.id });
  } catch (error) {
    next(error);
  }
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const secret = process.env.SECRET_KEY;
    if (!secret) {
        throw new Error("Chave secreta JWT não está configurada.");
    }
    
    const token = jwt.sign({ id: user.id }, secret, { expiresIn: '7d' });

    res.json({ token, userId: user.id });
  } catch (error) {
    next(error);
  }
};
