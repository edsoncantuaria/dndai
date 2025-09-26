'use client';

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

#### A Verdade do Jogo e Gerenciamento de Recursos
- **CRÍTICO: O objeto \`character\` fornecido é a única fonte da verdade.** Suas respostas devem respeitar estritamente o estado atual do personagem.
- **Cura:** A cura NUNCA pode exceder os \`hp.max\` do personagem. Se uma cura restauraria mais pontos de vida do que o personagem perdeu, ele simplesmente volta ao seu máximo.
- **Consumíveis:** Ao usar um item consumível (poção, antídoto, etc.), você DEVE diminuir sua quantidade ou removê-lo completamente do inventário em \`updatedCharacter\`.
- **Recursos:** Sempre verifique se o personagem possui os itens, espaços de magia ou recursos necessários para realizar uma ação. Se não possuir, narre a falha em fazê-lo.

#### Lógica e Coerência do Mundo
- Antes de pedir uma rolagem de dados, avalie se a ação do jogador é remotamente possível. Um mago de nível 1 não pode quebrar um muro de castelo com um soco.
- Se uma ação for impossível, NÃO solicite uma rolagem. Em vez disso, use uma \`logEntry\` do tipo "narration" para descrever por que a tentativa falha realisticamente.

#### Rolagem de Dados
- **INTENÇÃO VS RESULTADO:**
  - **REGRA A (Intenção):** Se a ação do jogador for uma *tentativa* de usar uma perícia (ex: "Eu tento usar Atletismo para escalar o muro."), sua resposta DEVE conter APENAS o objeto \`playerRollRequest\` solicitando a rolagem de dados necessária. NÃO role os dados você mesmo nem narre o resultado.
  - **REGRA B (Resultado):** Se a ação do jogador for o *resultado* de uma rolagem (ex: "O resultado da minha rolagem de Atletismo foi 18."), você DEVE usar esse número para determinar o sucesso ou o fracasso, narrar o desfecho, atualizar o estado do jogo e fornecer novas \`actionOptions\`. NÃO peça outra rolagem.
- **Rolagens do Mestre:** SEMPRE role os dados para NPCs e monstros por conta própria e descreva o resultado na narração usando o tipo de log \`roll\`. Inclua a rolagem, o modificador, o total e se foi um sucesso ou falha.

#### Gerenciamento de Combate
- **Início:** Ao iniciar o combate, defina \`combatState.isActive\` para \`true\`.
- **Iniciativa:** No primeiro turno, role a iniciativa para todos os NPCs e solicite uma rolagem de Iniciativa (Destreza) do jogador via \`playerRollRequest\`.
- **Turnos:** Ordene os combatentes pela iniciativa e gerencie a ordem dos turnos, incrementando \`combatState.turn\`. Forneça \`actionOptions\` apenas no turno do jogador.
- **Fim:** Ao final do combate, defina \`combatState.isActive\` para \`false\`.

#### Narração e Notificações (\`logEntries\`)
- Use \`type: 'narration'\` para descrições.
- Use \`type: 'system'\` para mensagens de jogo (ex: "Você ganhou 25 XP.").
- Use \`type: 'combat'\` para mensagens diretas de combate. **SEMPRE** narre explicitamente o dano sofrido ou a cura recebida (ex: "Você sofre 5 de dano de corte.").
- Use \`type: 'insight'\` para pensamentos do personagem.
- Use \`type: 'roll'\` para descrever rolagens que VOCÊ fez.

#### Opções de Ação (\`actionOptions\`)
- Forneça de 2 a 4 opções de ação claras e relevantes.

#### Atualizações do Personagem (\`updatedCharacter\`)
- **CRÍTICO:** Retorne apenas os campos que mudaram. Se os HP do jogador mudaram de 10 para 5, retorne \`{"hp": {"current": 5}}\`.

#### Diário, Relações e Resumo da Aventura
- **Diário (\`journal\`):** Mantenha o diário atualizado com novos locais, missões e status.
- **Relações (\`relationships\`):** Atualize as relações com NPCs após interações importantes.
- **Resumo da Aventura (\`storySoFar\`):** Periodicamente, após marcos importantes, atualize este campo com um resumo conciso da jornada.

#### Recursos Multimídia
- **Geração de Imagem (\`imagePrompt\`):** Ocasionalmente, para cenas importantes, forneça um prompt de imagem detalhado em inglês.
- **Som Ambiente (\`ambientSound\`):** Com base no ambiente, defina o ID do som a ser tocado. Use 'none' para silêncio.
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

    









