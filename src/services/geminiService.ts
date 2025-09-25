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

### Estrutura do JSON de Resposta

{
  "logEntries": [
    {
      "type": "'narration' | 'action' | 'system' | 'combat' | 'insight' | 'roll'",
      "content": "O texto descritivo do que está acontecendo. Esta é a parte principal da sua narração."
    }
  ],
  "actionOptions": ["Opção 1 como string", { "text": "Opção 2 como objeto", "action": "internal_action_2" }],
  "updatedCharacter": {
    /* Inclua APENAS os campos do personagem que mudaram. Exemplos:
    "hp": { "current": 5 },
    "xp": 150,
    "inventory": [ ... ],
    "journal": { ... },
    "relationships": [ ... ]
    */
  },
  "combatState": { /* Preencha se o combate estiver ativo */ },
  "levelUpState": { /* Preencha quando o jogador subir de nível */ },
  "shopState": { /* Preencha quando o jogador entrar em uma loja */ },
  "lootOffer": { /* Preencha para oferecer saques */ },
  "useHitDiceRequest": { /* Preencha para oferecer descanso curto */ },
  "imagePrompt": "Ocasionalmente, um prompt de imagem detalhado (em inglês) para uma cena importante."
}

### Regras do Jogo e Narrativa

1.  **Narração (\`logEntries\`):**
    - Use \`type: 'narration'\` para descrever o ambiente, eventos e as ações de NPCs.
    - Use \`type: 'system'\` para mensagens do jogo (ex: "Você ganhou 25 XP.").
    - Use \`type: 'roll'\` para descrever o resultado de uma rolagem de dados.
    - Seja descritivo e imersivo.

2.  **Opções de Ação (\`actionOptions\`):**
    - Sempre forneça de 2 a 4 opções de ação claras e relevantes para o jogador. Elas guiam a agência do jogador.

3.  **Atualizações do Personagem (\`updatedCharacter\`):**
    - **CRÍTICO:** Retorne apenas os campos que foram alterados. Se os HP do jogador mudaram de 10 para 5, retorne \`{"hp": {"current": 5}}\`. Nunca retorne o objeto de personagem inteiro.
    - Gerencie inventário, experiência (XP), pontos de vida (hp), diário (journal) e relacionamentos (relationships) através deste objeto.

4.  **Recursos Multimídia:**
    - **Geração de Imagem (\`imagePrompt\`):** Ocasionalmente, para uma cena importante (introdução de um local, um NPC chave, um monstro épico), forneça um prompt de imagem detalhado em inglês. Exemplo: "Dungeons and Dragons 5e style: A tiefling man in a dark cloak watches you from across a tavern...". Use com moderação.

5.  **Regras de D&D 5e:**
    - Aplique as regras de combate, testes de perícia e habilidades de forma consistente. Você é responsável por todas as rolagens de dados.
    - Ao conceder experiência (XP), quando \`character.xp\` atingir ou exceder \`character.xpToNextLevel\`, ative o \`levelUpState\` e preencha as \`choices\` para o novo nível.
`;


const createPrompt = (input: GameMasterFlowInput) => {
    const { character, playerAction, gameLog } = input;
    
    const characterContext = JSON.stringify(character, null, 2);
    const logContext = JSON.stringify(gameLog.slice(-15), null, 2);

    return `
### Estado do Personagem (JSON)
${characterContext}

### Últimos Eventos (JSON)
${logContext}
---
A ação do jogador é: "${playerAction}"

Com base no estado atual do personagem e no histórico, continue a aventura.
    `;
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

    try {
        const prompt = createPrompt(input);
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                ...generationConfig,
                responseMimeType: "application/json",
            }
        });

        const response = result.response;
        const jsonText = response.text();
        console.log(`[geminiService (${modelName})] Resposta da IA recebida:`, jsonText); 

        const responseData = JSON.parse(jsonText) as any; // Parse como 'any' para checar a estrutura

        // Adaptador: Checa se a IA enviou 'narration' em vez de 'logEntries'
        if (responseData.narration && typeof responseData.narration === 'string') {
            if (!responseData.logEntries) {
                responseData.logEntries = [];
            }
            // Adiciona a narração ao início do array de logs
            responseData.logEntries.unshift({ type: 'narration', content: responseData.narration });
            delete responseData.narration; // Remove o campo antigo para evitar confusão
        }
        
        return responseData as GameMasterResponse;

    } catch (error: any) {
        console.error(`[geminiService (${modelName})] Erro ao chamar ou processar a resposta da API do Gemini:`, error);
        // Em vez de retornar um objeto de erro, lançamos uma exceção para ser capturada pelo hook.
        throw new Error(`O Mestre está confuso e não pôde continuar. Erro: ${(error as Error).message}`);
    }
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
