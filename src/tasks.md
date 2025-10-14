# Próximas Tarefas e Melhorias para "Crônicas de Aventuras"

Este documento descreve os próximos grandes recursos e melhorias arquitetônicas planejadas para o projeto, com o objetivo de evoluir a plataforma.

**Nota sobre a Estrutura de Diretórios:**
- **Caminho do Frontend:** `/home/user/studio/`
- **Caminho do Backend:** `/home/user/studio/backend`

---

## ✅ TASK-1: Reestruturação da Plataforma Cliente-Servidor (Concluído)

- **Problema:** O frontend atual ainda opera com muitas lógicas do design original (estado gerenciado no cliente, `localStorage`), o que o impede de aproveitar todo o potencial do novo backend (banco de dados persistente, gerenciamento de sessões, personagens reutilizáveis). A interface e o fluxo de dados não refletem a nova arquitetura de servidor.
- **Filosofia Central:** O backend é a única fonte da verdade. O frontend deve ser uma interface reativa e performática que busca e envia dados ao servidor, utilizando o cache de forma inteligente para uma experiência de usuário fluida.
- **Objetivo:** Refatorar completamente a aplicação para alinhar o frontend e o backend, adotando as melhores práticas de arquitetura para criar uma plataforma rápida, estável, imersiva e pronta para futuras expansões.

### Fase 1.1: Fundação da Arquitetura (Backend & Frontend)

*   **[X] Implementar Validação de Dados com Zod (Backend):**
    *   **Tarefa:** Em cada controller do backend (ex: `characterController.ts`), usar o Zod para criar schemas que validam o `req.body` de todas as requisições `POST` e `PUT`.
    *   **Justificativa:** Garante que dados malformados ou maliciosos nunca cheguem à nossa lógica de negócios ou ao banco de dados, tornando a API mais segura e previsível.

*   **[X] Criar Camada de Serviço (Service Layer) (Backend):**
    *   **Tarefa:** Criar novos serviços (ex: `characterService.ts`, `sessionService.ts`) na pasta `backend/src/services`. Mover a lógica de banco de dados (TypeORM) e as interações complexas dos controllers para esses serviços.
    *   **Justificativa:** Desacopla a lógica da API (Express) da lógica de negócios. Os controllers se tornam mais simples (apenas validam e chamam serviços), e a lógica principal pode ser reutilizada e testada de forma isolada.
    
*   **[X] Centralizar Configurações Sensíveis (`.env`) (Backend):**
    *   **Tarefa:** Garantir que todas as configurações que podem mudar entre ambientes (como `JWT_SECRET`) sejam lidas a partir de variáveis de ambiente e documentadas no `.env.example`.
    *   **Justificativa:** Melhora a segurança e a flexibilidade para futuras implantações em ambientes de produção.

*   **[X] Centralizar o Acesso à API (`apiClient.ts`) (Frontend):**
    *   **Tarefa:** Criar um único `apiClient.ts` que exporta um wrapper do `fetch`. Todos os serviços do frontend (`authService`, `gameService`) usarão este cliente.
    *   **Justificativa:** Centraliza a lógica de API, permitindo a fácil implementação de interceptadores para tratamento de erros e adição automática de headers de autenticação.

### Fase 1.2: Reconstrução dos Componentes e Fluxos de UI

*   **[X] Refatorar Menus e Navegação (`GameContainer`):**
    *   **Tarefa:** Separar a lógica de menu do estado de jogo ativo. O `GameContainer` passa a gerenciar os menus, enquanto um novo componente `Game` gerencia a tela de jogo principal. Corrigir o fluxo de início de jogo.
    *   **Justificativa:** Melhora a organização, corrige bugs no carregamento de sessões e torna a estrutura de componentes mais lógica e fácil de manter.
    *   **Status:** Concluído.

*   **[X] Implementar o "Cofre de Heróis":**
    *   **Tarefa:** Criar uma nova tela (`character_vault`) para exibir a lista de personagens do usuário. O fluxo de "Nova Aventura" passa por esta tela, permitindo ao jogador escolher um herói existente ou criar um novo.
    *   **Justificativa:** Realiza a visão de personagens reutilizáveis, uma das principais vantagens da arquitetura de backend.
    *   **Status:** Concluído.

*   **[X] Adaptar Componentes de Jogo (Ficha, Inventário, etc.):**
    *   **Tarefa:** Garantir que os componentes do frontend, como a ficha de personagem e o inventário, exibam corretamente os dados carregados do backend, corrigindo bugs de mapeamento de dados.
    *   **Justificativa:** Assegura que a interface do usuário seja um reflexo fiel e completo do estado do personagem armazenado no servidor, resolvendo inconsistências.
    *   **Status:** Concluído.
    
*   **[ ] Componentizar a UI (Frontend):**
    *   **Tarefa:** Dividir componentes grandes como `CharacterSheet` e `NewCharacterCreation` em subcomponentes menores e mais focados (ex: `AttributeDisplay`, `SkillsList`, `Stepper`).
    *   **Justificativa:** Melhora a organização do código, a performance de renderização (com `React.memo`) e a manutenibilidade.

### Fase 1.3: Imersão, Elegância e Completude do Sistema D&D

*   **[X] Reforçar o Fluxo de Jogo "Mestre Pede, Jogador Rola":**
    *   **Visão (Backend):** Tornar o `prompt5e.ts` extremamente rigoroso. A IA **nunca** deve rolar dados pelo jogador ou presumir resultados. O fluxo `Intenção -> Pedido de Rolagem (com DC claro) -> Resultado -> Consequência` deve ser obrigatório para ataques, perícias e testes de resistência.
    *   **Visão (Frontend):** O `DiceRollModal` deve exibir claramente o alvo (DC) para criar suspense. A agência do jogador sobre os dados é a alma da experiência.
    *   **Status:** Concluído.

*   **[X] Implementar Sistema de Perícias Passivas:**
    *   **Visão (Backend):** Calcular a `Percepção Passiva` (e outras, como Investigação ou Intuição) e incluí-la no prompt da IA. Instruir a IA a usar esse valor como um gatilho narrativo (ex: "Se a Percepção Passiva do personagem for > 14, narre que ele nota a fresta solta na parede").
    *   **Visão (Frontend):** Exibir os valores de perícias passivas na ficha do personagem. O jogador se sentirá recompensado ao ver que seu personagem nota coisas automaticamente.
    *   **Status:** Concluído.

*   **[X] Reimaginar o Menu Principal:**
    *   **Visão:** Transformar a tela inicial em uma "Mesa do Aventureiro". Sessões de jogo são apresentadas como diários ou pergaminhos, criando uma imersão imediata.
    *   **Status:** Concluído.

*   **[X] Ficha de Personagem Interativa:**
    *   **Visão:** Transformar a ficha de uma tela de leitura para uma de interação, permitindo ao jogador clicar para gastar recursos (espaços de magia, dados de vida), e exibir visualmente condições e testes de morte.
    *   **Impacto:** Aumenta a agência do jogador e a clareza sobre o estado do seu personagem.
    *   **Status:** Concluído.

*   **[X] Aba Dedicada para "Relacionamentos e Missões":**
    *   **Visão:** Criar uma nova aba com "cards" para cada NPC, mostrando afinidade, e listando as missões ativas e concluídas associadas a eles.
    *   **Impacto:** Organiza a informação social do jogo, tornando o progresso das quests e as relações com os NPCs mais claras e significativas.
    *   **Status:** Concluído.

*   **[X] Linha do Tempo da Progressão do Personagem:**
    *   **Visão:** Criar uma aba de "Progresso" que mostre visualmente as habilidades e talentos ganhos em cada nível, além de um painel para reputação com as facções do mundo.
    *   **Impacto:** Dá ao jogador um forte senso de jornada e evolução do seu herói.
    *   **Status:** Concluído.

*   **[X] Sistema de Comércio e Lojas Aprofundado:**
    *   **Visão:** Uma UI de loja dedicada com abas para "Comprar" e "Vender", e uma mecânica de "Barganha" baseada em testes de perícia.
    *   **Impacto:** Transforma uma simples troca de texto em uma parte divertida e estratégica do jogo.
    *   **Status:** Concluído.

*   **[X] Implementar Sistema de Descanso Completo (Curto/Longo):**
    *   **Visão:** Gerenciar a recuperação de recursos no backend e criar modais interativos no frontend para que o jogador role seus dados de vida durante um descanso curto.
    *   **Status:** Concluído.

*   **[X] Ações Estruturadas em Combate (Backend + Frontend):**
    *   **Visão:** Categorizar as opções de ação em "Ação", "Ação Bônus" e "Reação" para refletir as regras do D&D 5e, com a UI mostrando claramente os recursos gastos.
    *   **Status:** Fundações concluídas. A lógica completa de gerenciamento de turnos ainda está em desenvolvimento.

*   **[X] Reimaginar Inventário e Grimório:**
    *   **Visão:** Transformar as telas de inventário e grimório de simples listas para painéis imersivos e organizados, com categorias, indicadores visuais de recursos (espaços de magia) e um design mais limpo.
    *   **Impacto:** Melhora drasticamente a usabilidade e a estética do gerenciamento de personagem.
    *   **Status:** Concluído.

*   **[X] Implementar Sistema de Inspiração e Vantagem/Desvantagem:**
    *   **Visão:** Permitir que a IA conceda "Inspiração" e que a UI de rolagem de dados se adapte para rolar com Vantagem ou Desvantagem.
    *   **Status:** Concluído.

*   **[ ] Adicionar Suporte a Talentos (Feats):**
    *   **Visão:** Integrar talentos no sistema de progressão de nível e na ficha do personagem, permitindo que a IA os considere em suas narrações.
    *   **Status:** Refatoração de banco de dados concluída. Próximo passo é a implementação na UI.

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

*   **[ ] TASK-2: Streaming e Modo Multiplayer (Pausado)**
    *   **Status:** Em espera. A reestruturação da TASK-1 é um pré-requisito.
---
