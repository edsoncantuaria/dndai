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
- **Saneamento Insuficiente no Backend:** O `narrarService.ts` não estava preparado para esse tipo de corrupção.
- **Confiança na Auto-Correção:** O sistema dependia de uma chamada de "re-try" para a IA, tornando a exceção a regra.

### 2.3. Solução Implementada e Validação

#### **Backend (Defesa em Profundidade)**
- **O que foi feito:**
    1.  **Prompt Explícito (`regrasBase.ts`):** O prompt agora proíbe explicitamente a IA de retornar `null` em campos de objeto, instruindo-a a usar `[]` ou `{}`.
    2.  **Validação Robusta (`gameSchemas.ts`):** Os schemas Zod foram ajustados. Campos como `worldState` e `combatState` são `optional()`, mas se presentes, **não podem ser `null`**.
    3.  **Saneamento Agressivo (`narrarService.ts`):** A função `sanitizeLogEntries` agora descarta qualquer entrada de log que não seja um objeto bem-formado. Adicionalmente, se campos críticos como `worldState` forem `null`, o serviço os substitui pelo último estado válido do banco de dados antes de enviar ao frontend. A dependência da auto-correção foi removida como fluxo padrão.
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
    2.  **Modal de Testes (`DiceTestModal.tsx`):** Um novo componente foi criado para servir como um painel de controle de testes.
    3.  **Teste de Rolagem de Dados:** A primeira ferramenta implementada permite configurar (quantidade, tipo de dado, modificador, vantagem/desvantagem) e executar o `DiceRollModal`, testando a rolagem 3D e a lógica de cálculo de forma isolada.
- **Como Testar:**
  - [ ] No menu principal, clique no botão "Testes do Sistema".
  - [ ] O modal "Configurar Teste de Dados" deve aparecer.
  - [ ] Configure uma rolagem (ex: 2d8 + 3) e clique em "Rolar o Dado".
  - [ ] Verifique se o modal de rolagem 3D (`DiceRollModal`) aparece e executa a rolagem corretamente. O resultado deve ser logado no console do navegador.

---

## 4. Melhorias de Arquitetura e UX

- **Refatoração dos Hooks (`useGameState`):**
  - **O que foi feito:** O hook monolítico `newUseGameState.ts` foi quebrado em hooks menores com responsabilidades únicas (`useCharacterState`, `useGameLog`, `useInteractionManager`). `newUseGameState.ts` agora serve como um orquestrador.
- **Carregamento do Menu Principal:**
  - **O que foi feito:** O carregador inicial no `GameContainer.tsx` foi removido.
- **Correção de Duplicação de Logs:**
  - **O que foi feito:** A função `handleApiResponse` em `newUseGameState.ts` agora aceita um parâmetro `isRestoring`, que impede a re-renderização de logs ao carregar uma sessão salva.

Este documento agora reflete o estado funcional e esperado do sistema após a refatoração completa.