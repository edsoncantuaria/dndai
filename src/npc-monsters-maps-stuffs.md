# TASK-2: Mundo Vivo - NPCs, Monstros e Locais Persistentes

Este documento descreve a arquitetura e os objetivos para a próxima grande fase do "Crônicas de Aventuras": transformar o mundo do jogo em um ecossistema persistente e reativo.

## 1. Visão Geral

O objetivo é ir além de encontros gerados no momento e criar um mundo com memória. NPCs, monstros únicos e locais descobertos se tornarão entidades persistentes no banco de dados, vinculadas a uma sessão de jogo específica. Suas existências e estados (vivo, morto, amigável, hostil) serão mantidos, criando uma narrativa contínua e com consequências reais.

- **NPCs Memoráveis**: Todo NPC importante criado pela IA terá sua própria "ficha de personagem", com estatísticas, inventário padrão e um histórico de interações. Sua morte em uma campanha será permanente *naquela campanha*.
- **Monstros Únicos vs. Genéricos**: O sistema diferenciará "goblins" (recursos genéricos e renováveis) de "Klarg, o Chefe Bugbear" (uma entidade única que, uma vez derrotada, permanece derrotada).
- **Mundo Explorável**: Locais gerados pela IA, desde uma taverna movimentada até uma masmorra esquecida, serão salvos com seus pontos de interesse, interligando-se para formar regiões coerentes. Isso pavimenta o caminho para um futuro sistema de mapa interativo.
- **Escalonamento Dinâmico**: O mundo se adaptará ao jogador. Novos NPCs e desafios terão um nível de poder correspondente ao do personagem, garantindo uma experiência sempre desafiadora, mas justa.

## 2. Arquitetura Proposta

### 2.1. Novas Entidades no Banco de Dados (Backend)

Para suportar essa visão, novas tabelas (entidades TypeORM) serão criadas:

- **`Relationship` (NPCs)**:
  - **Função**: Representará cada NPC único encontrado pelo jogador.
  - **Campos Principais**: `npcId` (um identificador único gerado pela IA, ex: "gundren_rockseeker"), `name`, `description`, `status` (amigo, hostil), `affinity` (um valor numérico para a relação), e um link para o `Character` principal da sessão.
  - **Ficha de Monstro**: No futuro, esta entidade será expandida para incluir estatísticas de combate completas, tornando cada NPC um combatente em potencial.

- **`Quest` (Missões)**:
  - **Função**: Armazenará as missões dadas pelos NPCs.
  - **Campos Principais**: `title`, `status` (ativa, completa, falha), `objectives` (uma lista de tarefas).
  - **Relação**: Será vinculada a uma entidade `Relationship`, mostrando qual NPC deu a missão.

- **`JournalEntry` (Locais/Diário)**:
  - **Função**: Representará cada local, ponto de interesse ou masmorra descoberta.
  - **Campos Principais**: `name`, `region`, `summary` (descrição gerada pela IA), `looted` (se o local já foi saqueado).
  - **Estrutura em Árvore**: Usará uma relação de "closure-table" para criar uma hierarquia, permitindo que locais (ex: "A Cripta Esquecida") existam dentro de outros locais (ex: "Floresta dos Sussurros").

### 2.2. Atualizações na Lógica da IA (`prompt5e.ts`)

O prompt do Mestre de Jogo será aprimorado com novas diretrizes:

- **Obrigação de Persistir**: A IA será instruída a, sempre que criar um NPC importante, um monstro único ou um local notável, incluí-lo em uma estrutura específica na sua resposta JSON (`updatedCharacter.relationships`, `updatedCharacter.journal`).
- **Consulta de Estado**: Ao iniciar uma narração, a IA receberá o estado atual dos NPCs e locais conhecidos (ex: "Lembre-se, o ferreiro de Phandalin, Barthen, é amigável com o jogador (afinidade: 25) e a 'Caverna do Eco da Onda' já foi saqueada.").
- **Diretrizes de Escalonamento**: A IA será instruída a criar novos desafios (NPCs hostis e monstros) com um nível de poder (CR) apropriado ao nível atual do personagem do jogador.

### 2.3. Fluxo de Jogo Atualizado

1.  **Ação do Jogador**: O jogador interage com o mundo (ex: "Eu entro na taverna e falo com o taverneiro").
2.  **Processamento (Backend)**: O `narrarService` carrega o personagem, seu diário e seus relacionamentos do banco de dados.
3.  **Contexto para a IA**: Todos esses dados (personagem, locais conhecidos, NPCs encontrados) são enviados para a IA junto com a ação do jogador.
4.  **Resposta Criativa da IA**: A IA, agora ciente do estado do mundo, cria a narração. Se um novo NPC ("Daran Edermath") for introduzido, a IA o incluirá no `updatedCharacter.relationships` com status "neutro".
5.  **Persistência (Backend)**: O `narrarService` recebe a resposta e salva as novas entradas de diário ou relacionamentos no banco de dados, vinculadas ao personagem da sessão.
6.  **Atualização da UI**: O frontend recebe o estado atualizado e exibe os novos locais e NPCs nas abas de "Diário" e "Relacionamentos".

## 3. Fases da Implementação

-   **[✅ Concluído] Fase 1: Fundação do Banco de Dados**:
    *   Definir e criar as entidades `Relationship`, `Quest` e `JournalEntry` no TypeORM.
    *   Estabelecer as relações entre elas e a entidade `Character`.

-   **[✅ Concluído] Fase 2: Integração com a IA**:
    *   Atualizar o prompt em `prompt5e.ts` com as novas regras de criação e persistência de entidades.
    *   Modificar os schemas de entrada (`GameMasterFlowInputSchema`) e saída (`GameMasterResponseSchema`) para incluir os novos dados de `journal` e `relationships`.

-   **[✅ Concluído] Fase 3: Exibição no Frontend**:
    *   Criar ou adaptar os componentes `NewJournal.tsx` e `NewRelationships.tsx` para exibir os dados de forma clara e organizada.
    *   Garantir que a UI seja atualizada em tempo real quando novas informações forem recebidas do backend.

-   **[✅ Concluído] Fase 4: Mecânicas Avançadas (Mundo Vivo)**:
    *   **Status:** Concluído.
    *   **[✅ Concluído]** A IA foi aprimorada para consultar e referenciar de forma proativa o estado dos NPCs e locais em suas narrações.
    *   **[✅ Concluído]** A lógica de backend e de IA para diferenciar monstros únicos (gerenciados via `Relationship`) de monstros genéricos (que podem reaparecer) foi implementada. A IA agora consulta o estado persistente dos `Relationships` para evitar o "respawn" de entidades nomeadas e derrotadas.
    *   **[✅ Concluído]** A estrutura de dados de combate (`CombatStateSchema`) e o prompt da IA foram aprimorados para lidar com um gerenciamento de estado mais detalhado, diferenciando monstros e NPCs únicos.

-   **[⬜️ A Fazer] Fase 5: Próximos Passos (Arquitetura Futura)**:
    *   **Tarefa:** Desenvolver o sistema de mapa interativo baseado nos dados de `JournalEntry`.
    *   **Tarefa:** Implementar um sistema de "agência assíncrona" para NPCs e eventos mundiais, aproveitando o tempo de espera do jogador.
    *   **Tarefa:** Implementar e testar o modo multiplayer cooperativo via WebSockets.

## 4. Arquitetura para Agência Assíncrona de NPCs

Esta seção detalha o plano para a **TASK-4**, que visa criar a ilusão de um mundo que evolui continuamente.

### 4.1. Conceito

A ideia central é usar o tempo em que o jogador está aguardando a resposta da IA (o "efeito de digitação") para executar processos de "evolução do mundo" no backend, de forma assíncrona. Isso significa que, enquanto o jogador lê a narração, o servidor pode estar calculando o progresso das rotinas de um NPC, o avanço de um evento mundial ou o movimento de uma facção inimiga.

### 4.2. Implementação no Backend

- **Fila de Tarefas (Job Queue):** O ideal seria usar uma biblioteca de fila de tarefas como BullMQ ou um serviço como o Cloud Tasks.
    1.  Quando uma ação do jogador resulta em uma passagem de tempo significativa (ex: um descanso longo, uma viagem), o `narrarService` não apenas pede a narração à IA, mas também adiciona uma "tarefa de evolução" à fila.
    2.  Essa tarefa conteria o `sessionId` e o tempo decorrido (ex: "8 horas").
- **Workers Assíncronos:** Um ou mais processos "workers" independentes escutariam essa fila.
    1.  Ao receber uma tarefa, o worker carregaria o estado da sessão correspondente.
    2.  Ele faria uma chamada separada para a IA com um prompt específico: *"Passaram-se 8 horas. Com base no estado atual do mundo e dos NPCs, o que mudou? O NPC 'Gundren' avançou em sua jornada? O culto inimigo progrediu em seu plano? Seja breve e objetivo."*
    3.  A resposta da IA seria usada para atualizar o banco de dados (o estado do `Relationship` de Gundren, o avanço de uma `Quest`, etc.).

### 4.3. Implementação no Frontend

- **Notificações em Tempo Real (WebSockets):** O frontend precisaria de uma conexão WebSocket estabelecida com o backend.
    1.  Quando o "worker" do backend conclui uma tarefa de evolução, ele envia uma mensagem via WebSocket para o cliente (ou clientes, no modo multiplayer).
    2.  A mensagem poderia ser algo como: `{ type: 'world_event', message: 'Você recebe um corvo mensageiro com uma nota de Gundren.' }`.
- **UI Reativa:** O frontend receberia essa mensagem e a exibiria de forma não intrusiva.
    1.  Isso poderia ser um "toast" (notificação pop-up), uma nova entrada no log de narração marcada como "Evento", ou um indicador piscando em uma aba relevante (como "Diário").

Esta arquitetura desacopla a narrativa principal da evolução do mundo, permitindo que ambos ocorram de forma semi-independente, criando uma experiência profundamente imersiva e dinâmica.
