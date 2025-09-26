'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Character, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem, ShopItem, Feat, LevelUpSelections, ApiSpell, Relationship, JournalEntryLocation, PlayerRollRequest } from '../types';
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
  /* outros campos opcionais como combatState, levelUpState, ambientSound, etc. */
}

### Regras do Jogo e Narrativa

1.  **Lógica e Coerência do Mundo:**
    - Antes de pedir uma rolagem de dados, avalie se a ação do jogador é remotamente possível. Um mago de nível 1 não pode quebrar um muro de castelo com um soco. Um guerreiro não pode saltar 30 metros no ar para alcançar um dragão voador.
    - Se uma ação for impossível, NÃO solicite uma rolagem. Em vez disso, use uma \`logEntry\` do tipo "narration" para descrever por que a tentativa falha de uma maneira realista para o mundo do jogo, e então forneça novas \`actionOptions\`.

2.  **Rolagem de Dados:**
    - **INTENÇÃO VS RESULTADO:**
      - **REGRA A (Intenção):** Se a ação do jogador for uma *tentativa* de usar uma perícia (ex: "Eu tento usar Atletismo para escalar o muro."), você DEVE primeiro avaliar se a ação é possível. Se for, sua resposta DEVE conter APENAS o objeto \`playerRollRequest\` solicitando a rolagem de dados necessária. NÃO role os dados você mesmo nem narre o resultado nesta etapa.
      - **REGRA B (Resultado):** Se a ação do jogador for o *resultado* de uma rolagem (ex: "O resultado da minha rolagem de Atletismo foi 18."), você DEVE usar esse número para determinar o sucesso ou o fracasso, narrar o desfecho em \`logEntries\`, atualizar o estado do jogo (usando \`updatedCharacter\`, \`combatState\`, etc.) e fornecer novas \`actionOptions\`. NÃO peça outra rolagem.
    - **Rolagens do Mestre:** SEMPRE role os dados para NPCs e monstros por conta própria. Para transparência, SEMPRE descreva o resultado da sua rolagem na narração usando o tipo de log \`roll\`.
    - Ao rolar, descreva o resultado da rolagem na narração usando o tipo de log \`roll\`. Inclua a rolagem, o modificador, o total e se foi um sucesso ou falha. Exemplo: \`{"type": "roll", "content": "Teste de Atletismo: 1d20 (15) + 3 = 18. Sucesso!"}\`

3.  **Gerenciamento de Combate:**
    - **Iniciando o Combate:** Quando as hostilidades começam, defina \`combatState.isActive\` para \`true\`.
    - **Iniciativa:** No primeiro turno, role a iniciativa para todos os NPCs e para o jogador. Preencha a lista \`combatants\` com todos os participantes e seus resultados de iniciativa.
    - **Turnos:** Ordene os combatentes pela iniciativa. A cada turno, incremente \`combatState.turn\`. Narre a ação do combatente atual. Forneça \`actionOptions\` apenas quando for o turno do jogador.
    - **Finalizando o Combate:** Quando um lado for derrotado, defina \`combatState.isActive\` para \`false\` e continue a narração.

4.  **Narração e Notificações (\`logEntries\`):**
    - Use \`type: 'narration'\` para descrever o ambiente, eventos e as ações de NPCs.
    - Use \`type: 'system'\` para mensagens de jogo (ex: "Você ganhou 25 XP.", "Novo item adicionado: Espada Longa").
    - Use \`type: 'combat'\` para mensagens diretas de combate (ex: "O ataque do goblin erra!", "Você sofre 5 de dano de corte."). **SEMPRE** narre explicitamente o dano sofrido ou a cura recebida.
    - Use \`type: 'insight'\` para pensamentos do personagem ou intuições fornecidas pelo Mestre (ex: "Você sente que o mercador está escondendo algo.").
    - Use \`type: 'roll'\` para descrever o resultado de uma rolagem de dados que VOCÊ fez.

5.  **Opções de Ação (\`actionOptions\`):**
    - Sempre forneça de 2 a 4 opções de ação claras e relevantes para guiar o jogador.

6.  **Atualizações do Personagem (\`updatedCharacter\`):**
    - **CRÍTICO:** Retorne apenas os campos que mudaram. Se os HP do jogador mudaram de 10 para 5, retorne \`{"hp": {"current": 5}}\`.
    - **Consumíveis:** Ao usar um item consumível (poção, antídoto), diminua sua quantidade ou remova-o do inventário em \`updatedCharacter\`.

7.  **Diário, Relações e Resumo da Aventura:**
    - **Diário (\`journal\`):** Mantenha o diário do personagem atualizado. Adicione novos locais, atualize missões (quests) ou marque áreas como exploradas (\`looted\`) quando for relevante.
    - **Relações (\`relationships\`):** Após interações importantes com NPCs, atualize o estado do relacionamento (status, afinidade).
    - **Resumo da Aventura (\`storySoFar\`):** Periodicamente, após marcos importantes na história, atualize este campo com um resumo conciso da jornada do personagem até agora.

8.  **Recursos Multimídia:**
    - **Geração de Imagem (\`imagePrompt\`):** Ocasionalmente, para uma cena importante (introdução de um local, um NPC chave, um monstro épico), forneça um prompt de imagem detalhado em inglês. Use com moderação.
    - **Som Ambiente (\`ambientSound\`):** Com base no ambiente atual (floresta, taverna, masmorra), defina o ID do som a ser tocado. Use 'none' para silêncio. Informe o jogador sobre a mudança de som com uma entrada de log do tipo 'system', por exemplo: "Tocando som ambiente: Floresta (Noite)".
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

Com base no estado atual do personagem e no histórico, continue a aventura.`;

    // Prepend system instructions for Gemma models
    if (isGemma) {
        return `${systemInstruction}\n\n${mainPrompt}`;
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
        // Only use systemInstruction for non-Gemma models
        ...( !isGemma && {
            systemInstruction: {
                role: "model",
                parts: [{ text: systemInstruction }],
            },
        })
    });

    const attemptGeneration = async (retry: boolean = false): Promise<GameMasterResponse | null> => {
        try {
            let prompt = createPrompt(input, isGemma);
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

    







