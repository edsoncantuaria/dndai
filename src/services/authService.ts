
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8071';

export interface LoginCredentials {
    login: string;
    password?: string; // Futuramente pode ser token
}

export interface RegisterDetails {
    username: string;
    email: string;
    password?: string;
    confirmPassword?: string;
}

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

export const registerUser = async (details: RegisterDetails) => {
    const response = await fetch(`${API_URL}/register`, {
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
    const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
    });
    const data = await response.json();
     if (!response.ok) {
        throw new Error(data.message || 'Erro no login.');
    }
    return {
        success: true,
        userId: data.userId,
        token: data.token,
        isLicenseActive: data.isLicenseActive,
        message: data.message,
    };
};

export const activateUserLicense = async (userId: number, licenseKey: string) => {
    const response = await fetch(`${API_URL}/api/activate-license`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, licenseKey }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Erro ao ativar a licença.');
    }
    return { success: true, message: data.message };
};


export const saveUserApiKey = async (userId: number, apiKey: string) => {
    const response = await fetch(`${API_URL}/api/user/google-key`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, apiKey }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Erro ao salvar a chave.');
    }
    return { success: true, message: data.message };
};

export const fetchApiKey = async (userId: number): Promise<string | null> => {
     try {
        const response = await fetch(`${API_URL}/api/user/google-key?userId=${userId}`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.apiKey || null;
    } catch {
        return null;
    }
}
