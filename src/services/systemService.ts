// src/services/systemService.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8071';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

export const testAiConnection = async (userId: number, model: string): Promise<string> => {
    try {
        const response = await fetch(`${API_URL}/api/test-ai`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                userId,
                model,
                prompt: "Diga olá em uma única palavra."
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha na comunicação com o servidor de IA.');
        }

        const result = await response.json();
        return result || "A IA respondeu, mas sem conteúdo.";
    } catch (error: any) {
        console.error("Erro ao testar a conexão com a IA:", error);
        throw error; // Re-throw para ser tratado pelo UI
    }
};
