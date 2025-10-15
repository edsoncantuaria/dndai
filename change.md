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

### 2.2. Causa Raiz e Filosofia de Correção
- **Resposta Inválida da IA:** A IA, em certas situações, retornava `logEntries` como um array de `null`s, ou um `content` de log como um JSON stringificado.
- **Saneamento Insuficiente no Backend:** O `narrarService.ts` não estava preparado para esse tipo de corrupção. A dependência da chamada de "re-try" para a IA tornava a exceção a regra, em vez de ser um mecanismo de segurança para casos raros. A auto-correção não deve ser o fluxo padrão.

### 2.3. Solução Implementada e Validação

#### **Backend (Defesa em Profundidade)**
- **O que foi feito:**
    1.  **Prompt Explícito (`regrasBase.ts`):** O prompt foi fortalecido com uma instrução explícita que proíbe a IA de retornar `null` em campos de objeto (como `worldState`), instruindo-a a usar `[]` ou `{}`.
    2.  **Validação Robusta (`gameSchemas.ts`):** Os schemas Zod foram ajustados para que campos como `worldState` e `combatState` sejam `optional()`, mas se presentes, **não podem ser `null`**. Isso impõe um contrato de dados mais rígido.
    3.  **Saneamento Agressivo (`narrarService.ts`):** A função `sanitizeLogEntries` agora descarta agressivamente qualquer entrada de log que não seja um objeto bem-formado. Mais importante, se campos críticos como `worldState` forem `null`, o serviço os substitui pelo último estado válido do banco de dados antes de enviar ao frontend. A dependência da auto-correção foi removida como fluxo padrão.
- **Como Testar:**
  - [ ] Execute a ação que causava o erro anteriormente ("Examinar o conteúdo da Dungeoneer's Pack"). O jogo **não deve** mais quebrar. A narração deve continuar normalmente, e os logs do backend não devem mostrar o `ZodError`.

#### **Frontend (Renderização Correta)**
- **O que foi feito:** O componente `/home/user/studio/src/components/NewNarrativeLog.tsx` foi corrigido. A sub-rotina `NarrationEntry` agora verifica se o `content` é uma string JSON. Se for, ele faz o `JSON.parse` e extrai o texto correto antes de renderizar.
- **Como Testar:**
  - [ ] Verifique o log do jogo após várias ações. **Nenhum texto JSON bruto deve aparecer** na tela de narração.

---

## 3. Ferramentas de Teste e Depuração

- **Objetivo:** Criar uma UI dedicada para testar subsistemas críticos de forma isolada, acelerando a depuração e a validação de novas funcionalidades.
- **O que foi feito:**
    1.  **Novo Layout de Menu (`GameContainer.tsx`):** Foram adicionados botões de "Configurações" e "Testes do Sistema" no rodapé do menu principal para acesso fácil.
    2.  **Modal de Testes (`SystemTestModal.tsx`):**
        - O antigo `DiceTestModal` foi renomeado e expandido para servir como um painel de controle de testes.
        - **Teste de Rolagem de Dados:** Permite configurar e executar o `DiceRollModal` de forma isolada.
        - **Teste de Estado de Loja e Combate:** Botões dedicados acionam `triggerTestShop` e `triggerTestCombat` no `useInteractionManager`, que populam os estados com dados de teste e abrem os respectivos modais/componentes (`ShopModal`, `NewCombatTracker`).
        - **Teste de Interação:** Adicionada uma nova seção para simular diretamente ações do jogador, como usar perícias ou enviar um prompt customizado para a IA.
    3.  **Lógica de Estado (`useInteractionManager.ts`):** Novas funções `triggerTestShop`, `triggerTestCombat` e `triggerTestSkillCheck` foram criadas para injetar estados de teste na aplicação.

### 3.1. Casos de Teste com o Painel de Depuração

Use o botão "Testes do Sistema" no menu principal para validar os seguintes subsistemas:

-   **[ ] Teste de Rolagem de Dados 3D (Isolado):**
    -   [ ] Abra o painel e configure uma rolagem de `1d20` com modificador `+5`. Clique em "Rolar o Dado".
    -   **Esperado:** O modal de rolagem (`DiceRollModal`) deve aparecer. O botão "Rolar" deve estar inicialmente desabilitado com o texto "Carregando Dados...". Após um breve momento, ele deve se tornar clicável.
    -   [ ] Clique para rolar.
    -   **Esperado:** A animação do dado 3D deve ser executada. O resultado final (rolagem + modificador) deve ser exibido corretamente. O botão "Continuar" deve aparecer.
    -   [ ] Configure uma rolagem com vantagem (`1d20`, `+3`, Vantagem marcada).
    -   **Esperado:** A animação deve rolar dois dados 3D na tela. O cálculo deve usar o maior dos dois valores.

-   **[ ] Teste de Estado da Loja:**
    -   [ ] Abra o painel de testes e clique em "Testar UI da Loja".
    -   **Esperado:** O modal de loja (`ShopModal`) deve aparecer imediatamente.
    -   [ ] Verifique o conteúdo do modal.
    -   **Esperado:** O modal deve estar populado com os itens de exemplo definidos em `triggerTestShop`.
    -   [ ] Feche o modal. A aplicação deve retornar ao menu principal.

-   **[ ] Teste de Estado de Combate:**
    -   [ ] Abra o painel de testes e clique em "Testar UI de Combate".
    -   **Esperado:** O rastreador de combate (`NewCombatTracker`) deve aparecer na tela principal.
    -   [ ] Verifique o conteúdo do rastreador.
    -   **Esperado:** O componente deve exibir os combatentes de exemplo definidos em `triggerTestCombat`. O estado de HP, CA e iniciativa deve corresponder aos dados de teste.

-   **[✅] Teste de Fluxo de Perícia:**
    -   [ ] Inicie uma aventura (o teste de perícia requer uma sessão ativa).
    -   [ ] Abra o painel de testes e na seção "Testar Interações do Jogo", selecione a perícia "Intimidação".
    -   [ ] Clique em "Testar".
    -   **Esperado:** O modal de testes fecha e o modal de teste de perícia (`SkillCheckModal`) aparece, perguntando como você deseja usar "Intimidação".
    -   [ ] Descreva uma ação (ex: "para assustar o taverneiro") e clique em "Confirmar".
    -   **Esperado:** O modal de rolagem de dados 3D (`DiceRollModal`) deve aparecer, solicitando a rolagem para "usar Intimidação". O fluxo continua normalmente a partir daí.

-   **[✅] Teste de Ação Direta da IA:**
    -   [ ] Inicie uma aventura.
    -   [ ] Abra o painel de testes e na seção "Testar Interações do Jogo", digite um comando no campo de texto, como "Eu abro a porta à minha frente".
    -   [ ] Clique em "Enviar".
    -   **Esperado:** O modal fecha e o jogo processa a ação como se você a tivesse digitado na caixa de ação principal. A narração da IA correspondente deve aparecer no log.

---

## 4. Melhorias de Arquitetura e UX

- **Refatoração dos Hooks (`useGameState`):**
  - **O que foi feito:** O hook monolítico `newUseGameState.ts` foi quebrado em hooks menores com responsabilidades únicas (`useCharacterState`, `useGameLog`, `useInteractionManager`). `newUseGameState.ts` agora serve como um orquestrador.
- **Carregamento do Menu Principal:**
  - **O que foi feito:** O carregador inicial no `GameContainer.tsx` foi removido para uma transição mais suave.
- **Correção de Duplicação de Logs:**
  - **O que foi feito:** A função `handleApiResponse` em `newUseGameState.ts` agora aceita um parâmetro `isRestoring`, que impede a re-renderização de logs ao carregar uma sessão salva, consertando o bug de logs duplicados.

Este documento agora reflete o estado funcional e esperado do sistema após a refatoração completa.
