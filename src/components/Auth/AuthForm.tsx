'use client';
import { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthForm = () => {
    const [isLoginView, setIsLoginView] = useState(true);

    return (
        <div className="w-full max-w-md p-8 space-y-8 bg-stone-800/50 rounded-lg shadow-lg border border-stone-700 animate-fadeIn">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-amber-300 font-garamond">Crônicas de Aventuras</h1>
                <p className="mt-2 text-stone-400">
                    {isLoginView ? 'Acesse sua conta para continuar suas jornadas.' : 'Crie uma conta para começar sua saga.'}
                </p>
            </div>
            
            {isLoginView ? <LoginForm /> : <RegisterForm />}

            <div className="text-center">
                <button
                    onClick={() => setIsLoginView(!isLoginView)}
                    className="text-sm font-medium text-amber-400 hover:text-amber-300 hover:underline"
                >
                    {isLoginView
                        ? 'Não tem uma conta? Registre-se'
                        : 'Já tem uma conta? Faça o login'}
                </button>
            </div>
        </div>
    );
};

export default AuthForm;
