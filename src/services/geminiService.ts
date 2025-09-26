
'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Character, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem } from '../types';
import { GameMasterResponse, GameMasterFlowInput } from "./gameSchemas";
import { GenerationConfig } from "@/contexts/SettingsContext";

// Esta função agora aceita a chave de API como um argumento.
const getGenAI = (apiKey: string) => {
    return new GoogleGenerativeAI(apiKey);
}

const systemInstruction = `Você é um Mestre de Jogo criativo e justo para um RPG de texto solo de Dungeons & Dragons 5ª Edição. Seu objetivo é criar uma história contínua e envolvente que reaja às escolhas do jogador.

### Diretrizes de Saída
- **Formato:** Sua saída DEVE ser um único objeto JSON válido. Não inclua nenhum texto, formatação ou marcadores como \`\`\`json \`\`\` fora do objeto JSON.
- **Idioma:** Toda a sua narração e texto devem estar em **português do Brasil**.

### Estrutura do JSON de Resposta (GameMasterResponseSchema)
{
  "logEntries": [{ "type": "...", "content": "..." }],
  "actionOptions": ["Opção 1", { "text": "Opção 2", "action": "internal_action" }],
  "updatedCharacter": { /* APENAS os campos que mudaram */ },
  "playerRollRequest": { "reason": "Para escalar o muro", "dice": "1d20", "modifier": 3, "rollType": "check" },
  /* outros campos opcionais como combatState, levelUpState, etc. */
}

### Regras do Jogo e Narrativa

1.  **Rolagem de Dados:**
    - **NUNCA role dados para o jogador, a menos que seja um teste de resistência não solicitado (ex: veneno, medo).**
    - **SEMPRE role os dados para os NPCs e monstros por conta própria.** Para transparência, SEMPRE descreva o resultado da sua rolagem na narração usando o tipo de log \`roll\`. Por exemplo: \`{ "type": "roll", "rollResult": { "description": "O goblin ataca você!", "dice": "1d20", "modifier": 2, "rolls": [15], "total": 17, "success": true, "rollType": "attack" } }\`.
    - **FLUXO DE AÇÃO DE PERÍCIA (MUITO IMPORTANTE):**
        - **REGRA A (Intenção do Jogador):** Se a ação do jogador for uma declaração de intenção de usar uma perícia (ex: "Eu tento usar Atletismo para escalar o muro", "Eu uso Persuasão para convencer o guarda"), você DEVE primeiro avaliar se a ação é possível.
            - Se for possível, sua resposta DEVE conter **apenas** o campo \`playerRollRequest\`, solicitando a rolagem apropriada. NÃO narre o resultado ainda.
            - Se for impossível, sua resposta DEVE conter uma \`logEntry\` do tipo "narration" explicando o porquê, e novas \`actionOptions\`. NÃO solicite uma rolagem.
        - **REGRA B (Resultado da Rolagem do Jogador):** Se a ação do jogador contiver o resultado de uma rolagem (ex: "O resultado da minha rolagem de Atletismo foi 18"), você DEVE usar esse número para determinar o resultado da ação, descrevê-lo vividamente no \`logEntries\`, e então continuar a história com novas \`actionOptions\`. NÃO peça uma nova rolagem para a mesma ação.

2.  **Narração (\`logEntries\`):**
    - Use \`type: 'narration'\` para descrever o ambiente, eventos e as ações de NPCs.
    - **Sempre narre explicitamente o dano sofrido pelo jogador ou a cura recebida.**
    - Use \`type: 'system'\` para mensagens do jogo (ex: "Você ganhou 25 XP.", "Novo item adicionado: Espada Longa").
    - Use \`type: 'combat'\` para mensagens diretas de combate que não são narração (ex: "O ataque do goblin erra!", "Sua vez de agir.").
    - Use \`type: 'insight'\` para pensamentos do personagem ou intuições fornecidas pelo Mestre (ex: "Você sente que o mercador está escondendo algo.").
    - Use \`type: 'roll'\` para descrever o resultado de uma rolagem de dados que VOCÊ fez por um NPC.

3.  **Opções de Ação (\`actionOptions\`):**
    - Sempre forneça de 2 a 4 opções de ação claras e relevantes para guiar o jogador.

4.  **Atualizações do Personagem (\`updatedCharacter\`):**
    - **CRÍTICO:** Retorne apenas os campos que mudaram. Se os HP do jogador mudaram de 10 para 5, retorne \`{"hp": {"current": 5}}\`. Nunca retorne o objeto de personagem inteiro.

5.  **Recursos Multimídia:**
    - **Geração de Imagem (\`imagePrompt\`):** Ocasionalmente, para uma cena importante (introdução de um local, um NPC chave, um monstro épico), forneça um prompt de imagem detalhado em inglês. Use com moderação.
`;


const createPrompt = (input: GameMasterFlowInput) => {
    const { character, playerAction, gameLog } = input;
    
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2);

    const promptText = `### Estado Atual do Personagem (JSON)
${characterContext}

### Últimos Eventos do Jogo (JSON)
${logContext}
---
A ação do jogador é: "${playerAction}"

Com base no estado atual do personagem e no histórico, continue a aventura.`;
    return promptText;
}

export const getGameUpdate = async (input: GameMasterFlowInput, modelName: string, generationConfig: GenerationConfig, apiKey: string): Promise<GameMasterResponse | null> => {
    if (!apiKey) {
      throw new Error("Chave de API do Google não configurada. Por favor, adicione sua chave nas configurações.");
    }
    const genAI = getGenAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: {
            role: "model",
            parts: [{ text: systemInstruction }],
        },
    });

    const attemptGeneration = async (retry: boolean = false): Promise<GameMasterResponse | null> => {
        try {
            let prompt = createPrompt(input);
            if (retry) {
                prompt += "\n\nSua resposta anterior não era um objeto JSON válido. Por favor, corrija o formato e forneça uma resposta estritamente no formato JSON solicitado, sem nenhum texto ou marcador extra."
            }

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    ...generationConfig,
                    responseMimeType: "application/json",
                }
            });

            const response = result.response;
            const jsonText = response.text();
            console.log(`[geminiService (${modelName})] Resposta da IA (Tentativa ${retry ? 2 : 1}):`, jsonText); 

            // Validar e analisar o JSON
            try {
                const responseData = JSON.parse(jsonText);
                
                // Adaptador para compatibilidade com versões anteriores
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
                    return await attemptGeneration(true); // Tenta novamente uma vez
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
        const testModel = genAI.getGenerativeModel({ model: modelName });
        const prompt = "Você é o Mestre de um jogo de RPG de texto. Um jogador pergunta 'Mestre, você está aí?'. Responda de forma concisa e temática, em português do Brasil, confirmando que você está presente e pronto. Exemplo: 'Sim, estou aqui. O que você faz?'";
        
        const result = await testModel.generateContent({
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

    
