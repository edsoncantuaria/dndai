# Crônicas de Aventuras: Um RPG de Texto Gerado por IA

Bem-vindo ao "Crônicas de Aventuras", uma experiência de RPG de mesa solo, onde suas escolhas moldam uma história épica, guiada por um Mestre de Jogo de Inteligência Artificial. Construído com Next.js e Genkit, este projeto combina a nostalgia do Dungeons & Dragons 5ª Edição com o poder da IA generativa.

## Core Features

- **Criação de Personagem Detalhada**: Um assistente passo a passo que permite criar seu herói do zero, escolhendo raça, classe, atributos, antecedentes, perícias, equipamentos e magias, tudo integrado com a API oficial de D&D 5e.
- **Mestre de Jogo com IA (Gemini)**: O coração do jogo. Uma IA generativa que atua como Mestre, descrevendo o mundo, interpretando NPCs, gerenciando combates, rolando dados e apresentando consequências narrativas para as ações do jogador.
- **Jogabilidade Interativa**: As decisões são tomadas através de opções de ação dinâmicas, sugeridas pela IA, garantindo que a história sempre avance de forma coesa.
- **Interface de Jogo Completa**: Uma UI rica e imersiva que inclui:
  - **Ficha de Personagem**: Visualize atributos, perícias, bônus e informações do seu herói.
  - **Inventário e Equipamentos**: Gerencie seus itens, peso e o que está equipado.
  - **Grimório de Magias**: Consulte as magias que seu personagem conhece e pode conjurar.
  - **Diário de Aventura**: Acompanhe missões, locais e NPCs importantes.
  - **Progresso e Relacionamentos**: Monitore a evolução do seu personagem e seus laços com os NPCs.
- **Sistema de Combate e Descanso**: Mecânicas de combate por turnos e regras para descanso curto e longo, tudo gerenciado pela IA.
- **Persistência de Estado**: Sua aventura é salva automaticamente no `localStorage` do navegador, permitindo que você continue de onde parou.

## Arquitetura e Tecnologias

O projeto é construído sobre uma stack moderna, priorizando a componentização e a separação de responsabilidades.

- **Frontend**: [Next.js](https://nextjs.org/) com [React](https://reactjs.org/) e [TypeScript](https://www.typescriptlang.org/).
- **UI**: [Tailwind CSS](https://tailwindcss.com/) com componentes de [ShadCN UI](https://ui.shadcn.com/) para uma interface moderna e responsiva.
- **IA Generativa**: [Genkit (Firebase AI)](https://firebase.google.com/docs/genkit) para orquestrar as chamadas ao modelo de linguagem Gemini Pro.
- **API de D&D**: A [D&D 5th Edition API](https://www.dnd5eapi.co/) é utilizada para popular dados de raças, classes, magias, equipamentos, etc.

### Estrutura de Diretórios Principal

```
/src
|-- /ai/              # Lógica de IA com Genkit
|   |-- /flows/       # Definição dos fluxos de IA
|   +-- genkit.ts     # Configuração principal do Genkit
|
|-- /app/             # Rotas e UI principal do Next.js
|   |-- /_components/ # Componentes específicos da página principal do jogo
|   |-- layout.tsx
|   +-- page.tsx
|
|-- /components/      # Componentes React reutilizáveis
|   |-- /NewCreationCharacter/ # Componentes para o wizard de criação de personagem
|   |-- /ui/          # Componentes base da UI (Button, Modal, etc.)
|   +-- ...outros
|
|-- /contexts/        # Contextos React (ex: GameStateContext)
|
|-- /hooks/           # Hooks React customizados
|   |-- useGameState.ts          # Hook central que gerencia todo o estado do jogo
|   +-- newUseCharacterCreation.ts # Hook que orquestra a criação de personagem
|
|-- /services/        # Camada de comunicação com APIs externas
|   |-- dndApiService.ts # Funções para buscar dados da D&D 5e API
|   +-- geminiService.ts # Funções para interagir com o Mestre de Jogo (Gemini)
|
`-- /utils/           # Funções utilitárias (cálculos, tradutores, etc.)
```

## Como Funciona o Loop do Jogo

1.  **Ação do Jogador**: O jogador seleciona uma das `actionOptions` apresentadas na UI.
2.  **Chamada de Serviço**: A UI chama a função `processPlayerAction` do hook `useGameState`.
3.  **Estado do Jogo**: O `useGameState` envia o estado atual do personagem, o histórico do log e a ação do jogador para o `geminiService`.
4.  **Prompt para a IA**: O `geminiService` formata esses dados em um prompt detalhado para o Genkit/Gemini.
5.  **Resposta da IA**: A IA processa o prompt e retorna um objeto JSON estruturado contendo:
    - `logEntries`: Novas entradas narrativas para a história.
    - `actionOptions`: Novas opções de escolha para o jogador.
    - `updatedCharacter`: Um objeto com apenas as propriedades do personagem que foram alteradas (ex: `hp`, `xp`, `inventory`).
    - `combatState`, `levelUpState`, etc.: Atualizações para outros sistemas do jogo.
6.  **Atualização de Estado**: O `useGameState` recebe a resposta, atualiza o estado do `character` e do jogo com os novos dados, e a UI é re-renderizada para refletir a continuação da aventura.

## Changelog

### v0.1 (Reformulação de UI/UX e Estabilidade)

Esta versão marca a primeira grande reformulação da interface e da experiência do usuário, além de correções críticas na lógica de criação de personagem.

-   **Completa Reformulação da UI/UX**: A interface foi redesenhada para ser mais moderna, fluida e funcional em desktops e dispositivos móveis, mantendo a identidade visual de fantasia.
-   **Experiência Mobile Otimizada**:
    -   Implementada uma nova barra de ferramentas inferior (`MobileToolbar`) para acesso rápido ao personagem, inventário, magias e outras seções.
    -   As funcionalidades agora abrem em painéis deslizantes, permitindo uma navegação ágil sem perder o contexto do jogo.
    -   A área de ações do jogador agora é um painel fixo na parte inferior da tela, garantindo que as opções de decisão estejam sempre visíveis.
-   **Melhorias na Interface Desktop**:
    -   O painel lateral foi reorganizado com um sistema de abas iconográficas, melhorando a organização e agilizando o acesso às diferentes fichas de informação.
-   **Fluxo de Jogo Mais Fluido**:
    -   Foram adicionadas animações sutis de fade-in e slide-up para tornar a aparição de novos textos e ações mais agradável.
    -   Resolvidos problemas de layout (`overflow`) que causavam cortes na tela, garantindo que a aplicação se adapte perfeitamente a diferentes resoluções.
-   **Criação de Personagem Robusta**:
    -   A navegação no assistente de criação agora permite clicar diretamente nos números das etapas já concluídas.
    -   O sistema de seleção de magias impede a escolha duplicada de uma mesma magia de fontes diferentes (racial e de classe).
    -   A lógica de seleção de equipamentos foi corrigida para lidar com todos os cenários complexos da API, incluindo categorias diretas como "Símbolo Sagrado".
-   **Extensibilidade do Sistema**:
    -   A arquitetura foi preparada para permitir a adição de conteúdo "hard-coded" (novas raças, talentos, etc.) que seguem a estrutura da API, facilitando futuras expansões do jogo.
