'use client';

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Character, LogEntry } from '../types';
import { GameMasterResponse, GameMasterFlowInput } from "./gameSchemas";
import { GenerationConfig } from "@/contexts/SettingsContext";

// Esta função agora aceita a chave de API como um argumento.
const getGenAI = (apiKey: string) => {
    return new GoogleGenerativeAI(apiKey);
}

const systemInstruction = `Você é um Mestre de Jogo de Dungeons & Dragons 5ª Edição para um RPG de texto solo. Sua missão é criar uma história imersiva, justa e reativa, seguindo regras imutáveis.

### A Regra de Ouro: O Jogador Rola os Dados
- **IMUTÁVEL:** Você **NUNCA** rola dados de perícia, ataque ou salvamento para o jogador. Sua função é **solicitar** a rolagem. O jogador sempre rolará seus próprios dados. Rolagens para NPCs e monstros são feitas por você e narradas.

### Fluxo de Jogo Mandatório (Ação -> Rolagem -> Resultado)

**1. Jogador Declara uma Ação (Intenção):**
   - O jogador dirá o que quer fazer. Ex: "Eu tento persuadir o guarda a me deixar passar."

**2. Sua Tarefa: Validar e Solicitar a Rolagem:**
   - **Primeiro, valide:** A ação é plausível?
     - **Se IMPOSSÍVEL** (Ex: "Eu tento convencer a porta a se abrir."), responda com uma narração explicando por que não funciona. **NÃO peça uma rolagem.**
     - **Se POSSÍVEL,** sua resposta **DEVE** ser um JSON contendo **APENAS** o objeto \`playerRollRequest\`.
       - **Calcule a Dificuldade (DC):** Determine a DC (Fácil: 10, Médio: 14, Difícil: 18, Quase Impossível: 24+).
       - **Preencha o \`playerRollRequest\`:** Forneça \`reason\`, \`dice\` ('1d20'), o \`modifier\` correto do personagem e o \`dc\`.
       - **Exemplo de Resposta JSON:** \`{ "playerRollRequest": { "reason": "para persuadir o guarda", "dice": "1d20", "modifier": 3, "dc": 14, "rollType": "check" } }\`

**3. Jogador Envia o Resultado da Rolagem:**
   - A próxima ação do jogador será o resultado. Ex: "O resultado da minha rolagem de persuasão foi 18."

**4. Sua Tarefa: Narrar o Desfecho:**
   - **Compare o resultado com o DC que você definiu.**
   - **Narre o sucesso ou o fracasso** em \`logEntries\`. Seja descritivo.
   - **Atualize o estado do jogo** (\`updatedCharacter\`, \`combatState\`, etc.) se a ação teve consequências mecânicas.
   - **Forneça novas \`actionOptions\`** para dar continuidade à história.
   - **NÃO peça outra rolagem** a menos que uma nova ação do jogador a justifique.

### Outras Diretrizes Cruciais:

- **Fonte da Verdade:** O objeto \`character\` que você recebe é a única verdade. Baseie todas as suas decisões e cálculos (modificadores, recursos disponíveis, etc.) estritamente nele.
- **Gerenciamento de Recursos:** Se o jogador usa uma poção, gasta um espaço de magia, ou usa um item, você **DEVE** refletir essa mudança em \`updatedCharacter\`.
- **Dano e Cura:** Seja explícito. Use \`logEntries\` do tipo 'combat' para informar: "Você sofre 5 de dano perfurante." ou "Você recupera 8 pontos de vida." A cura **NUNCA** pode exceder os \`hp.max\`.
- **Formato de Saída:** Sua resposta **DEVE** ser sempre um único objeto JSON válido, sem nenhum texto ou marcador fora dele.
- **Idioma:** Toda a narração e texto para o jogador devem estar em **Português do Brasil**.
`;


const createPrompt = (input: GameMasterFlowInput, isGemma: boolean) => {
    const { character, playerAction, gameLog } = input;
    
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2);

    const mainPrompt = `### Estado Atual do Personagem (JSON)
${characterContext}

### Últimos Eventos do Jogo (JSON)
${logContext}
---
A ação do jogador é: "${playerAction}"

Com base no estado atual do personagem e no histórico, siga as regras e continue a aventura.`;

    if (isGemma) {
        return `${systemInstruction}\n\n${mainPrompt}\n\nResponda APENAS com um objeto JSON válido, sem marcadores ou texto adicional.`;
    }

    return mainPrompt;
}

export const getGameUpdate = async (input: GameMasterFlowInput, modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<GameMasterResponse | null> => {
    if (!apiKey) {
      throw new Error("Chave de API do Google não configurada. Por favor, adicione sua chave nas configurações.");
    }
    const genAI = getGenAI(apiKey);
    const isGemma = modelName.toLowerCase().includes('gemma');

    const model = genAI.getGenerativeModel({
        model: modelName,
        ...(!isGemma && {
            systemInstruction: {
                role: "model",
                parts: [{ text: systemInstruction }],
            },
        })
    });
    
    const finalGenerationConfig = {
        ...generationConfig,
        // Only set responseMimeType if it's NOT a Gemma model
        ...(!isGemma && { responseMimeType: "application/json" }),
    };


    const attemptGeneration = async (retry: boolean = false): Promise<GameMasterResponse | null> => {
        try {
            let prompt = createPrompt(input, isGemma);
            if (retry) {
                prompt += "\n\nSua resposta anterior não era um objeto JSON válido. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador extra."
            }

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: finalGenerationConfig,
            });

            const response = result.response;
            const jsonText = response.text();
            console.log(`[geminiService (${modelName})] Resposta da IA (Tentativa ${retry ? 2 : 1}):`, jsonText); 

            try {
                let textToParse = jsonText;
                if (isGemma) {
                    const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
                    if (match) {
                        textToParse = match[1];
                    }
                }

                const responseData = JSON.parse(textToParse);
                
                if (responseData.narration && typeof responseData.narration === 'string') {
                    if (!responseData.logEntries) responseData.logEntries = [];
                    responseData.logEntries.unshift({ type: 'narration', content: responseData.narration });
                    delete responseData.narration;
                }
                
                return responseData as GameMasterResponse;

            } catch(e) {
                console.error(`[geminiService] Falha ao analisar o JSON na tentativa ${retry ? 2 : 1}:`, e);
                if (!retry) {
                    console.log("[geminiService] Tentando novamente com prompt de correção...");
                    return await attemptGeneration(true);
                }
                throw new Error("O Mestre de Jogo forneceu uma resposta em um formato inválido, mesmo após a correção.");
            }

        } catch (error: any) {
            console.error(`[geminiService (${modelName})] Erro ao chamar a API do Gemini:`, error);
            throw new Error(`Erro de comunicação com o Mestre de Jogo: ${error.message}`);
        }
    }

    return await attemptGeneration();
};

export const testAiConnection = async (modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<string | null> => {
     if (!apiKey) {
        return "Erro: Nenhuma chave de API fornecida ou configurada. Por favor, adicione uma chave nas configurações.";
    }
    try {
        const genAI = getGenAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = "Você é o Mestre de um jogo de RPG de texto. Um jogador pergunta 'Mestre, você está aí?'. Responda de forma concisa e temática, em português do Brasil, confirmando que você está presente e pronto. Exemplo: 'Sim, estou aqui. O que você faz?'";
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                ...generationConfig,
                responseMimeType: "text/plain",
            }
        });

        const response = result.response;
        const textResponse = response.text();
        return `Modelo: ${modelName}\n\n${textResponse}`;
    } catch (error: any) {
        console.error("Erro no teste de conexão com a IA:", error);
        return `Falha ao conectar com a IA (${modelName}). Detalhes: ${error.message}`;
    }
};

    












