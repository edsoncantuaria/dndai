'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as authService from '@/services/authService';
import { ApiError } from '@/services/apiClient';
import type { ApiFieldErrors } from '@/services/apiClient';
import { useSettingsContext } from './SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { readGeminiApiKey, writeGeminiApiKey } from '@/lib/geminiApiKeyStorage';

interface User {
    id: number;
    username: string;
    licenseKey?: { isActivated: boolean };
    settings?: any;
    acknowledgedHomebrewDisclaimer?: boolean;
    installedHomebrewIds?: string[];
}

interface AuthActionResult {
    success: boolean;
    message?: string;
    fieldErrors?: Record<string, string[]>;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLicenseActive: boolean;
    hasApiKey: boolean;
    isLoading: boolean;
    /** Preferências locais (incl. chave API) já carregadas do localStorage */
    isSettingsReady: boolean;
    isActionLoading: boolean;
    login: (credentials: authService.LoginCredentials) => Promise<AuthActionResult>;
    register: (details: authService.RegisterDetails) => Promise<AuthActionResult>;
    activateLicense: (licenseKey: string) => Promise<boolean>;
    saveApiKey: (apiKey: string) => Promise<boolean>;
    logout: () => void;
    acknowledgeHomebrew: () => Promise<void>;
    revalidateUserSession: () => Promise<void>;
    invalidateUserCache: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-5e.edsin-server.space/api';

const normalizeFieldErrors = (details?: ApiFieldErrors | null): Record<string, string[]> | undefined => {
    if (!details || typeof details !== 'object') {
        return undefined;
    }
    const normalized: Record<string, string[]> = {};

    Object.entries(details).forEach(([field, value]) => {
        if (Array.isArray(value)) {
            normalized[field] = value.filter(Boolean).map(String);
        } else if (value) {
            normalized[field] = [String(value)];
        }
    });

    return Object.keys(normalized).length > 0 ? normalized : undefined;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLicenseActive, setIsLicenseActive] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const { apiKey, setApiKey, loadSettings, saveSettingsToDB, getSettingsObject, isLoaded: isSettingsLoaded } = useSettingsContext();
    const { toast } = useToast();

    const hasApiKey = isSettingsLoaded && !!apiKey.trim();

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
                    const storedKey = readGeminiApiKey();
                    if (storedKey) {
                        setApiKey(storedKey);
                    }
                } else {
                    logout();
                }
            } catch (e) {
                console.error('Falha na revalidação da sessão', e);
                logout();
            }
        }
    }, [loadSettings, setApiKey]);

    const logout = useCallback(() => {
        setUser(null);
        setIsLicenseActive(false);
        setApiKey('');
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            // Limpa também o cache de equipamentos para garantir que o próximo login tenha dados frescos
            sessionStorage.removeItem('equipmentCache');
            sessionStorage.removeItem('dndai_hub_v2_entered');
            sessionStorage.removeItem('dndai_hub_back_target');
            sessionStorage.removeItem('dndai_hub_intent');
        }
        toast({
            description: "Você saiu da sua conta.",
        });
    }, [toast]);
    
    useEffect(() => {
        const validateSession = async () => {
            setIsLoading(true);
            await revalidateUserSession();
            setIsLoading(false);
        };
        validateSession();
    }, [revalidateUserSession]);

    const login = async (credentials: authService.LoginCredentials): Promise<AuthActionResult> => {
        const sanitizedCredentials = {
            login: credentials.login.trim(),
            password: credentials.password,
        };

        setIsActionLoading(true);
        try {
            const response = await authService.loginUser(sanitizedCredentials);
            if (response && response.user && response.token) {
                localStorage.setItem('token', response.token);
                await revalidateUserSession();

                toast({
                    title: "Login bem-sucedido!",
                    description: "Sua aventura o aguarda.",
                });

                return { success: true };
            }
            throw new Error(response?.message || 'Login falhou.');
        } catch (err: unknown) {
            console.error('Erro ao efetuar login', err);
            let message = 'Ocorreu um erro desconhecido.';
            let fieldErrors: Record<string, string[]> | undefined;

            if (err instanceof ApiError) {
                message = err.message || message;
                fieldErrors = normalizeFieldErrors(err.details);
            } else if (err instanceof Error) {
                message = err.message || message;
            }

            if ((!message || message === 'Ocorreu um erro desconhecido.') && fieldErrors) {
                const firstFieldError = Object.values(fieldErrors)[0]?.[0];
                if (firstFieldError) {
                    message = firstFieldError;
                }
            }

            if (!fieldErrors) {
                toast({
                    variant: "destructive",
                    title: "Erro no Login",
                    description: message,
                });
            }
            return { success: false, message, fieldErrors };
        } finally {
            setIsActionLoading(false);
        }
    };

    const register = async (details: authService.RegisterDetails): Promise<AuthActionResult> => {
        if (details.password !== details.confirmPassword) {
            const message = "As senhas não coincidem.";
            return {
                success: false,
                message,
                fieldErrors: {
                    password: [message],
                    confirmPassword: [message],
                },
            };
        }

        setIsActionLoading(true);
        const sanitizedDetails = {
            ...details,
            username: details.username.trim(),
            email: details.email.trim().toLowerCase(),
        };

        try {
            const response = await authService.registerUser(sanitizedDetails);
            if (response.success) {
                toast({
                    title: "Registro Concluído!",
                    description: response.message + " Por favor, faça o login.",
                });
                return { success: true, message: response.message };
            }
            throw new Error(response.message || 'Registro falhou.');
        } catch (err: unknown) {
            console.error('Erro ao registrar usuário', err);
            let message = 'Ocorreu um erro desconhecido.';
            let fieldErrors: Record<string, string[]> | undefined;

            if (err instanceof ApiError) {
                message = err.message || message;
                fieldErrors = normalizeFieldErrors(err.details);
            } else if (err instanceof Error) {
                message = err.message || message;
            }

            if ((!message || message === 'Ocorreu um erro desconhecido.') && fieldErrors) {
                const firstFieldError = Object.values(fieldErrors)[0]?.[0];
                if (firstFieldError) {
                    message = firstFieldError;
                }
            }

            if (!fieldErrors) {
                toast({
                    variant: "destructive",
                    title: "Erro no Registro",
                    description: message,
                });
            }

            return { success: false, message, fieldErrors };
        } finally {
            setIsActionLoading(false);
        }
    };

    const activateLicense = async (licenseKey: string) => {
        setIsActionLoading(true);
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
            setIsActionLoading(false);
        }
    };

    const saveApiKey = async (newApiKey: string) => {
        const trimmed = newApiKey.trim();
        if (!trimmed) return false;
        writeGeminiApiKey(trimmed);
        setApiKey(trimmed);
        toast({
            title: "Chave de API Salva!",
            description: "Sua chave ficou salva neste navegador.",
        });
        return true;
    };
    
     const acknowledgeHomebrew = async () => {
        if (!user) return;
        setIsActionLoading(true);
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
            setIsActionLoading(false);
        }
    };

    const invalidateUserCache = async () => {
        if (!user) return;
        setIsActionLoading(true);
        try {
            await authService.invalidateUserCache();
            await revalidateUserSession(); // Revalida os dados do usuário para obter informações frescas
        } catch (err: any) {
            // O toast já é tratado no componente, mas podemos logar aqui se necessário.
            console.error("[AuthContext] Falha ao invalidar cache do usuário:", err);
            throw err; // Re-lança para o componente poder tratar
        } finally {
            setIsActionLoading(false);
        }
    };


    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLicenseActive,
        hasApiKey,
        isLoading: isLoading || !isSettingsLoaded,
        isSettingsReady: isSettingsLoaded,
        isActionLoading,
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
