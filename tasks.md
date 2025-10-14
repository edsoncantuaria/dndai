# Próximas Tarefas e Melhorias para "Crônicas de Aventuras"

Este documento descreve os próximos grandes recursos e melhorias arquitetônicas planejadas para o projeto, com o objetivo de evoluir a plataforma.

**Nota sobre a Estrutura de Diretórios:**
- **Caminho do Frontend:** `/home/user/studio/`
- **Caminho do Backend:** `/home/user/studio/backend`

---

## TASK-2: Mundo Vivo - NPCs, Monstros e Locais Persistentes (Fundação Concluída)

- **Objetivo:** Transformar o mundo do jogo em um ecossistema persistente e reativo, onde NPCs, monstros únicos e locais descobertos se tornam entidades persistentes no banco de dados, vinculadas a uma sessão de jogo.
- **Visão:** Consequências reais para as ações do jogador. A morte de um NPC é permanente (naquela campanha), missões progridem, e o mundo reage às façanhas do herói.

### Fases da Implementação:

*   **[✅ Concluído] Fase 1: Fundação do Banco de Dados**:
    *   **Status:** As entidades `Relationship`, `Quest` e `JournalEntry` foram definidas no TypeORM e integradas ao banco de dados do backend.

*   **[✅ Concluído] Fase 2: Integração com a IA**:
    *   **Status:** O prompt da IA (`prompt5e.ts` e seus módulos) foi atualizado para instruir o Mestre a criar, gerenciar e consultar essas novas entidades persistentes. Os schemas de entrada e saída da IA agora incluem dados de diário, relacionamentos e missões.

*   **[✅ Concluído] Fase 3: Exibição no Frontend**:
    *   **Status:** Os componentes `NewJournal.tsx` e `NewRelationships.tsx` foram implementados, exibindo os dados de NPCs, locais e missões de forma organizada para o jogador.

*   **[⬜️ A Fazer] Fase 4: Mecânicas Avançadas**:
    *   **Tarefa:** Implementar a lógica para monstros únicos vs. genéricos (respawn).
    *   **Tarefa:** Aprimorar a IA para consultar e referenciar de forma proativa o estado dos NPCs e locais em suas narrações (ex: "Você reencontra Barthen, o ferreiro, que ainda parece grato por você ter salvo sua filha.").
    *   **Tarefa:** Desenvolver o sistema de mapa interativo baseado nos dados de `JournalEntry`.

---

## TASK-1: Reestruturação da Plataforma Cliente-Servidor (Concluído)

- **Problema:** O frontend operava com lógicas antigas de estado no cliente, não aproveitando o potencial do novo backend.
- **Objetivo:** Refatorar completamente a aplicação para alinhar frontend e backend, adotando as melhores práticas de arquitetura para criar uma plataforma rápida, estável e imersiva.
- **Status:** Concluído. Todas as fases, da 1.1 à 1.4 (com exceção dos testes de integração), foram implementadas com sucesso, resultando em uma arquitetura robusta e uma experiência de usuário significativamente melhorada.

---

### Metas de Longo Prazo

*   **[ ] Testes de Integração e Unidade (Backend):**
    *   **Tarefa:** Configurar `Jest` e `Supertest` para testar a camada de serviço e os endpoints da API.
    *   **Justificativa:** Aumentar a confiabilidade do backend e permitir futuras modificações com segurança.
    *   **Status:** Em espera.

*   **[ ] Streaming e Modo Multiplayer (Pausado)**
    *   **Status:** Em espera. A reestruturação da TASK-1 era um pré-requisito.

```