# Crônicas de Aventuras: Um RPG de Texto Gerado por IA

Bem-vindo ao "Crônicas de Aventuras", uma experiência de RPG de mesa solo, onde suas escolhas moldam uma história épica, guiada por um Mestre de Jogo de Inteligência Artificial. Construído com Next.js e Genkit, este projeto combina a nostalgia do Dungeons & Dragons 5ª Edição com o poder da IA generativa.

## Core Features

- **Criação de Personagem Detalhada**: Um assistente passo a passo que permite criar seu herói do zero, escolhendo raça, classe, atributos, antecedentes, perícias, equipamentos e magias, tudo integrado com a API oficial de D&D 5e.
- **Mestre de Jogo com IA (Gemini)**: O coração do jogo. Uma IA generativa que atua como Mestre, descrevendo o mundo, interpretando NPCs, gerenciando combates, rolando dados e apresentando consequências narrativas para as ações do jogador.
- **Jogabilidade Interativa**: As decisões são tomadas através de opções de ação dinâmicas ou ações personalizadas digitadas pelo jogador, garantindo que a história sempre avance de forma coesa.
- **Interface de Jogo Completa**: Uma UI rica e imersiva que inclui:
  - **Ficha de Personagem**: Visualize atributos, perícias, bônus e informações do seu herói.
  - **Inventário e Equipamentos**: Gerencie seus itens, peso e o que está equipado.
  - **Grimório de Magias**: Consulte as magias que seu personagem conhece e pode conjurar.
  - **Diário de Aventura**: Acompanhe missões, locais e NPCs importantes.
  - **Progresso e Relacionamentos**: Monitore a evolução do seu personagem e seus laços com os NPCs.
- **Sistema de Combate e Descanso**: Mecânicas de combate por turnos e regras para descanso curto e longo, tudo gerenciado pela IA.
- **Evolução de Personagem**: Um sistema completo de ganho de XP e "Level Up", onde o jogador faz escolhas significativas para a evolução do seu personagem.
- **Persistência de Estado**: Sua aventura é salva automaticamente no `localStorage` do navegador, permitindo que você continue de onde parou.
- **Recursos Multimídia**:
    - **Narração por Voz (TTS)**: Ouça as narrações do Mestre de Jogo com vozes geradas por IA.
    - **Geração de Imagens**: Em momentos importantes, a IA gera ilustrações para dar vida ao mundo.

## Arquitetura e Tecnologias

- **Frontend**: [Next.js](https://nextjs.org/) com [React](https://react.org/) e [TypeScript](https://www.typescriptlang.org/).
- **UI**: [Tailwind CSS](https://tailwindcss.com/) com componentes de [ShadCN UI](https://ui.shadcn.com/) para uma interface moderna e responsiva.
- **IA Generativa**: [Genkit (Firebase AI)](https://firebase.google.com/docs/genkit) para orquestrar as chamadas ao modelo de linguagem Gemini.
- **API de D&D**: A [D&D 5th Edition API](https://www.dnd5eapi.co/) é utilizada para popular dados de raças, classes, magias, equipamentos, etc.

## Planos Futuros: Modo Multiplayer

A próxima grande evolução deste projeto é a implementação de um modo multiplayer cooperativo. A visão é permitir que até 3 jogadores participem da mesma sessão, interagindo com o Mestre de Jogo de IA em uma aventura compartilhada.

Para mais detalhes técnicos sobre a arquitetura planejada, consulte o nosso roteiro de implementação:
**[Roteiro para Multiplayer com WebSockets](./websocket.md)**

## Como Funciona o Loop do Jogo

1.  **Ação do Jogador**: O jogador seleciona uma das `actionOptions` apresentadas ou digita uma ação personalizada.
2.  **Chamada de Serviço**: A UI chama a função `processPlayerAction` do hook `useGameState`.
3.  **Estado do Jogo**: O `useGameState` envia o estado atual do personagem, o histórico do log e a ação do jogador para o `geminiService`.
4.  **Prompt para a IA**: O `geminiService` formata esses dados em um prompt detalhado para o Genkit/Gemini.
5.  **Resposta da IA**: A IA processa o prompt e retorna um objeto JSON estruturado contendo:
    - `logEntries`: Novas entradas narrativas para a história.
    - `actionOptions`: Novas opções de escolha para o jogador.
    - `updatedCharacter`: Um objeto com apenas as propriedades do personagem que foram alteradas.
    - `imagePrompt`: Ocasionalmente, um prompt para gerar uma imagem da cena.
    - `combatState`, `levelUpState`, etc.: Atualizações para outros sistemas do jogo.
6.  **Atualização de Estado**: O `useGameState` recebe a resposta, atualiza o estado do `character` e do jogo com os novos dados, e a UI é re-renderizada para refletir a continuação da aventura.