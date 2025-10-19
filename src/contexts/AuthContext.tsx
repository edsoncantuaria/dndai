'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as authService from '@/services/authService';
import { useSettingsContext } from './SettingsContext';
import { useToast } from '@/hooks/use-toast';

interface User {
    id: number;
    username: string;
    licenseKey?: { isActivated: boolean };
    settings?: any;
    acknowledgedHomebrewDisclaimer?: boolean;
    installedHomebrewIds?: string[];
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLicenseActive: boolean;
    hasApiKey: boolean;
    isLoading: boolean;
    login: (credentials: authService.LoginCredentials) => Promise<boolean>;
    register: (details: authService.RegisterDetails) => Promise<boolean>;
    activateLicense: (licenseKey: string) => Promise<boolean>;
    saveApiKey: (apiKey: string) => Promise<boolean>;
    logout: () => void;
    acknowledgeHomebrew: () => Promise<void>;
    revalidateUserSession: () => Promise<void>;
    invalidateUserCache: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-5e.edsin-server.space/api';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLicenseActive, setIsLicenseActive] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { apiKey, setApiKey, loadSettings, saveSettingsToDB, getSettingsObject, isLoaded: isSettingsLoaded } = useSettingsContext();
    const { toast } = useToast();

    const hasApiKey = !!apiKey;

    const revalidateUserSession = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch(`${API_URL}/users/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const userData: User = await response.json();
                    setUser(userData);
                    setIsLicenseActive(userData.licenseKey?.isActivated || false);
                    if (userData.settings) {
                        loadSettings(userData.settings);
                    }
                } else {
                    logout();
                }
            } catch (e) {
                console.error('Falha na revalidação da sessão', e);
                logout();
            }
        }
    }, [loadSettings]);

    const logout = useCallback(() => {
        setUser(null);
        setIsLicenseActive(false);
        setApiKey('');
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            // Limpa também o cache de equipamentos para garantir que o próximo login tenha dados frescos
            sessionStorage.removeItem('equipmentCache');
        }
        toast({
            description: "Você saiu da sua conta.",
        });
    }, [toast, setApiKey]);
    
    useEffect(() => {
        const validateSession = async () => {
            setIsLoading(true);
            await revalidateUserSession();
            setIsLoading(false);
        };
        validateSession();
    }, [revalidateUserSession]);

    const login = async (credentials: authService.LoginCredentials) => {
        setIsLoading(true);
        try {
            const response = await authService.loginUser(credentials);
            if (response && response.user && response.token) {
                localStorage.setItem('token', response.token);
                await revalidateUserSession(); 

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
                await revalidateUserSession();
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
            description: "Sua chave foi salva em sua conta.",
        });
        return true;
    };
    
     const acknowledgeHomebrew = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            await authService.acknowledgeHomebrewDisclaimer();
            setUser(prev => prev ? { ...prev, acknowledgedHomebrewDisclaimer: true } : null);
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Erro ao Salvar",
                description: err.message || 'Não foi possível salvar sua preferência.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const invalidateUserCache = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            await authService.invalidateUserCache();
            await revalidateUserSession(); // Revalida os dados do usuário para obter informações frescas
        } catch (err: any) {
            // O toast já é tratado no componente, mas podemos logar aqui se necessário.
            console.error("[AuthContext] Falha ao invalidar cache do usuário:", err);
            throw err; // Re-lança para o componente poder tratar
        } finally {
            setIsLoading(false);
        }
    };


    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLicenseActive,
        hasApiKey,
        isLoading,
        login,
        register,
        activateLicense,
        saveApiKey,
        logout,
        acknowledgeHomebrew,
        revalidateUserSession,
        invalidateUserCache,
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
