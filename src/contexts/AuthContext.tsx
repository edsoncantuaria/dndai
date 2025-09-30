'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as authService from '@/services/authService';
import { useSettingsContext } from './SettingsContext';

interface User {
    id: number;
    username: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLicenseActive: boolean;
    hasApiKey: boolean;
    isLoading: boolean;
    error: string | null;
    login: (credentials: authService.LoginCredentials) => Promise<boolean>;
    register: (details: authService.RegisterDetails) => Promise<boolean>;
    activateLicense: (licenseKey: string) => Promise<boolean>;
    saveApiKey: (apiKey: string) => Promise<boolean>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLicenseActive, setIsLicenseActive] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { apiKey, setApiKey } = useSettingsContext(); // Use settings context for API key

    const checkApiKey = useCallback(async (userId: number) => {
        const key = await authService.fetchApiKey(userId);
        if (key) {
            setApiKey(key);
            return true;
        }
        return false;
    }, [setApiKey]);

    const hasApiKey = !!apiKey;

    useEffect(() => {
        const validateSession = async () => {
            try {
                const token = localStorage.getItem('token');
                const sessionData = localStorage.getItem('session');
                if (token && sessionData) {
                    const { userId, licenseActive } = JSON.parse(sessionData);
                    if (userId) {
                        setUser({ id: userId, username: '...' }); // Placeholder username
                        setIsLicenseActive(licenseActive);
                        if (licenseActive) {
                            await checkApiKey(userId);
                        }
                    }
                }
            } catch (e) {
                console.error('Session validation failed', e);
                localStorage.removeItem('session');
                localStorage.removeItem('token');
            } finally {
                setIsLoading(false);
            }
        };
        validateSession();
    }, [checkApiKey]);

    const login = async (credentials: authService.LoginCredentials) => {
        setError(null);
        setIsLoading(true);
        try {
            const response = await authService.loginUser(credentials);
            if (response && response.userId && response.token) {
                setUser({ id: response.userId, username: credentials.login }); // Use login as username for now
                setIsLicenseActive(response.isLicenseActive);
                localStorage.setItem('token', response.token);
                localStorage.setItem('session', JSON.stringify({ userId: response.userId, licenseActive: response.isLicenseActive }));
                if (response.isLicenseActive) {
                    await checkApiKey(response.userId);
                }
                return true;
            }
            throw new Error(response.message || 'Login falhou.');
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro desconhecido.');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (details: authService.RegisterDetails) => {
        setError(null);
        setIsLoading(true);
        try {
            const response = await authService.registerUser(details);
            if (response.success) {
                return true;
            }
            throw new Error(response.message || 'Registro falhou.');
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro desconhecido.');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const activateLicense = async (licenseKey: string) => {
        if (!user) return false;
        setError(null);
        setIsLoading(true);
        try {
            const response = await authService.activateUserLicense(user.id, licenseKey);
            if (response.success) {
                setIsLicenseActive(true);
                localStorage.setItem('session', JSON.stringify({ userId: user.id, licenseActive: true }));
                await checkApiKey(user.id);
                return true;
            }
            throw new Error(response.message || 'Falha na ativação da licença.');
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro desconhecido.');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const saveApiKey = async (newApiKey: string) => {
        if (!user) return false;
        setError(null);
        setIsLoading(true);
        try {
            const response = await authService.saveUserApiKey(user.id, newApiKey);
            if (response.success) {
                setApiKey(newApiKey);
                return true;
            }
            throw new Error(response.message || 'Falha ao salvar a chave de API.');
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro desconhecido.');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        setIsLicenseActive(false);
        setApiKey('');
        localStorage.removeItem('session');
        localStorage.removeItem('token');
        setError(null);
    };

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLicenseActive,
        hasApiKey,
        isLoading,
        error,
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
