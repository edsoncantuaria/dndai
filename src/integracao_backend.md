* **Objetivo:** mover toda a lógica do jogo para o backend, fazer o backend conversar com o Genkit/Google Gemini usando a API key criptografada do usuário, e enviar atualizações em tempo real ao frontend por WebSocket.

Sempre Atualizar integracao_backend.md com tudo que foi feito. Colocar testes e esperar retornar que todos os testes estão funcionando!

Um backend, por mais funcional que seja, é inútil se o frontend não estiver preparado para se comunicar com ele. É crucial documentar o estado de ambos os lados para termos uma visão clara do progresso.

* **Componentes principais:**

  1. Backend HTTP (Express) — API REST (autenticação, gerenciamento de usuário, endpoints administrativos).
  2. WebSocket Server (no mesmo processo Express ou ligado via servidor HTTP) — transporte tempo-real do jogo.
  3. Serviço de Jogo (orquestrador) — carrega/salva GameState, chama o serviço de IA e emite updates.
  4. Flow Server da IA (Genkit) — expõe flows (ex.: `gameMasterFlow`) para o serviço de jogo consumir (pode ser parte do backend ou process separated).
  5. Banco de dados MySQL (TypeORM) — persistência de Users, Characters, GameSessions, etc.
  6. Redis — cache distribuído para `activeGameStates`, locks e pub/sub se for escalar múltiplas instâncias.
  7. Storage de segredos: `.env` + vault eventual (opcional).
  8. Criptografia utilitária para armazenar/descriptografar a google_api_key com seu crypto.

# Estrutura de diretórios sugerida

```
/backend
  /src
    /controllers       (Lógica de requisição/resposta)
    /services          (Lógica de negócios, interação com IA e BD)
    /routes            (Definição dos endpoints da API)
    /models            (Schemas do TypeORM e associações)
    /middlewares       (Autenticação, tratamento de erros)
    /database          (Configuração da fonte de dados - data-source)
    server.ts          (Ponto de entrada do servidor)
  /tests               (Testes unitários e de integração)
  ...
```

# Migração incremental — passos concretos (sem estimativas de tempo)

Vou descrever um caminho seguro em *fases*, do mínimo invasivo ao completo.

## Fase 0 — Reconstrução e Fundação (Concluído)

*   **[X] Escolha do ORM**: Após análise e dificuldades com a configuração do Sequelize com TypeScript, optamos por utilizar o **TypeORM**, devido à sua forte tipagem, suporte nativo a TypeScript com decoradores e uma comunidade robusta.
*   **[X] Estruturar o novo Backend**: Criar a estrutura de pastas com Express, TypeScript e TypeORM.
*   **[X] Documentação da API**: A especificação da API será mantida em um único arquivo **`openapi.yaml`** na raiz do projeto para simplificar o gerenciamento e a integração com ferramentas de visualização.
*   **[X] Configurar TypeORM e Modelos**: Definir os modelos `User`, `Character`, `GameSession`, `Log`, e `LicenseKey` usando decoradores do TypeORM. Configurar o `AppDataSource` para conexão com o banco de dados.
*   **[X] Implementar Middlewares Essenciais**: Criar `authMiddleware` para validação de JWT e `errorMiddleware` para tratamento de erros global.
*   **[X] Configurar Rotas e Controllers Iniciais**: Criar a estrutura para as rotas da API (`auth`, `users`, `characters`, etc.) e seus respectivos controllers.
*   **[X] Integrar Serviço de IA (Genkit)**: Isolar a lógica do Genkit em `iaService.ts`, garantindo que ele seja chamado pelos controllers, e implementar o streaming de respostas corretamente.

## Fase 1 — Autenticação, Licença e API de Usuário (Concluído)

*   **[X] Implementar Endpoints de Autenticação**:
    *   `POST /api/auth/register`: Para registro de novos usuários.
    *   `POST /api/auth/login`: Para autenticação e obtenção de token JWT.
*   **[X] Implementar Endpoints de Licença**:
    *   `POST /api/licenses/activate`: Ativa uma chave de licença para o usuário autenticado.
    *   `GET /api/licenses/status`: Verifica o status da licença do usuário.
*   **[X] Implementar Endpoint de Usuário**:
    *   `GET /api/users/me`: Retorna os dados do usuário autenticado.

### Testes da Fase 1: API de Autenticação e Licença

Esta seção descreve os testes manuais (usando Postman, Insomnia ou `curl`) para garantir que a Fase 1 foi implementada corretamente.

**Pré-requisito para Teste de Licença**: Para testar a ativação, adicione manualmente uma chave de licença ao seu banco de dados:
```sql
INSERT INTO license_keys (`key`) VALUES ('CHAVE-TESTE-01');
```

## Fase 2 - Refatoração do Backend de IA (Concluído)

*   **[X] Objetivo**: Reconstruir a lógica de interação com a IA no backend, permitindo múltiplas sessões de jogo paralelas, cada uma com sua própria chave de API e contexto de Genkit.
*   **[X] Documento de Planejamento**: Todos os detalhes e o passo a passo desta fase estão no novo arquivo mestre: **[backend_refactor.md](./backend_refactor.md)**.
*   **[X] Status Atual**: Concluído. A API de narração está funcionando.

## Fase 3 — Plataforma de Personagens e Dados Persistentes (Concluído)

*   **[X] Objetivo**: Desacoplar os dados do personagem do JSON monolítico, criando uma estrutura de banco de dados relacional e otimizada para performance e escalabilidade.
*   **[X] Backend**:
    *   **[X]** Criadas as entidades `Character`, `CharacterAttributes`, `CharacterItem`, `CharacterProficiency`, `CharacterSpell`, `JournalEntry`, `Relationship`, e `Quest`.
    *   **[X]** Adicionada a relação entre `SessaoIA` e `Character`.
    *   **[X]** Criados os endpoints CRUD (`/api/characters`) para gerenciar o "cofre" de personagens.
    *   **[X]** Atualizado o endpoint de criação de sessão (`/api/sessoes`) para aceitar um `characterId` e verificar sessões existentes.
    *   **[X]** Implementado *soft delete* em todas as entidades.
    *   **[X]** Adicionados campos (`storySoFar`, `factionReputation`, `worldState`) à entidade `Character` para permitir uma narrativa persistente e um mundo reativo.
    *   **[X]** Refatorado o controller de criação de personagem (`createCharacter`) para salvar os dados de forma transacional nas novas tabelas.
*   **[X] Frontend**:
    *   **[X]** Refatorado o `GameContainer` para exibir uma lista de sessões de jogo existentes.
    *   **[X]** Criada uma nova tela de "Seleção de Personagem" (o cofre).
    *   **[X]** Modificado o fluxo de criação de personagem para apenas salvar o herói no cofre.
    *   **[X]** Atualizado o `gameService.ts` e `newUseGameState.ts` para interagir com os novos endpoints `/api/characters` e gerenciar o novo fluxo.

## Fase 4 — Integração da Lógica de Jogo e Otimização (Concluído)

*   **[X] Objetivo**: Unificar a lógica do jogo com a nova estrutura de banco de dados e otimizar a comunicação com a IA.
*   **[X] Backend**:
    *   **[X]** Refatorado o `gameSchemas.ts` para ser a fonte da verdade da estrutura de dados do jogo.
    *   **[X]** Atualizado o `prompt5e.ts` para entender e responder com base nos novos schemas otimizados.
    *   **[X]** Refatorado o `narrarController.ts` para usar o prompt atualizado, construir resumos de personagem e de log, e implementar a persistência de estado após a resposta da IA.
*   **[X] Frontend**:
    *   **[X]** Atualizado `types.ts` para corresponder aos novos schemas do backend.
    *   **[X]** Ajustado `newUseGameState.ts` para enviar e receber os novos objetos de estado de jogo.
    *   **[X]** Realizadas correções nos componentes da interface (`CombatTracker`, `CharacterSheet`, etc.) para renderizar corretamente com base no novo estado.

## Fase 5 — WebSocket e Modo Multiplayer (Futuro)

*   **[ ] Implementar WebSocket Server**: Adicionar um servidor WebSocket ao processo do Express para comunicação em tempo real.
*   **[ ] Implementar Lógica de Sala**: Criar mecanismos para que os jogadores criem, entrem e saiam de salas de jogo.
*   **[ ] Sincronizar Estado do Jogo**: O servidor transmitirá todas as atualizações de estado (narração, ações de jogadores, mudanças em combate) para todos os clientes na mesma sala.
*   **[ ] Adaptar o Fluxo de Turnos**: Modificar a interação com a IA para gerenciar múltiplos jogadores, possivelmente com um sistema de turnos.

# Checklist final (executável)

* [X] Criar repo backend TS e configurar lint/tsconfig.
* [X] Configurar TypeORM e entidades (incluindo `LicenseKey`, `Character` e sub-entidades).
* [X] Implementar todos os `controllers`.
* [X] Implementar todos os `services`, incluindo `iaService` com cache.
* [X] Implementar `authMiddleware`.
* [X] Configurar todas as rotas da API no `server.ts`.
* [X] Adicionar campos de persistência (`storySoFar`, `reputation`) à entidade `Character`.
* [X] Unificar a lógica de jogo com os schemas de dados e o prompt da IA.
* [X] Otimizar a carga enviada para a IA (resumos de personagem e log).
* [X] Integrar completamente o frontend com a nova arquitetura de backend.
* [ ] Adicionar Redis e implement redisService.
* [ ] Implementar WebSocket server e integração com gameService + Redis locks.
* [ ] Adicionar monitoramento e alertas.
* [ ] Planejar rollout progressivo com feature-flag.

---

## **Plano de Testes - Validação Completa do Sistema**

Esta seção descreve os testes manuais a serem executados após uma limpeza completa do banco de dados para garantir a integridade de todo o fluxo.

### **Fase 1: Configuração Inicial e Autenticação**

*   **Teste 1.1: Registro de Novo Usuário**
    *   **Ação:** Na tela inicial, clique em "Registre-se". Preencha um nome de usuário, e-mail e senha.
    *   **Validação:** Você deve ver uma notificação de sucesso ("Registro Concluído!") e ser levado de volta para a tela de login.

*   **Teste 1.2: Login**
    *   **Ação:** Use as credenciais que você acabou de criar para fazer o login.
    *   **Validação:** O login deve ser bem-sucedido e você deve ser levado para a tela de "Ativação de Licença".

*   **Teste 1.3: Ativação de Licença**
    *   **Ação:** Insira uma chave de licença válida (você precisará adicionar uma ao seu banco de dados manualmente primeiro).
    *   **Validação:** A licença deve ser ativada com sucesso, e você será levado para a tela de "Configurar Chave de API".

*   **Teste 1.4: Configuração da Chave de API**
    *   **Ação:** Insira sua chave de API do Google AI Studio.
    *   **Validação:** A chave deve ser salva, e você será levado para a tela principal de "Sessões de Jogo", que estará vazia.

### **Fase 2: Gerenciamento de Personagens (Cofre de Heróis)**

*   **Teste 2.1: Acessar o Cofre e Criar um Personagem**
    *   **Ação:** Na tela de "Sessões de Jogo", clique no botão "Escolher Herói". Em seguida, clique em "Criar Novo Herói".
    *   **Validação:** O assistente de criação de personagem deve abrir.

*   **Teste 2.2: Processo de Criação Completo**
    *   **Ação:** Passe por todas as 7 etapas da criação de personagem, fazendo suas escolhas. Na última etapa, dê um nome ao seu herói e clique em "Iniciar Aventura" e confirme.
    *   **Validação:** Você deve ser redirecionado para a tela do "Cofre de Heróis", e seu novo personagem deve aparecer na lista.

*   **Teste 2.3: Deletar um Personagem**
    *   **Ação:** Crie um segundo personagem. No cofre, clique no ícone da lixeira ao lado deste segundo personagem. Confirme a exclusão no modal.
    *   **Validação:** O personagem deve ser removido da lista no "Cofre de Heróis".

### **Fase 3: Gerenciamento de Sessões de Jogo**

*   **Teste 3.1: Iniciar uma Nova Sessão**
    *   **Ação:** Na tela "Cofre de Heróis", clique no botão de "Play" ao lado do seu personagem principal.
    *   **Validação:** O jogo deve carregar a tela de jogo (`GameScreen`), e o Mestre de Jogo deve iniciar com a primeira narração.

*   **Teste 3.2: Sair e Verificar a Persistência da Sessão**
    *   **Ação:** No cabeçalho do jogo, clique no botão de sair e escolha "Voltar ao Menu".
    *   **Validação:** Você deve voltar à tela de "Sessões de Jogo". A aventura que você acabou de iniciar deve estar listada, mostrando o nome e os detalhes do herói.

*   **Teste 3.3: Continuar uma Sessão Existente**
    *   **Ação:** Na lista de sessões, clique no botão "Play" ao lado da aventura que você criou.
    *   **Validação:** O jogo deve carregar exatamente de onde você parou, com todo o histórico de log preservado.

*   **Teste 3.4: Deletar uma Sessão**
    *   **Ação:** Volte ao menu principal. Clique no ícone de lixeira ao lado da sessão e confirme a exclusão.
    *   **Validação:** A sessão deve ser removida da lista.

### **Fase 4: Validação do Fluxo de Jogo Principal**

*   **Teste 4.1: Rolagem de Perícia**
    *   **Ação:** Em uma nova sessão, digite uma ação que exija um teste, como "Eu tento arrombar a porta" ou "Eu procuro por armadilhas".
    *   **Validação:** O modal de rolagem de dados deve aparecer. A IA deve solicitar a rolagem e esperar o resultado antes de continuar.

*   **Teste 4.2: Início de Combate**
    *   **Ação:** Digite uma ação agressiva, como "Eu ataco o guarda da cidade".
    *   **Validação:** O `CombatTracker` deve aparecer. A IA deve narrar o início do combate e pedir uma rolagem de iniciativa.

*   **Teste 4.3: Turno de Combate (Jogador)**
    *   **Ação:** No seu turno, escolha atacar um inimigo.
    *   **Validação:** A IA deve solicitar uma rolagem de ataque. Após a rolagem, ela deve pedir uma rolagem de dano. O HP do inimigo no `CombatTracker` deve diminuir de acordo com o dano causado.

*   **Teste 4.4: Turno de Combate (IA)**
    *   **Ação:** Deixe um inimigo atacar. Se não for seu turno, use o botão "Próximo Turno".
    *   **Validação:** A IA deve narrar a ação do inimigo, incluindo a rolagem de ataque e dano (explicado no `systemLog`). Seu HP na ficha deve diminuir se o ataque for bem-sucedido.

*   **Teste 4.5: Atualização de Mundo e Personagem**
    *   **Ação:** Encontre um item (a IA pode oferecer loot após um combate) e aceite-o. Converse com um NPC importante.
    *   **Validação:** O item deve aparecer no seu inventário (`Inventory.tsx`). A informação sobre o NPC deve aparecer na aba de Relacionamentos (`NewRelationships.tsx`). O campo `storySoFar` na sua ficha deve ser atualizado com um resumo dos eventos.