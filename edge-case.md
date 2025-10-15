# Guia Mestre de Funcionamento e Testes - Crônicas de Aventuras

Este documento serve como a fonte da verdade para o funcionamento esperado do sistema "Crônicas de Aventuras". Ele detalha cada fluxo, desde a autenticação até o gameplay, e estabelece os critérios para testes de homologação (aceitação).

---

## 1. Fluxo de Autenticação e Configuração

Esta seção descreve a jornada do usuário desde a primeira visita até estar pronto para jogar.

### 1.1. Registro de Novo Usuário

-   **Funcionamento:** Um novo usuário acessa a página inicial e vê o formulário de autenticação. Ele clica em "Registre-se".
-   **Componentes Envolvidos:** `AuthForm.tsx`, `RegisterForm.tsx`.
-   **Ações do Usuário:**
    1.  Preenche nome de usuário, email, senha e confirmação de senha.
    2.  Clica no botão "Registrar".
-   **Fluxo do Sistema:**
    1.  `RegisterForm` chama a função `register` do `AuthContext`.
    2.  `AuthContext` valida se as senhas coincidem. Se não, exibe um toast de erro.
    3.  Chama `authService.registerUser`, que envia uma requisição `POST /api/auth/register` para o backend.
    4.  O `authController` no backend valida os dados com `RegisterSchema`. Se inválido, retorna erro 400.
    5.  O `authService` do backend verifica se o email/usuário já existe. Se sim, retorna erro 409.
    6.  A senha é hasheada com bcrypt e um novo `User` é criado e salvo no banco, com as configurações padrão (`defaultSettings`).
    7.  O backend retorna uma mensagem de sucesso.
-   **Comportamento Esperado:**
    -   Após o registro bem-sucedido, um toast de sucesso aparece.
    -   O usuário **não** é logado automaticamente. Ele permanece na tela de autenticação para fazer o login.
-   **Teste de Homologação:**
    -   [ ] Criar um novo usuário com sucesso.
    -   [ ] Tentar registrar com um email já existente e verificar se a mensagem de erro é exibida.
    -   [ ] Tentar registrar com senhas que não coincidem e verificar o erro.

### 1.2. Login de Usuário

-   **Funcionamento:** O usuário preenche email e senha e clica em "Entrar".
-   **Fluxo do Sistema:**
    1.  `LoginForm` chama a função `login` do `AuthContext`.
    2.  `AuthContext` chama `authService.loginUser`, enviando uma requisição `POST /api/auth/login`.
    3.  O `authService` do backend encontra o usuário pelo email, compara a senha hasheada com `bcrypt.compare`.
    4.  Se as credenciais estiverem corretas, gera um token JWT válido por 7 dias e o retorna junto com os dados do usuário.
    5.  O `AuthContext` no frontend recebe os dados, salva o token no `localStorage`, atualiza o estado `user` e `isLicenseActive` e carrega as configurações do usuário (`loadSettings`).
-   **Comportamento Esperado:**
    -   Se o login for bem-sucedido, o usuário avança para a próxima tela (Ativação de Licença ou Chave de API).
    -   Se as credenciais forem inválidas, um toast de erro é exibido.
-   **Teste de Homologação:**
    -   [ ] Fazer login com credenciais válidas.
    -   [ ] Tentar fazer login com senha incorreta e verificar o erro.

### 1.3. Ativação de Licença

-   **Funcionamento:** Se o usuário logado não tiver uma licença ativa (`isLicenseActive` é `false`), a tela `LicenseActivationForm.tsx` é exibida.
-   **Fluxo do Sistema:**
    1.  Usuário insere a chave de licença e clica em "Ativar".
    2.  `activateLicense` do `AuthContext` é chamado, que envia uma requisição `POST /api/licenses/activate`.
    3.  O `licenseService` do backend valida a chave, verifica se ela não foi usada e a associa ao `userId`.
    4.  Se bem-sucedido, o `AuthContext` atualiza `isLicenseActive` para `true`.
-   **Comportamento Esperado:**
    -   Com uma chave válida, o usuário avança para a tela de inserção da chave de API.
    -   Com uma chave inválida ou já usada, um toast de erro é exibido.
-   **Teste de Homologação:**
    -   [ ] Ativar uma licença com uma chave válida.
    -   [ ] Tentar ativar com uma chave inválida e verificar a mensagem de erro.

### 1.4. Configuração da Chave de API

-   **Funcionamento:** Se a licença estiver ativa mas a `apiKey` no `SettingsContext` estiver vazia, a tela `ApiKeyForm.tsx` é exibida.
-   **Fluxo do Sistema:**
    1.  Usuário insere sua chave da Google AI e clica em "Salvar e Jogar".
    2.  `saveApiKey` do `AuthContext` é chamado.
    3.  A função simplesmente chama `setApiKey` do `SettingsContext`.
    4.  O `SettingsContext` possui um `useEffect` que, ao detectar uma mudança na `apiKey` (ou qualquer outra configuração), salva automaticamente o objeto de configurações completo no banco de dados via `PUT /api/users/me/settings`.
-   **Comportamento Esperado:**
    -   Após inserir a chave, o `hasApiKey` no `AuthContext` se torna `true` e o `GameContainer` é renderizado.
-   **Teste de Homologação:**
    -   [ ] Inserir uma chave de API e verificar se o menu principal do jogo é exibido.
    -   [ ] Fechar e reabrir o navegador e verificar se o login é automático e o jogo carrega (sem pedir a chave novamente).

---

## 2. Gerenciamento de Sessão e Personagem

Esta seção descreve a navegação pelo menu principal e o início de uma aventura.

### 2.1. Menu Principal (`GameContainer.tsx`)

-   **Funcionamento:** É a tela central que gerencia qual "estágio" do jogo está ativo (`main_menu`, `session_list`, `character_vault`, `playing`).
-   **Comportamento Esperado:**
    -   Exibe as opções "Continuar Aventura", "Nova Jornada" e "Oficina Homebrew".
    -   O botão "Configurações" abre o `SettingsModal`.
    -   A música do menu toca se `playMenuMusic` estiver ativado.
-   **Teste de Homologação:**
    -   [ ] Verificar se todos os botões de navegação levam para as telas corretas (`session_list`, `character_vault`, `homebrew_store`).
    -   [ ] Abrir e fechar as configurações e verificar se as opções são salvas.

### 2.2. Iniciar uma Nova Aventura (`character_vault`)

-   **Funcionamento:** O usuário clica em "Nova Jornada", é levado para o "Cofre de Heróis".
-   **Fluxo do Sistema:**
    1.  O `GameContainer` busca a lista de personagens do usuário via `GET /api/characters`.
    2.  O usuário pode clicar em "Criar Novo Herói" (indo para o `CharacterCreation.tsx`) ou em "Iniciar Nova Aventura" em um personagem existente.
    3.  Ao clicar em "Iniciar", a função `handleNewGameFromVault` é chamada.
    4.  Ela envia uma requisição `POST /api/sessoes` com o nome da aventura e o `characterId`.
    5.  O backend cria uma nova `SessaoIA` no banco de dados, associada ao usuário e ao personagem.
    6.  O frontend recebe a nova sessão e chama `loadGameSession` com o novo `sessionId`.
-   **Comportamento Esperado:**
    -   A lista de personagens do usuário é exibida corretamente.
    -   Ao iniciar uma nova aventura, a tela de jogo carrega e o prompt inicial "A aventura começa..." é processado.
-   **Teste de Homologação:**
    -   [ ] Criar um personagem e verificar se ele aparece no cofre.
    -   [ ] Iniciar uma nova aventura a partir de um personagem existente e verificar se o jogo começa corretamente.

### 2.3. Continuar uma Aventura (`session_list`)

-   **Funcionamento:** O usuário clica em "Continuar Aventura", é levado para a lista de sessões salvas.
-   **Fluxo do Sistema:**
    1.  O `GameContainer` busca as sessões via `GET /api/sessoes`.
    2.  O usuário clica no botão "Play" de uma sessão.
    3.  A função `handleContinueGame` chama `loadGameSession` com o `sessionId` selecionado.
    4.  `loadGameSession` chama `GET /api/sessoes/:id` para obter todos os detalhes da sessão, incluindo os logs.
    5.  O frontend processa os logs:
        -   Renderiza imediatamente todos os logs que **não** são do tipo `state`.
        -   Encontra o **último** log do tipo `state`, faz o `JSON.parse` de seu conteúdo (que é a `GameMasterResponse` completa) e usa a função `handleApiResponse` para restaurar o estado da UI (opções de ação, estado de combate, etc.), **sem adicionar os logs novamente para evitar duplicação**.
-   **Comportamento Esperado:**
    -   A aventura é restaurada exatamente no ponto em que foi deixada, com o histórico de log completo e as ações corretas disponíveis.
    -   Não deve haver logs duplicados na tela.
-   **Teste de Homologação:**
    -   [ ] Jogar alguns turnos, sair para o menu e continuar a sessão, verificando se o estado é restaurado perfeitamente.

---

## 3. Loop Central de Gameplay

Este é o fluxo mais crítico, descrito em detalhes no `game-flow-overview.md`.

-   **Funcionamento:** O jogador executa uma ação (digita, clica em um botão), e o sistema responde.
-   **Fluxo do Sistema:**
    1.  **UI (`ActionOptions.tsx`):** A ação do jogador é capturada e enviada para `processPlayerAction` no `newUseGameState.ts`.
    2.  **Orquestrador (`newUseGameState.ts`):**
        -   Adiciona a ação do jogador ao log local (se não for uma ação interna).
        -   Chama o `gameService.processPlayerAction`.
    3.  **Serviço (`gameService.ts`):** Envia a requisição `POST /api/narrar/:sessionId` para o backend, incluindo a ação, a `apiKey` e o `combatState` atual.
    4.  **Backend (`narrarService.ts`):**
        -   Carrega os dados completos do personagem e da sessão.
        -   Constrói um `GameMasterFlowInput` otimizado.
        -   Chama o `aiService.getGameUpdate`.
    5.  **Serviço de IA (`aiService.ts`):**
        -   Monta o prompt com base nas regras (`regrasBase.ts`, etc.).
        -   Faz a chamada para a API do Gemini.
        -   **BLINDAGEM:** Recebe a resposta e a valida rigorosamente contra o `GameMasterResponseSchema`. Tenta uma correção se o JSON for inválido. Lança um erro se a validação final falhar.
    6.  **Backend (`narrarService.ts`):**
        -   **BLINDAGEM:** Recebe a resposta validada. **Saneia** o `logEntries` para garantir que são todos objetos válidos e bem-formatados.
        -   Salva os logs no banco de dados (um log de `state` com a resposta completa e logs individuais para cada narração).
        -   Atualiza as entidades do personagem no banco (`persistCharacterUpdates`).
        -   Retorna a `GameMasterResponse` saneada para o frontend.
    7.  **Orquestrador (`newUseGameState.ts`):**
        -   Recebe a resposta e chama `handleApiResponse`.
        -   `handleApiResponse` distribui as informações para os hooks corretos (`logState.addLogEntries`, `characterState.updateCharacter`, `interactionState.setRequest`, etc.).
-   **Comportamento Esperado:**
    -   A UI é atualizada de forma reativa com a nova narração, novas opções de ação e quaisquer mudanças no estado do personagem ou do combate.
    -   O fluxo é estável e não quebra, mesmo com respostas imperfeitas da IA.
-   **Teste de Homologação:**
    -   [ ] Realizar 10 ações consecutivas no jogo e verificar se não há erros no console ou quebras na UI.
    -   [ ] Verificar se as atualizações de HP, inventário e XP refletem corretamente na ficha do personagem.

### 3.1. Fluxo de Rolagem de Dados

-   **Funcionamento:** O fluxo de gameplay é interceptado quando uma rolagem é necessária.
-   **Fluxo do Sistema:**
    1.  A IA responde com um objeto `playerRollRequest` preenchido.
    2.  O `narrarService` do backend detecta isso e retorna a resposta **imediatamente**, sem processar mais nada.
    3.  O `newUseGameState` no frontend recebe a resposta e chama `interactionState.setRequest({ type: 'roll', ... })`.
    4.  O `useEffect` no `GameScreen.tsx` detecta a mudança no `playerRollRequest` e define `showDiceModal` como `true`.
    5.  O `DiceRollModal.tsx` é renderizado. Sua lógica interna garante que a biblioteca `DiceBox` seja inicializada antes de habilitar o botão de rolar.
    6.  O usuário clica, o dado 3D rola, e a função `onRoll` do modal é chamada com o resultado.
    7.  Isso aciona `handleRollResult` no `newUseGameState`, que formata a ação (ex: "O resultado da minha rolagem de Furtividade foi 19.") e reinicia o ciclo de `processPlayerAction`.
-   **Comportamento Esperado:**
    -   O modal de dados aparece de forma suave e instantânea.
    -   O dado 3D é sempre visível e funcional.
    -   O resultado da rolagem é capturado corretamente e enviado de volta para a IA para determinar o desfecho.
-   **Teste de Homologação:**
    -   [ ] Tentar usar uma perícia (via texto e via ficha) e verificar se o modal de dados 3D aparece e funciona.
    -   [ ] Realizar um ataque em combate e verificar se o modal de ataque e, em seguida, o de dano, aparecem corretamente.

---

## 4. Sistema Homebrew

-   **Funcionamento:** Permite ao usuário criar, gerenciar e usar conteúdo personalizado.
-   **Fluxo do Sistema (Criação):**
    1.  Usuário navega para a "Oficina Homebrew" (`HomebrewStore.tsx`).
    2.  Clica em "Criar Novo".
    3.  Seleciona um tipo de conteúdo e preenche o formulário correspondente (`RaceForm`, `ClassForm`, etc.).
    4.  Ao submeter, o `HomebrewCreator.tsx` chama `HomebrewService.createHomebrewContent`, enviando uma requisição `POST /api/homebrew`.
    5.  O backend salva o novo conteúdo no banco de dados.
-   **Fluxo do Sistema (Instalação):**
    1.  Na `HomebrewStore`, o usuário clica em "Instalar" em um item.
    2.  A função `handleInstallToggle` chama `GameService.updateSessionHomebrew`, enviando uma requisição `PATCH /api/sessoes/:id/homebrew`.
    3.  O backend atualiza a coluna `homebrewContentIds` na tabela `sessoes_ia`.
-   **Comportamento Esperado:**
    -   O conteúdo criado aparece na lista "Minhas Criações".
    -   O conteúdo instalado fica disponível na sessão de jogo ativa (ex: uma nova raça aparece no criador de personagem, uma nova magia é compreendida pela IA).
-   **Teste de Homologação:**
    -   [ ] Criar uma nova raça simples e verificar se ela aparece na lista de criação de personagem.
    -   [ ] Criar uma nova magia, instalá-la e pedir para a IA que o personagem a use. Verificar se a IA reconhece a magia.

Este documento estabelece a base para todos os testes. À medida que novos recursos forem adicionados, este arquivo deve ser atualizado.