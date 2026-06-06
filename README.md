# Crônicas de Aventuras: Uma Plataforma de RPG com IA
# 1.0

Bem-vindo ao "Crônicas de Aventuras", uma experiência de RPG de mesa solo e imersiva, onde suas escolhas moldam uma história épica, guiada por um Mestre de Jogo de Inteligência Artificial. Construído com Next.js e backend PENAI (Fastify + PostgreSQL + Temporal), combina D&D 5e com IA generativa (Gemini BYOK).

## Core Features

- **Backend PENAI:** Fastify + PostgreSQL + Temporal (`penaiServer.ts`, porta 8071). Ver [`docs/ECOSSISTEMA.md`](docs/ECOSSISTEMA.md).
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

| Camada | Stack |
|--------|--------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind |
| Backend | Fastify 5, TypeORM, PostgreSQL (`penaiServer.ts`) |
| Fila | Temporal (`penai-narration`) + Redis pub/sub WS |
| IA | Google Gemini structured — BYOK do jogador |
| Dados SRD | Snapshot local + homebrew Postgres — ver `docs/DATA_SRD.md` |

Documentação canônica: [`docs/ECOSSISTEMA.md`](docs/ECOSSISTEMA.md) · [`docs/PENAI.md`](docs/PENAI.md) · [`backend/README.md`](backend/README.md)

### Estrutura de Diretórios Principal

```
/
|-- backend/       # API PENAI (Fastify, GameMaster, Temporal worker)
|-- src/           # Frontend Next.js
|-- data/          # Snapshots SRD e traduções PT-BR (somente leitura)
|-- docs/          # Documentação viva + ADRs
```

## Como Funciona o Loop do Jogo (PENAI)

1. **Ação do jogador** — dock ou texto livre; `InputGate` bloqueia durante roll/narração.
2. **WebSocket v2** — `processAction` com JWT; motor aplica mecânica (`mechanicalStateUpdate`).
3. **Narração** — Temporal enfileira Gemini; worker publica `gameStateUpdate` + `storyFeed`.
4. **Persistência** — Postgres (`game_sessions`, overlays `session_*`); memória Qdrant opcional.
5. **UI** — `usePenaiTurnPipeline` sincroniza ficha, combate e crônica (`PenaiStoryFeed`).

Configure `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8071/api`, `NEXT_PUBLIC_WS_URL=ws://localhost:8071/`, `NEXT_PUBLIC_PENAI_UI=true`.

## Setup com Docker

**Desenvolvimento local PENAI (recomendado):**

```bash
npm run dev:local              # infra PENAI + SRD no Docker
cp backend/.env.penai.example backend/.env
cd backend && npm run dev:penai   # terminal 2
cd backend && npm run worker:temporal   # terminal 3 (ou TEMPORAL_DISABLED=true)
npm run dev                    # terminal 4 — Next.js :9002
```

Após login e licença, o jogo **pede a chave Gemini (BYOK)** — não é necessário `GEMINI_API_KEY` no `.env` do servidor para jogar.

Configure `.env.local` com `NEXT_PUBLIC_API_URL=http://localhost:8071/api`, `NEXT_PUBLIC_WS_URL=ws://localhost:8071/` e `NEXT_PUBLIC_PENAI_UI=true`.

Detalhes: [`docs/PENAI.md`](docs/PENAI.md) · [`docs/DATA_SRD.md`](docs/DATA_SRD.md).

**Stack legada MySQL/BullMQ/Express** foi **removida** (jun/2026, ADR 0002). Homolog Cloudive:

```bash
npm run docker:up              # PENAI + frontend homolog
```

Documentação viva: [`docs/VALIDACAO_SENIOR.md`](docs/VALIDACAO_SENIOR.md) (índice) · [`docs/ECOSSISTEMA.md`](docs/ECOSSISTEMA.md) · [`docs/DESIGN_FRONTEND.md`](docs/DESIGN_FRONTEND.md) · [`docs/README.md`](docs/README.md).

### Modo do pipeline de IA (`AI_PIPELINE_MODE`)

Variável no `backend/.env` (padrão: `narration_only`):

| Valor | Uso |
|-------|-----|
| `narration_only` | Produção — IA só narra; motor aplica regras e estado. |
| `dual` | Duas chamadas Gemini (narrativa + estado). |
| `full` | Resposta JSON completa legada (debug / transição). |

Detalhes: [`docs/AI_PIPELINE.md`](docs/AI_PIPELINE.md). Checklist de QA: [`docs/VALIDATION_CHECKLIST.md`](docs/VALIDATION_CHECKLIST.md).

## Dev local e testes

```bash
npm run dev:local                    # Postgres :5433, Redis, Temporal
npm run penai:db:prepare --prefix backend
cd backend && npm run dev:penai
npm run dev                          # frontend :9002

npm run test --prefix backend
npm run test:frontend
```

Migrações Postgres: `npm run penai:migration:run --prefix backend`. GitHub Actions: `.github/workflows/ci.yml`.