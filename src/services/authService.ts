// src/services/authService.ts
import { apiClient } from './apiClient';

export interface LoginCredentials {
    login: string;
    password?: string;
}

export interface RegisterDetails {
    username: string;
    email: string;
    password?: string;
    confirmPassword?: string;
}

/**
 * Registra um novo usuário na plataforma.
 * @param details As informações de registro do usuário.
 */
export const registerUser = async (details: RegisterDetails) => {
    return apiClient<{ success: boolean; message: string; user?: any }>('/v2/auth/register', {
        method: 'POST',
        body: JSON.stringify(details),
    });
};

/**
 * Autentica um usuário e retorna os dados do usuário e o token JWT.
 * @param credentials As credenciais de login (email e senha).
 */
export const loginUser = async (credentials: LoginCredentials) => {
    return apiClient<{ success: boolean; user: any; token: string; message: string }>('/v2/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: credentials.login, password: credentials.password }),
    });
};

/**
 * Ativa a chave de licença de um usuário.
 * @param licenseKey A chave de licença a ser ativada.
 */
export const activateUserLicense = async (licenseKey: string) => {
    return apiClient<{ success: boolean, message: string }>('/v2/licenses/activate', {
        method: 'POST',
        body: JSON.stringify({ key: licenseKey }),
    });
};

/**
 * Confirma que o usuário leu e aceitou o aviso sobre o sistema homebrew.
 */
export const acknowledgeHomebrewDisclaimer = async () => {
    return apiClient<{ success: boolean, message: string }>('/v2/users/me/acknowledge-homebrew', {
        method: 'POST',
    });
};

/**
 * Persiste a chave Gemini (BYOK) no perfil PENAI para narração no servidor.
 */
export const saveInferenceApiKey = async (apiKey: string) => {
    return apiClient<{ message: string; settings: Record<string, unknown> }>('/v2/users/me/settings', {
        method: 'PUT',
        body: JSON.stringify({ apiKey: apiKey.trim() }),
    });
};

/**
 * Salva as configurações de um usuário no backend.
 */
export const saveUserSettings = async (settings: any) => {
    // A chave de API é gerenciada pelo frontend e não deve ser enviada para o DB com as outras configurações.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { apiKey, ...settingsToSave } = settings;

    return apiClient<{ success: boolean, message: string, settings: any }>('/v2/users/me/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsToSave),
    });
};


/**
 * Invalida o cache do usuário no backend.
 */
export const invalidateUserCache = async () => {
    return apiClient<void>('/v2/users/me/invalidate-cache', {
        method: 'POST',
    });
};
