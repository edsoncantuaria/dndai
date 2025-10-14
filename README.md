# Crônicas de Aventuras: Uma Plataforma de RPG com IA

Bem-vindo ao "Crônicas de Aventuras", uma experiência de RPG de mesa solo e imersiva, onde suas escolhas moldam uma história épica, guiada por um Mestre de Jogo de Inteligência Artificial. Construído com Next.js, Genkit e um robusto backend Node.js, este projeto combina a nostalgia do Dungeons & Dragons 5ª Edição com o poder da IA generativa.

## Core Features

- **Backend Dedicado com Gerenciamento de Sessão:** A lógica do jogo é centralizada em um servidor Node.js/Express, garantindo persistência de dados, segurança e uma plataforma escalável.
- **Cofre de Heróis e Personagens Persistentes:** Crie múltiplos personagens que são salvos em sua conta. Leve seus heróis em diferentes aventuras, mantendo seu progresso e história.
- **Mestre de Jogo com IA (Gemini):** O coração do jogo. Uma IA generativa que atua como Mestre, descrevendo o mundo, interpretando NPCs, gerenciando combates e apresentando consequências narrativas.
- **Jogabilidade Interativa Baseada em Turnos:** As decisões são tomadas através de opções de ação dinâmicas ou ações personalizadas digitadas pelo jogador, em um fluxo de jogo estruturado que garante coerência.
- **Sistema de Rolagem de Dados Interativo:** O jogador sempre rola seus próprios dados. Uma UI dedicada para rolagens de ataque, perícias e testes de resistência, com feedback claro de sucesso ou falha.
- **Interface de Jogo Completa e Imersiva:**
    - **Ficha de Personagem Interativa:** Visualize e gerencie atributos, perícias, bônus, condições e recursos.
    - **Inventário e Moedas Unificados:** Gerencie seus itens e todos os tipos de moedas (Cobre, Prata, Ouro), com cálculo de peso automático.
    - **Grimório de Magias:** Consulte e prepare suas magias, com indicadores de espaços de magia disponíveis.
    - **Diário de Aventura e Relacionamentos:** Acompanhe missões, NPCs importantes, sua afinidade com eles e o estado do mundo.
- **Sistema de Combate Tático:** Um tracker de combate visual que mostra a ordem de iniciativa, status dos combatentes e histórico de ações.
- **Progressão Completa:** Sistema de ganho de XP, "Level Up" com escolhas significativas (habilidades, talentos) e uma linha do tempo visual do progresso do personagem.
- **Recursos Multimídia:**
    - **Narração por Voz (TTS):** Ouça as narrações do Mestre de Jogo com vozes geradas por IA.
    - **Geração de Imagens:** Em momentos importantes, a IA gera ilustrações para dar vida ao mundo.

## Arquitetura e Tecnologias

O projeto é construído sobre uma stack moderna, priorizando a componentização e a separação de responsabilidades.

- **Frontend**: [Next.js](https://nextjs.org/) com [React](https://reactjs.org/) e [TypeScript](https://www.typescriptlang.org/).
- **UI**: [Tailwind CSS](https://tailwindcss.com/) com componentes de [ShadCN UI](https://ui.shadcn.com/) para uma interface moderna e responsiva.
- **Backend**: [Node.js](https://nodejs.org/) com [Express.js](https://expressjs.com/) para a API REST.
- **Banco de Dados**: [MySQL](https://www.mysql.com/) com [TypeORM](https://typeorm.io/) para persistência de dados de usuários, personagens e sessões.
- **Cache**: [Redis](https://redis.io/) para cache de chamadas de API externas e otimização.
- **IA Generativa**: [Genkit (Google AI)](https://firebase.google.com/docs/genkit) para orquestrar as chamadas ao modelo de linguagem Gemini.
- **API de D&D**: A [D&D 5th Edition API](https://www.dnd5eapi.co/) é utilizada como fonte de dados para raças, classes, magias, etc., com cache no backend.

**Nota Crítica sobre a API Externa:** O arquivo `openapi.yaml` na raiz do projeto documenta a estrutura exata da D&D 5e API. **Este arquivo DEVE ser consultado SEMPRE** antes de fazer qualquer modificação que envolva a busca de dados externos, para garantir que as URLs e os schemas estejam corretos.

### Estrutura de Diretórios Principal

```
/
|-- /backend/      # (Servidor Node.js, API e lógica de negócios)
|-- /src/          # (Aplicação Frontend Next.js)
`-- /data/         # (Arquivos de dados para modificações e customizações)
```

**Nota Importante:** O diretório `/data/` é destinado a conter arquivos de dados (como JSONs customizados) que podem ser modificados para customizar o jogo. Não deve ser alterado de outras formas para não quebrar a lógica da aplicação.

## Como Funciona o Loop do Jogo

1.  **Ação do Jogador**: O jogador seleciona uma `actionOption` ou digita uma ação personalizada na UI.
2.  **Chamada de Serviço (Frontend)**: A UI envia a ação para o `gameService`, que faz uma requisição `POST /api/narrar/:sessionId` para o backend.
3.  **Processamento (Backend)**:
    *   O `narrarController` recebe a requisição.
    *   O `narrarService` carrega os dados completos do personagem e o histórico da sessão do banco de dados.
    *   Os dados são formatados em um prompt detalhado e enviados para o `aiService`.
4.  **Resposta da IA**: A IA (Genkit/Gemini) processa o prompt e retorna um objeto JSON estruturado com o resultado da ação (`logEntries`, `updatedCharacter`, `combatState`, etc.).
5.  **Persistência (Backend)**: O `narrarService` recebe a resposta da IA, atualiza o estado do personagem e salva as novas entradas de log no banco de dados.
6.  **Retorno ao Frontend**: O backend envia a resposta completa da IA de volta para o frontend.
7.  **Atualização de Estado (Frontend)**: O `useGameState` recebe a resposta, atualiza o estado local do jogo, e a UI é re-renderizada para refletir a continuação da aventura.