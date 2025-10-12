
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8071/api';

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
        token: data.token,
        isLicenseActive: data.isLicenseActive,
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


export const saveUserApiKey = async (apiKey: string) => {
    // This endpoint does not exist yet on the backend, this is a placeholder.
    // We will need to create it later.
    console.log("Saving API key (placeholder):", apiKey);
    return { success: true, message: "Chave de API salva (simulação)." };
};

export const fetchApiKey = async (): Promise<string | null> => {
     // This endpoint does not exist yet on the backend, this is a placeholder.
    console.log("Fetching API key (placeholder)");
    return null;
}
