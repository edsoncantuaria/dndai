// src/services/authService.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8071/api';

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

const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

export const registerUser = async (details: RegisterDetails) => {
    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Erro no registro.');
    }
    return { success: true, message: data.message };
};


export const loginUser = async (credentials: LoginCredentials) => {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credentials.login, password: credentials.password }),
    });
    const data = await response.json();
     if (!response.ok) {
        throw new Error(data.message || 'Erro no login.');
    }
    return {
        success: true,
        userId: data.userId,
        username: data.username,
        token: data.token,
        isLicenseActive: data.isLicenseActive,
        settings: data.settings,
        message: data.message,
    };
};

export const activateUserLicense = async (licenseKey: string) => {
    const response = await fetch(`${API_URL}/licenses/activate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ key: licenseKey }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Erro ao ativar a licença.');
    }
    return { success: true, message: data.message };
};
