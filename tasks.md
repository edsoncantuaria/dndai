# Próximas Tarefas e Melhorias para "Crônicas de Aventuras"

Este documento descreve os próximos grandes recursos e melhorias arquitetônicas planejadas para o projeto, com o objetivo de evoluir a plataforma.

**Nota sobre a Estrutura de Diretórios:**
- **Caminho do Frontend:** `/home/user/studio/`
- **Caminho do Backend:** `/home/user/studio/backend`

---

## ✅ TASK-1: Reestruturação da Plataforma Cliente-Servidor (Em Planejamento)

- **Problema:** O frontend atual ainda opera com muitas lógicas do design original (estado gerenciado no cliente, `localStorage`), o que o impede de aproveitar todo o potencial do novo backend (banco de dados persistente, gerenciamento de sessões, personagens reutilizáveis). A interface e o fluxo de dados não refletem a nova arquitetura de servidor.
- **Filosofia Central:** O backend é a única fonte da verdade. O frontend deve ser uma interface reativa e performática que busca e envia dados ao servidor, utilizando o cache de forma inteligente para uma experiência de usuário fluida.
- **Objetivo:** Refatorar completamente a aplicação para alinhar o frontend e o backend, adotando as melhores práticas de arquitetura para criar uma plataforma rápida, estável, imersiva e pronta para futuras expansões.

### Fase 1.1: Fundação da Arquitetura (Backend & Frontend)

*   **[ ] Implementar Validação de Dados com Zod (Backend):**
    *   **Tarefa:** Em cada controller do backend (ex: `characterController.ts`), usar o Zod para criar schemas que validam o `req.body` de todas as requisições `POST` e `PUT`.
    *   **Justificativa:** Garante que dados malformados ou maliciosos nunca cheguem à nossa lógica de negócios ou ao banco de dados, tornando a API mais segura e previsível.

*   **[ ] Criar Camada de Serviço (Service Layer) (Backend):**
    *   **Tarefa:** Criar novos serviços (ex: `characterService.ts`, `sessionService.ts`) na pasta `backend/src/services`. Mover a lógica de banco de dados (TypeORM) e as interações complexas dos controllers para esses serviços.
    *   **Justificativa:** Desacopla a lógica da API (Express) da lógica de negócios. Os controllers se tornam mais simples (apenas validam e chamam serviços), e a lógica principal pode ser reutilizada e testada de forma isolada.

*   **[ ] Adotar Ferramenta de Gerenciamento de Estado do Servidor (Frontend):**
    *   **Tarefa:** Integrar uma biblioteca como `React Query` ou `SWR`. Envolver a aplicação com o provider da biblioteca para gerenciar todas as chamadas de API.
    *   **Justificativa:** Automatiza o cache, a revalidação e a sincronização dos dados do servidor, eliminando a necessidade de gerenciar manualmente estados de `isLoading` e `error` e tornando a UI mais rápida e responsiva.

*   **[ ] Centralizar o Acesso à API (`apiClient.ts`) (Frontend):**
    *   **Tarefa:** Criar um único `apiClient.ts` que exporta uma instância configurada do `axios` ou um wrapper do `fetch`. Todos os serviços (`authService`, `gameService`) usarão este cliente.
    *   **Justificativa:** Centraliza a lógica de API, permitindo a fácil implementação de interceptadores para tratamento de erros (ex: token expirado, redirecionar para login) e adição automática de headers de autenticação.

### Fase 1.2: Reconstrução dos Componentes e Fluxos de UI

*   **[ ] Refatorar Menus e Navegação (`GameContainer`):**
    *   **Tarefa:** A tela principal passará a usar React Query para buscar e exibir a lista de sessões de jogo do usuário (`/api/sessoes`). O `GameContainer` deixará de gerenciar o estado do jogo.
    *   **Justificativa:** Alinha o fluxo inicial com a nova arquitetura, onde o servidor é a fonte da verdade.

*   **[ ] Implementar o "Cofre de Heróis":**
    *   **Tarefa:** Criar uma nova página/rota dedicada (`/characters`) que busca e exibe a lista de personagens do usuário (`/api/characters`). O fluxo de "Nova Aventura" levará para esta tela.
    *   **Justificativa:** Completa a visão de personagens reutilizáveis, uma das principais vantagens do novo backend.

*   **[ ] Adaptar Componentes de Jogo (Ficha, Inventário, etc.):**
    *   **Tarefa:** Modificar `CharacterSheet`, `Inventory`, `NewJournal`, etc., para que eles usem hooks do React Query para buscar seus dados específicos, baseando-se no `characterId` ativo. As ações do usuário (equipar, usar item) se tornarão "mutações" do React Query.
    *   **Justificativa:** Transforma os componentes em visualizadores de dados reativos e independentes, melhorando a performance e a organização.
    
*   **[ ] Componentizar a UI (Frontend):**
    *   **Tarefa:** Dividir componentes grandes como `CharacterSheet` e `NewCharacterCreation` em subcomponentes menores e mais focados (ex: `AttributeDisplay`, `SkillsList`, `Stepper`).
    *   **Justificativa:** Melhora a organização do código, a performance de renderização (com `React.memo`) e a manutenibilidade.

### Fase 1.3: Imersão, Elegância e Completude do Sistema D&D

*   **[ ] Reforçar o Fluxo de Jogo "Mestre Pede, Jogador Rola":**
    *   **Visão (Backend):** Tornar o `prompt5e.ts` extremamente rigoroso. A IA **nunca** deve rolar dados pelo jogador ou presumir resultados. O fluxo `Intenção -> Pedido de Rolagem (com DC claro) -> Resultado -> Consequência` deve ser obrigatório para ataques, perícias e testes de resistência.
    *   **Visão (Frontend):** O `DiceRollModal` deve exibir claramente o alvo (DC) para criar suspense. A agência do jogador sobre os dados é a alma da experiência.

*   **[ ] Implementar Sistema de Perícias Passivas:**
    *   **Visão (Backend):** Calcular a `Percepção Passiva` (e outras, como Investigação ou Intuição) e incluí-la no prompt da IA. Instruir a IA a usar esse valor como um gatilho narrativo (ex: "Se a Percepção Passiva do personagem for > 14, narre que ele nota a fresta solta na parede").
    *   **Visão (Frontend):** Exibir os valores de perícias passivas na ficha do personagem. O jogador se sentirá recompensado ao ver que seu personagem nota coisas automaticamente.

*   **[ ] Reimaginar o Menu Principal:**
    *   **Visão:** Transformar a tela inicial em uma "Mesa do Aventureiro". Sessões de jogo seriam pergaminhos ou diários sobre uma mesa de madeira, criando uma imersão imediata.

*   **[ ] Ficha de Personagem Interativa:**
    *   **Visão:** Transformar a ficha de uma tela de leitura para uma de interação, permitindo ao jogador clicar para gastar recursos (espaços de magia, dados de vida), e exibir visualmente condições e testes de morte.
    *   **Impacto:** Aumenta a agência do jogador e a clareza sobre o estado do seu personagem.

*   **[ ] Aba Dedicada para "Relacionamentos e Missões":**
    *   **Visão:** Criar uma nova aba com "cards" para cada NPC, mostrando afinidade, e listando as missões ativas e concluídas associadas a eles.
    *   **Impacto:** Organiza a informação social do jogo, tornando o progresso das quests e as relações com NPCs mais claras e significativas.

*   **[ ] Linha do Tempo da Progressão do Personagem:**
    *   **Visão:** Criar uma aba de "Progresso" que mostre visualmente as habilidades e talentos ganhos em cada nível, além de um painel para reputação com as facções do mundo.
    *   **Impacto:** Dá ao jogador um forte senso de jornada e evolução do seu herói.

*   **[ ] Sistema de Comércio e Lojas Aprofundado:**
    *   **Visão:** Uma UI de loja dedicada com abas para "Comprar" e "Vender", e uma mecânica de "Barganha" baseada em testes de perícia.
    *   **Impacto:** Transforma uma simples troca de texto em uma parte divertida e estratégica do jogo.

*   **[ ] Implementar Sistema de Descanso Completo (Curto/Longo):**
    *   **Visão:** Gerenciar a recuperação de recursos no backend e criar modais interativos no frontend para que o jogador role seus dados de vida durante um descanso curto.

*   **[ ] Adicionar Suporte a Talentos (Feats):**
    *   **Visão:** Integrar talentos no sistema de progressão de nível e na ficha do personagem, permitindo que a IA os considere em suas narrações.

*   **[ ] Implementar Sistema de Inspiração e Vantagem/Desvantagem:**
    *   **Visão:** Permitir que a IA conceda "Inspiração" e que a UI de rolagem de dados se adapte para rolar com Vantagem ou Desvantagem.

*   **[ ] Ações Estruturadas em Combate (Backend + Frontend):**
    *   **Visão:** Categorizar as opções de ação em "Ação", "Ação Bônus" e "Reação" para refletir as regras do D&D 5e, com a UI mostrando claramente os recursos gastos.

*   **[ ] Inventário e Moedas Unificados (Backend + Frontend):**
    *   **Visão:** Implementar o sistema completo de moedas (Cobre, Prata, Ouro, etc.) e calcular seu peso para uma gestão de carga mais realista.

*   **[ ] Revisão do Sistema de Log e "Modo História" (Frontend):**
    *   **Visão:** Adicionar filtros ao log de aventura (Tudo, Narração, Combate) e criar um "Modo História" que oculte a UI para uma leitura imersiva.

*   **[ ] Melhorias Visuais nos Status e Condições (Frontend):**
    *   **Visão:** Adicionar ícones flutuantes sobre os combatentes para indicar condições e vinhetas na tela para dar feedback visual sobre o estado do personagem.

### Fase 1.4: Otimização e Qualidade de Vida

*   **[ ] Implementar Cache no Servidor com Redis (Backend):**
    *   **Tarefa:** Adicionar o Redis para cachear chamadas repetidas, especialmente para a D&D 5e API.
    *   **Justificativa:** Acelerar drasticamente a criação de personagens e a consulta de informações, reduzindo a dependência de APIs externas.

*   **[ ] Implementar Code Splitting (Frontend):**
    *   **Tarefa:** Usar o `next/dynamic` para carregar componentes pesados (como o wizard de criação de personagem) apenas quando forem necessários.
    *   **Justificativa:** Reduzir o tamanho do bundle inicial, fazendo a aplicação carregar muito mais rápido.
    
*   **[ ] Otimizar Imagens e Fontes (Frontend):**
    *   **Tarefa:** Revisar o uso do componente `next/image` e o carregamento das fontes do Google para garantir a máxima performance segundo as recomendações do Next.js.
    *   **Justificativa:** Melhorar os Core Web Vitals e o tempo de carregamento da página.

*   **[ ] Escrever Testes de Integração e Unidade (Backend):**
    *   **Tarefa:** Configurar `Jest` e `Supertest` para testar a camada de serviço e os endpoints da API.
    *   **Justificativa:** Aumentar a confiabilidade do backend e permitir futuras modificações com segurança.

---

### Metas de Longo Prazo (Pós-Reestruturação)

*   **[ ] Mapa do Mundo Interativo:**
    *   **Visão:** Substituir a lista de diário por um mapa visual da região. Locais descobertos se tornam ícones clicáveis que revelam anotações.
    *   **Ressalva:** A geração de imagens de mapa de forma procedural e consistente é um desafio técnico. A viabilidade precisa ser investigada antes da implementação.

*   **[ ] TASK-2: Streaming Avançado e Modo Multiplayer (Pausado)**
    *   **Status:** Em espera. A reestruturação da TASK-1 é um pré-requisito.
    *   **Sub-tarefas Planejadas:**
        *   **[ ]** Migrar a lógica de IA para uma Cloud Function para escalabilidade.
        *   **[ ]** Implementar um servidor WebSocket no backend Express.
        *   **[ ]** Criar sistema de salas de jogo (criação, entrada, saída).
        *   **[ ]** Sincronizar o estado do jogo entre múltiplos clientes via WebSockets.
        *   **[ ]** Adaptar a UI e o fluxo de turnos para uma experiência cooperativa.
---