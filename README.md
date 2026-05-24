# Crônicas de Aventuras: Uma Plataforma de RPG com IA
# 1.0

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

## O Processo de Criação de Personagem

O sistema de criação de personagens é uma das partes mais sofisticadas do frontend, projetado para ser um "wizard" (assistente) passo a passo que guia o jogador.

-   **Arquitetura de Hooks:** Toda a lógica é centralizada em um hook principal, `useCharacterCreator`, que por sua vez orquestra hooks menores e especializados para gerenciar dados (`useDataManager`), seleções do usuário (`useSelectionManager`) e atributos (`useAttributeManager`). Essa composição garante que o estado seja consistente e reativo a cada escolha do jogador.
-   **Fonte de Dados Unificada:** O assistente busca todas as opções (raças, classes, antecedentes, etc.) **exclusivamente** da nossa API unificada do backend (`/api/dnds/...`). Isso significa que qualquer conteúdo homebrew "instalado" pelo usuário aparece nativamente e de forma transparente nas listas de escolha.
-   **Lógica de Regras no Frontend:** O hook `useCharacterCreator` é responsável por aplicar as regras da 5ª Edição durante a criação:
    *   Calcula os bônus de atributo com base na raça e sub-raça.
    *   Gerencia a distribuição de pontos de atributos no método "Point Buy" ou os resultados da rolagem de dados.
    *   Agrega as proficiências concedidas automaticamente e apresenta apenas as opções válidas para escolha, evitando duplicatas.
    *   Filtra e apresenta as opções de equipamento corretas com base nas escolhas de classe e antecedente.
    *   Calcula o número de magias conhecidas e apresenta as listas corretas para seleção.
-   **Finalização:** Ao final do processo, o hook compila todas as seleções em um único objeto `NewCharacterInfo`, que é enviado para o backend (`POST /api/characters`). O servidor então valida e persiste o novo personagem no banco de dados.

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

1.  **Ação do Jogador**: O jogador seleciona uma opção de ação ou digita uma ação personalizada na UI.
2.  **WebSocket (`processAction`)**: O frontend envia a ação via WebSocket autenticado para o backend.
3.  **Motor de Regras**: Intents estruturados (ataque, magia, perícia, etc.) são validados e deltas aplicados *antes* da IA.
4.  **Narração (IA)**: O `narrarService` monta o contexto e chama o Gemini; a IA só narra o que o motor já decidiu.
5.  **Persistência**: Estado do personagem, logs e `stateVersion` são salvos no MySQL.
6.  **Atualização da UI**: Eventos `actionResolution` e `gameStateUpdate` sincronizam o cliente.

> **Nota:** O gameplay usa **WebSocket**, não REST. Configure `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_WS_URL` no `.env.local` para desenvolvimento local (padrão: `http://localhost:8071`).

## Setup com Docker (recomendado)

```bash
# Infra: MySQL + Redis + 5e-srd-api
docker compose up -d mysql redis srd-db srd-cache srd-api

# Snapshot SRD offline (opcional se já existir em data/srd/)
npm run srd:up          # alias para docker-compose.srd.yml
node scripts/sync-srd-api.js

# Backend
cp .env.example backend/.env   # ajuste DB_* e JWT_SECRET
cd backend && npm install
npm run migration:run          # produção / primeiro boot com DB_SYNC=false
DB_SYNC=true npm run dev       # dev: schema automático

# Frontend (outro terminal)
cp .env.example .env.local
npm install && npm run dev     # http://localhost:9002
```

Stack completa em containers (`--profile app`):

```bash
docker compose --profile app up -d --build
```

Documentação detalhada: [`docs/architecture.md`](docs/architecture.md).

### Modo do pipeline de IA (`AI_PIPELINE_MODE`)

Variável no `backend/.env` (padrão: `narration_only`):

| Valor | Uso |
|-------|-----|
| `narration_only` | Produção — IA só narra; motor aplica regras e estado. |
| `dual` | Duas chamadas Gemini (narrativa + estado). |
| `full` | Resposta JSON completa legada (debug / transição). |

Detalhes: [`docs/AI_PIPELINE.md`](docs/AI_PIPELINE.md). Checklist de QA: [`docs/VALIDATION_CHECKLIST.md`](docs/VALIDATION_CHECKLIST.md).

## Migrações TypeORM (produção)

| Ambiente | `DB_SYNC` | Comando |
|----------|-----------|---------|
| Desenvolvimento | `true` (padrão) | Schema via entidades |
| Produção | `false` | `cd backend && npm run migration:run` |

Migrações incrementais em `backend/src/database/migrations/`.

## Testes e CI

```bash
cd backend && npm test              # motor, SRD, IA, WS (REDIS_URL=mock)
npm run typecheck && npm run lint   # frontend
node scripts/verify-srd-snapshot.js # snapshot offline
```

GitHub Actions: `.github/workflows/ci.yml` (push/PR em `main`, `develop`).