# Guia Mestre de Funcionamento e Validação - Crônicas de Aventuras

Este documento é a fonte da verdade para o estado atual do sistema "Crônicas de Aventuras". Ele detalha o fluxo de dados, a arquitetura implementada, os problemas crônicos que foram resolvidos e os critérios para testes de homologação (aceitação).

---

## Objetivo da Refatoração

O objetivo central das mudanças foi transformar um sistema instável e imprevisível em uma plataforma **robusta, resiliente e defensiva**. A filosofia mudou de "tentar consertar" respostas erráticas da IA para "validar rigorosamente e falhar de forma controlada", garantindo uma experiência de usuário estável e um código mais limpo.

---

## 1. Problema Crítico: Falhas na Rolagem de Dados e Inconsistências

### 1.1. Sintomas do Problema
- O modal de rolagem de dados 3D não aparecia de forma consistente.
- A biblioteca `DiceBox` falhava ao carregar, travando a rolagem.
- Clicar em perícias na ficha ou em opções de ação nem sempre acionava o fluxo de rolagem corretamente.
- A IA, por vezes, respondia com um texto "Role um dado" em vez de iniciar o fluxo de rolagem formal.

### 1.2. Causa Raiz
- **Condição de Corrida (Race Condition):** O componente `DiceRollModal.tsx` tentava usar a biblioteca `DiceBox` antes dela estar 100% inicializada.
- **Lógica de Frontend Descentralizada:** Diferentes ações (clique na ficha, `actionOption`) usavam caminhos distintos para iniciar uma rolagem.
- **Ambiguidade no Backend:** O prompt da IA não era explícito o suficiente sobre **como** solicitar uma rolagem, permitindo respostas em formato de texto.

### 1.3. Solução Implementada e Validação

#### **Backend (Blindagem da IA)**
- **O que foi feito:** O prompt em `/home/user/studio/backend/src/game/prompts/regrasCombate.ts` foi reescrito. Agora, a regra é explícita: se a ação do jogador contém nomes de perícias ou verbos de intenção, a IA **DEVE** responder com o objeto `playerRollRequest`. Ela é proibida de sugerir rolagens em `actionOptions`.
- **Como Testar:**
  - [ ] Digite "Tento usar Furtividade para passar pelos guardas." A resposta **deve** ser o modal de dados, não uma opção de texto.
  - [ ] Digite "Quero rolar Intimidação." A resposta **deve** ser o modal de dados.

#### **Frontend (Unificação e Correção)**
- **O que foi feito:**
    1.  Em `/home/user/studio/src/hooks/useInteractionManager.ts`, a função `handleSkillCheck` foi criada para centralizar todos os pedidos de perícia.
    2.  Clicar em "Usar" em uma perícia (`SkillItem.tsx`) agora chama `handleSkillCheck`.
    3.  A IA é instruída a retornar `actionOptions` com um campo `"skill"`, que também chama `handleSkillCheck`.
    4.  O componente `/home/user/studio/src/components/DiceRollModal.tsx` foi reescrito. Ele agora usa `useEffect` para garantir que a `DiceBox` seja inicializada apenas uma vez e desabilita o botão "Rolar" com um loader até que a biblioteca esteja pronta.
- **Como Testar:**
  - [ ] Abra a ficha de personagem, clique em "Usar" na perícia "Atletismo". O modal de perícia deve aparecer, seguido pelo modal de dados 3D.
  - [ ] Verifique se o botão "Rolar" no modal de dados exibe "Carregando Dados..." e fica desabilitado por um instante antes de se tornar clicável.
  - [ ] Realize um ataque em combate. O modal de dados **deve** aparecer para a rolagem de ataque, e em seguida, para a rolagem de dano, sempre com o dado 3D funcional.

---

## 2. Problema Crítico: Corrupção de Dados e Erros de Validação Zod

### 2.1. Sintomas do Problema
- O log de narração exibia texto JSON bruto (ex: `{"type":"narration", "content": "..."}`).
- A aplicação quebrava (tela branca ou erro) após certas ações.
- Logs do backend mostravam `ZodError` com centenas de erros `Expected object, received null`.
- Campos como `worldState` e `combatState` se tornavam `null`, quebrando a validação do `GameMasterResponseSchema`.

### 2.2. Causa Raiz
- **Resposta Inválida da IA:** A IA, em certas situações, retornava um `logEntries` como um array de `null`s, ou um `content` de log como um JSON stringificado.
- **Saneamento Insuficiente no Backend:** O `narrarService.ts` não estava preparado para esse tipo de corrupção e repassava os dados inválidos para o frontend.
- **Erro de Renderização no Frontend:** O componente `NewNarrativeLog.tsx` não fazia o "parse" de `content` que era uma string JSON, renderizando-a diretamente.

### 2.3. Solução Implementada e Validação

#### **Backend (Tolerância Zero com Dados Corrompidos)**
- **O que foi feito:**
    1.  Em `/home/user/studio/backend/src/schemas/gameSchemas.ts`, o `GameMasterResponseSchema` foi ajustado. Campos como `worldState` e `combatState` agora são `optional()`, mas se presentes, não podem ser `null`.
    2.  Em `/home/user/studio/backend/src/services/narrarService.ts`, a função `sanitizeLogEntries` foi reescrita para **descartar** qualquer entrada de log que não seja um objeto bem-formado.
    3.  Na mesma função, foi adicionado um **fallback inteligente**: se a IA retornar `worldState` como `null`, o serviço irá preenchê-lo com o último estado válido do personagem no banco de dados antes de enviar ao frontend.
- **Como Testar:**
  - [ ] Execute a ação que causava o erro anteriormente ("Examinar o conteúdo da Dungeoneer's Pack"). O jogo **não deve** mais quebrar. A narração deve continuar normalmente, e os logs do backend não devem mostrar o `ZodError`.

#### **Frontend (Renderização Correta)**
- **O que foi feito:** O componente `/home/user/studio/src/components/NewNarrativeLog.tsx` foi corrigido. A sub-rotina `NarrationEntry` agora verifica se o `content` é uma string JSON. Se for, ele faz o `JSON.parse` e extrai o texto correto antes de renderizar.
- **Como Testar:**
  - [ ] Verifique o log do jogo após várias ações. **Nenhum texto JSON bruto deve aparecer** na tela de narração.

---

## 3. Melhorias de Arquitetura e UX

- **Refatoração dos Hooks (`useGameState`):**
  - **O que foi feito:** O hook monolítico `newUseGameState.ts` foi quebrado em hooks menores com responsabilidades únicas:
    - `useCharacterState.ts`: Gerencia o estado do `character`.
    - `useGameLog.ts`: Gerencia a lista de `log`.
    - `useInteractionManager.ts`: Gerencia todos os estados de interação (modais, opções de ação, combate).
  - `newUseGameState.ts` agora serve como um orquestrador, simplificando o fluxo de dados.
  - **Validação:** O sistema continua funcionando como antes, mas o código está mais limpo e organizado, facilitando futuras manutenções.

- **Carregamento do Menu Principal:**
  - **O que foi feito:** O carregador inicial no `GameContainer.tsx` foi removido. A tela de autenticação já cobre o carregamento inicial, e o menu principal agora aparece instantaneamente enquanto os dados das sessões são buscados silenciosamente em segundo plano.
  - **Validação:**
    - [ ] Após o login, verifique se o menu principal é a primeira tela exibida, sem um "pisca-pisca" de carregamento.

- **Correção de Duplicação de Logs ao Carregar Jogo:**
  - **O que foi feito:** Em `newUseGameState.ts`, a função `handleApiResponse` agora aceita um parâmetro `isRestoring`. Ao carregar uma sessão (`loadGameSession`), ela é chamada com `true`, fazendo com que a função restaure a UI (`actionOptions`, `combatState`) a partir do último log de estado, mas **pule** a renderização das `logEntries` contidas nesse estado, evitando duplicatas.
  - **Validação:**
    - [ ] Jogue alguns turnos.
    - [ ] Saia para o menu principal.
    - [ ] Clique em "Continuar Aventura" e carregue a sessão.
    - [ ] Verifique se o log da aventura aparece **sem nenhuma entrada duplicada** no final.

Este documento agora reflete o estado funcional e esperado do sistema após a refatoração completa.