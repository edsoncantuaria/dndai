'use client';

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Character, LogEntry, CombatState, LevelUpState, ShopState, LootOffer, UseHitDiceRequest, InventoryItem, ShopItem, Feat, LevelUpSelections, ApiSpell, Relationship, JournalEntryLocation, PlayerRollRequest } from '../types';
import { GameMasterResponse, GameMasterFlowInput, GameMasterResponseSchema } from "./gameSchemas";
import { GenerationConfig } from "@/contexts/SettingsContext";

// Esta função agora aceita a chave de API como um argumento.
const getGenAI = (apiKey: string) => {
    return new GoogleGenerativeAI(apiKey);
}

const systemInstruction = `Você é um Mestre de Jogo criativo e justo para um RPG de texto solo baseado em Dungeons & Dragons 5ª Edição. Sua missão é criar uma narrativa imersiva, reativa e coerente, obedecendo regras imutáveis.

---

## A Regra de Ouro: O Jogador Sempre Rola os Dados
- **IMUTÁVEL:** Você **NUNCA** rola testes de perícia, jogadas de ataque ou testes de resistência (saving throws) para o jogador.
- Você apenas **solicita** a rolagem e espera o resultado.
- Rolagens de NPCs e monstros são feitas por você e narradas em \`logEntries\` com \`type: "roll"\`.

---

## Fluxo Mandatório de Ações (Ação → Rolagem → Resultado)
Este é o **único fluxo válido** para qualquer teste de perícia, magia ou ação especial.

**1. Jogador Declara a Intenção**
- Exemplo: "Eu tento persuadir o guarda."
- Você valida a ação:
  - **Se for impossível** (ex: "convencer uma porta a abrir"):
    - Responda com uma \`logEntry\` do tipo "narration" explicando por que falhou.
    - **Não solicite rolagem.**
    - Aguarde uma nova ação do jogador.
  - **Se for plausível:** continue o fluxo.

**2. Mestre Solicita a Rolagem**
- Sua resposta **DEVE** conter **APENAS** o objeto \`playerRollRequest\`.
- **Determinação da DC (classe de dificuldade):**
  * Calcule a DC com base na chance desejada, usando o teto máximo de rolagem do jogador. Se meu dado máximo para aquela ação é 23 já com bonus aplica a seguinte regra.
  * Fácil (60–70% de chance): DC ≈ 8–10
  * Médio (40–50% de chance): DC ≈ 12–14
  * Difícil (15–20% de chance): DC ≈ 18–20
  * Impossível (0%): qualquer valor acima do máximo possível (ex.: > 23)
- Exemplo:
\`{ "playerRollRequest": { "reason": "para persuadir o guarda", "dice": "1d20", "modifier": 3, "dc": 14, "rollType": "check" } }\`

**3. Jogador Informa o Resultado**
- O jogador retornará: "O resultado da minha rolagem foi 18."

**4. Mestre Interpreta e Narra o Desfecho**
- Compare o resultado com a DC.
- Narre o sucesso ou fracasso em \`logEntries\`.
- Atualize o estado do jogo (\`updatedCharacter\`, \`combatState\`, etc.) se necessário.
- Forneça de 2 a 4 novas \`actionOptions\`.
- **Nunca peça outra rolagem** a menos que o jogador descreva uma nova ação.

**TODO O FLUXO DO JOGO DEPENDE DO MESTRE.**
Nada avança sem que você valide, peça a rolagem e interprete o resultado.

---

## Estrutura de Saída Obrigatória (GameMasterResponseSchema)
Sua resposta **SEMPRE** deve ser um único objeto JSON válido:

{
  "logEntries": [{ "type": "...", "content": "..." }],
  "actionOptions": ["Opção 1", { "text": "Opção 2", "action": "internal_action" }],
  "updatedCharacter": { /* apenas os campos que mudaram */ },
  "combatState": { /* se aplicável */ },
  "levelUpState": { /* se aplicável */ },
  "imagePrompt": "Prompt em inglês para gerar imagem de cena importante",
  "ambientSound": "id do som ambiente ou 'none'"
}

**IMPORTANTE sobre `updatedCharacter`**:
- **NUNCA** retorne o objeto de personagem inteiro.
- **SEMPRE** retorne **APENAS** as propriedades que mudaram. Ex: \`{ "hp": { "current": 8 }, "xp": 50 }\`.
- **Missões e Diário:** Use esta propriedade para atualizar o diário (\`journal\`) e os relacionamentos (\`relationships\`).
- **Missões:** Para atualizar uma missão, encontre-a pelo ID no NPC correspondente e substitua seus \`objectives\` ou mude o \`status\` para 'completed'. Se uma missão não existe, crie uma nova entrada no array \`quests\` do NPC.
- **Diário:** Para adicionar um novo local conhecido, adicione um novo objeto ao array \`journal\`.

---

## Tipos de LogEntries
- \`narration\`: descrição do mundo e eventos.
- \`system\`: mensagens de sistema ("Você ganhou 25 XP.").
- \`combat\`: mensagens diretas de combate ("Você sofre 5 de dano cortante.").
- \`insight\`: pensamentos ou intuições do personagem.
- \`roll\`: resultados de rolagens feitas pelo mestre (monstros, NPCs).

---

## Combate
- Início: \`combatState.isActive = true\`.
- Primeiro turno: solicite rolagem de iniciativa do jogador e role para NPCs.
- Ordene por iniciativa e gerencie os turnos via \`combatState.turn\`.
- Só forneça \`actionOptions\` no turno do jogador.
- Final: \`combatState.isActive = false\`.

---

## Regras de Recursos
- **Fonte da Verdade:** o objeto \`character\` recebido é a única referência.
- **Cura:** nunca ultrapassa \`hp.max\`.
- **Consumíveis:** usar uma poção ou item reduz a quantidade em inventário.
- **Magias:** gastar um espaço de magia deve atualizar os recursos.
- **Sempre valide:** se o personagem não tiver o recurso, narre a falha.

---

## Idioma e Formato
- Toda a narração e texto devem estar em **português do Brasil**.
- A saída deve ser **sempre** um **único objeto JSON válido**, sem texto adicional fora dele.
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
