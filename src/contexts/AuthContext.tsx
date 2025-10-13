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
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = 'https://backend-5e.edsin-server.space/api';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLicenseActive, setIsLicenseActive] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { apiKey, setApiKey, loadSettings, saveSettingsToDB, getSettingsObject, isLoaded: isSettingsLoaded } = useSettingsContext();
    const { toast } = useToast();

    // Recalculate hasApiKey whenever apiKey changes.
    const hasApiKey = !!apiKey;

    const logout = useCallback(() => {
        setUser(null);
        setIsLicenseActive(false);
        setApiKey('');
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
        }
        toast({
            description: "Você saiu da sua conta.",
        });
    }, [toast, setApiKey]);
    
    useEffect(() => {
        const validateSession = async () => {
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

                        // If user has settings in DB, load them.
                        if (userData.settings) {
                           loadSettings(userData.settings);
                        } else if (isSettingsLoaded) {
                           // If user has NO settings in DB, but settings ARE loaded in the context (from localStorage),
                           // then this is the first login on this machine, and we should sync local to DB.
                           await saveSettingsToDB(getSettingsObject());
                        }
                    } else {
                        // Token is invalid
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSettingsLoaded]); // Depend on isSettingsLoaded to ensure we sync only after context is ready.

    const login = async (credentials: authService.LoginCredentials) => {
        setIsLoading(true);
        try {
            const response = await authService.loginUser(credentials);
            if (response && response.user && response.token) {
                const userData: User = response.user;
                setUser(userData);
                setIsLicenseActive(userData.licenseKey?.isActivated || false);
                localStorage.setItem('token', response.token);

                if (userData.settings) {
                    loadSettings(userData.settings);
                } else {
                    // New user or user without settings, sync local settings (if any) to DB
                    await saveSettingsToDB(getSettingsObject());
                }

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
                // Update user state to reflect license activation
                setUser(prev => prev ? { ...prev, licenseKey: { isActivated: true } } : null);
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
        setApiKey(newApiKey); // This will trigger the useEffect in SettingsContext to save to DB
        toast({
            title: "Chave de API Salva!",
            description: "Sua chave foi salva em sua conta.",
        });
        return true;
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
