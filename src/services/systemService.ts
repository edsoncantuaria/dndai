
// src/services/systemService.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8071';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

export const testAiConnection = async (model: string): Promise<string> => {
    try {
        const response = await fetch(`${API_URL}/api/test-ai`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                model: model,
                prompt: "Diga olá em uma única palavra."
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.details || result.message || 'Falha na comunicação com o servidor de IA.');
        }

        return result.response || "A IA respondeu, mas sem conteúdo.";
    } catch (error: any) {
        console.error("Erro ao testar a conexão com a IA:", error);
        throw error;
    }
};
