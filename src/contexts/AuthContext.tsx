'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as authService from '@/services/authService';
import { useSettingsContext } from './SettingsContext';
import { useToast } from '@/hooks/use-toast';

interface User {
    id: number;
    username: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLicenseActive: boolean;
    hasApiKey: boolean;
    apiKey: string; // Expose API Key
    isLoading: boolean;
    login: (credentials: authService.LoginCredentials) => Promise<boolean>;
    register: (details: authService.RegisterDetails) => Promise<boolean>;
    activateLicense: (licenseKey: string) => Promise<boolean>;
    saveApiKey: (apiKey: string) => Promise<boolean>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-5e.edsin-server.space/api';


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLicenseActive, setIsLicenseActive] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { apiKey, setApiKey } = useSettingsContext();
    const { toast } = useToast();

    const hasApiKey = !!apiKey;

    const logout = useCallback(() => {
        setUser(null);
        setIsLicenseActive(false);
        localStorage.removeItem('token');
        // A chave de API não é removida no logout, pois é uma configuração do navegador.
        toast({
            description: "Você saiu da sua conta.",
        })
    }, [toast]);

    // This effect is responsible for validating the session on initial load.
    useEffect(() => {
        const validateSession = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    // Instead of trusting localStorage, verify token with backend
                    const response = await fetch(`${API_URL}/users/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (response.ok) {
                        const userData = await response.json();
                        setUser({ id: userData.id, username: userData.username });

                        const licenseResponse = await fetch(`${API_URL}/licenses/status`, {
                             headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (licenseResponse.ok) {
                            const licenseData = await licenseResponse.json();
                            if (licenseData.isActive) {
                                setIsLicenseActive(true);
                            }
                        }

                    } else {
                        logout();
                    }
                } catch (e) {
                    console.error('Falha na validação da sessão', e);
                    logout();
                }
            }
            setIsLoading(false);
        };
        validateSession();
    }, [logout]);

    const login = async (credentials: authService.LoginCredentials) => {
        setIsLoading(true);
        try {
            const response = await authService.loginUser(credentials);
            if (response && response.userId && response.token) {
                setUser({ id: response.userId, username: credentials.login }); // Temporariamente usa o login como username
                setIsLicenseActive(response.isLicenseActive);
                localStorage.setItem('token', response.token);
                
                toast({
                    title: "Login bem-sucedido!",
                    description: "Sua aventura o aguarda.",
                });

                return true;
            }
            throw new Error(response.message || 'Login falhou.');
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Erro no Login",
                description: err.message || 'Ocorreu um erro desconhecido.',
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (details: authService.RegisterDetails) => {
        if(details.password !== details.confirmPassword){
            toast({
                variant: "destructive",
                title: "Erro no Registro",
                description: "As senhas não coincidem.",
            });
            return false;
        }
        setIsLoading(true);
        try {
            const response = await authService.registerUser(details);
            if (response.success) {
                 toast({
                    title: "Registro Concluído!",
                    description: response.message + " Por favor, faça o login.",
                });
                return true;
            }
            throw new Error(response.message || 'Registro falhou.');
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Erro no Registro",
                description: err.message || 'Ocorreu um erro desconhecido.',
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const activateLicense = async (licenseKey: string) => {
        setIsLoading(true);
        try {
            const response = await authService.activateUserLicense(licenseKey);
            if (response.success) {
                setIsLicenseActive(true);
                toast({
                    title: "Licença Ativada!",
                    description: "Sua jornada pode começar.",
                });
                return true;
            }
            throw new Error(response.message || 'Falha na ativação da licença.');
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Erro de Ativação",
                description: err.message || 'Ocorreu um erro desconhecido.',
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const saveApiKey = async (newApiKey: string) => {
        setApiKey(newApiKey);
        toast({
            title: "Chave de API Salva!",
            description: "A chave foi salva localmente no seu navegador.",
        });
        return Promise.resolve(true);
    };

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLicenseActive,
        hasApiKey,
        apiKey,
        isLoading,
        login,
        register,
        activateLicense,
        saveApiKey,
        logout
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};
