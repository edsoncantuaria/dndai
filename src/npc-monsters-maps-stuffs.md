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
  - **Campos Principais**: `title`, `status` ('active', 'completed', 'failed'), `objectives` (uma lista de tarefas claras).
  - **Relação**: Será vinculada a uma entidade `Relationship`, mostrando qual NPC deu a missão.

- **`JournalEntry` (Locais/Diário)**:
  - **Função**: Representará cada local, ponto de interesse ou masmorra descoberta.
  - **Campos Principais**: `name`, `region`, `summary` (descrição gerada pela IA), `looted` (se o local já foi saqueado).
  - **Estrutura em Árvore**: Usará uma relação de "closure-table" para criar uma hierarquia, permitindo que locais (ex: "A Cripta Esquecida") existam dentro de outros locais (ex: "Floresta dos Sussurros").

### 2.2. Atualizações na Lógica da IA (`prompt5e.ts`)

O prompt do Mestre de Jogo será aprimorado com novas diretrizes:

- **Obrigação de Persistir**: A IA será instruída a, sempre que criar um NPC importante, um monstro único ou um local notável, incluí-lo em uma estrutura específica na sua resposta JSON (`updatedCharacter.relationships`, `updatedCharacter.journal`).
- **Gerenciamento de Missões**: A IA deve criar e atualizar missões na entidade `Quest`. Ao dar uma missão, deve definir `status: 'active'` e listar os `objectives`. Ao reconhecer a conclusão de um objetivo, deve atualizar a lista ou marcar a missão como `'completed'`.
- **Consulta de Estado**: Ao iniciar uma narração, a IA receberá o estado atual dos NPCs e locais conhecidos (ex: "Lembre-se, o ferreiro de Phandalin, Barthen, é amigável com o jogador (afinidade: 25) e a 'Caverna do Eco da Onda' já foi saqueada.").
- **Diretrizes de Escalonamento**: A IA será instruída a criar novos desafios (NPCs hostis e monstros) com um nível de poder (CR) apropriado ao nível atual do personagem do jogador.

### 2.3. Fluxo de Jogo Atualizado

1.  **Ação do Jogador**: O jogador interage com o mundo (ex: "Eu entro na taverna e falo com o taverneiro").
2.  **Processamento (Backend)**: O `narrarService` carrega o personagem, seu diário e seus relacionamentos do banco de dados.
3.  **Contexto para a IA**: Todos esses dados (personagem, locais conhecidos, NPCs encontrados) são enviados para a IA junto com a ação do jogador.
4.  **Resposta Criativa da IA**: A IA, agora ciente do estado do mundo, cria a narração. Se um novo NPC ("Daran Edermath") for introduzido, a IA o incluirá no `updatedCharacter.relationships` com status "neutro".
5.  **Persistência (Backend)**: O `narrarService` recebe a resposta e salva as novas entradas de diário ou relacionamentos no banco de dados, vinculadas ao personagem da sessão.
6.  **Atualização da UI**: O frontend recebe o estado atualizado e exibe os novos locais e NPCs nas abas de "Diário" e "Relacionamentos".

## 3. Aprofundando o Conceito de "Mundo Vivo"

Com a base arquitetônica definida, podemos expandir a visão para mecânicas mais complexas que aprofundam a imersão:

- **Facções e Reputação Global**: Além de relacionamentos individuais, o personagem terá uma reputação com facções (ex: "A Aliança dos Lordes", "A Guilda dos Ladrões de Phandalin"). Ações que agradam ou desagradam uma facção ajustarão essa reputação, afetando preços de lojas, disponibilidade de missões e a hostilidade de NPCs membros daquela facção.
- **Estado do Mundo e Eventos Dinâmicos**: O mundo reagirá às ações do jogador de forma macro. Derrotar o líder de um bando de orcs pode reduzir os ataques nas estradas por um tempo. Ignorar uma praga em uma fazenda pode fazer com que a comida se torne escassa e cara na cidade vizinha. Esses estados (`"orc_threat": "low"`, `"food_supply": "scarce"`) serão salvos e enviados à IA para contextualizar a narração.
- **Ciclo de Vida de NPCs e Monstros**: Os NPCs poderão ter rotinas (na taverna à noite, na forja de dia) e os monstros genéricos (goblins, lobos) poderão reaparecer (respawn) em suas áreas após um tempo, mantendo o mundo desafiador. Monstros únicos derrotados, no entanto, permanecem mortos.
- **Inventário e Economia dos NPCs**: Para criar um mundo mais realista, NPCs importantes (como mercadores e ferreiros) terão seu próprio inventário persistente. Se os jogadores comprarem todas as poções de um alquimista, ele ficará sem estoque até que possa criar ou adquirir mais (o que pode, por si só, gerar uma nova missão).

## 4. Fases da Implementação

-   **[✅ Concluído] Fase 1: Fundação do Banco de Dados**:
    *   Definir e criar as entidades `Relationship`, `Quest` e `JournalEntry` no TypeORM.
    *   Estabelecer as relações entre elas e a entidade `Character`.

-   **[✅ Concluído] Fase 2: Integração com a IA**:
    *   Atualizar o prompt em `prompt5e.ts` com as novas regras de criação e persistência de entidades.
    *   Modificar os schemas de entrada (`GameMasterFlowInputSchema`) e saída (`GameMasterResponseSchema`) para incluir os novos dados de `journal` e `relationships`.

-   **[✅ Concluído] Fase 3: Exibição no Frontend**:
    *   Implementar os componentes `NewJournal.tsx` e `NewRelationships.tsx` para exibir os dados de forma clara e organizada.
    *   Garantir que a UI seja atualizada em tempo real quando novas informações forem recebidas do backend.

-   **[ ] Fase 4: Mecânicas Avançadas**:
    *   **[✅ Concluído]** Aprimorar a IA para consultar e referenciar de forma proativa o estado dos NPCs e locais em suas narrações (ex: "Você reencontra Barthen, o ferreiro, que ainda parece grato por você ter salvo sua filha.").
    *   **[⬜️ A Fazer]** Implementar a lógica para monstros únicos vs. genéricos (respawn).
    *   **[⬜️ A Fazer]** Desenvolver o sistema de mapa interativo baseado nos dados de `JournalEntry`.

Este documento servirá como um guia vivo, sendo atualizado à medida que cada fase for concluída, nos aproximando de um mundo de RPG digital verdadeiramente dinâmico e persistente.
