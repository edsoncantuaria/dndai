# Próximas Tarefas e Melhorias para "Crônicas de Aventuras"

Este documento descreve os próximos grandes recursos e melhorias arquitetônicas planejadas para o projeto, com o objetivo de evoluir a plataforma.

**Nota sobre a Estrutura de Diretórios:**
- **Caminho do Frontend:** `/home/user/studio/`
- **Caminho do Backend:** `/home/user/studio/backend`

---

## TASK-3: Aprofundando o "Mundo Vivo" (Próximas Etapas)

- **Objetivo:** Implementar funcionalidades que adicionem mais dinamismo, reatividade e imersão ao mundo do jogo, fazendo-o sentir-se verdadeiramente vivo.

### Fases da Implementação:

*   **[✅ Concluído] Fase 1: Ciclo Dinâmico de Dia/Noite, Clima e Calendário**
    *   **Backend:**
        *   **[✅ Concluído]** Aprimorar o prompt da IA para que, após ações de descanso, viagem ou eventos narrativos significativos, ela atualize proativamente os campos `timeOfDay`, `weather` e `currentDate` dentro do `worldState`.
        *   **[✅ Concluído]** Garantir que a IA persista corretamente o objeto `worldState` completo no banco de dados.
        *   **[✅ Concluído]** Ensinar à IA como as mudanças de clima e horário devem impactar a narrativa e as mecânicas.
    *   **Frontend:**
        *   **[✅ Concluído]** Criar o componente `WorldStatePanel.tsx` para exibir a data atual, a hora do dia e o clima, usando ícones representativos.
        *   **[✅ Concluído]** Garantir que o `GameStateContext` receba e atualize corretamente o estado do mundo vindo do backend.

*   **[✅ Concluído] Fase 2: NPCs com Agência e Rotinas**
    *   **Backend:**
        *   **[✅ Concluído]** Aprimorar o prompt da IA para que, ao reencontrar um NPC ou com a passagem do tempo, ela consulte e atualize o estado dele, narrando as mudanças ocorridas (ex: "Barthen, o ferreiro, parece cansado. Ele diz que passou a noite toda forjando uma nova espada"). Isso efetivamente simula a passagem de tempo e a "agência" dos NPCs.
    *   **Frontend:**
        *   **[⬜️ A Fazer]** Aprimorar o componente `NewRelationships.tsx` para talvez exibir um status ou uma nota sobre a última atividade conhecida de um NPC, atualizada quando a IA fornece essa informação.

*   **[✅ Concluído] Fase 3: Sistema de Notícias e Rumores**
    *   **Backend:**
        *   **[✅ Concluído]** Instruir a IA a identificar eventos de grande impacto causados pelo jogador e marcá-los em um novo campo `majorEvents` dentro do `worldState`.
        *   **[✅ Concluído]** Ensinar a IA a consultar esses "eventos" e transformá-los em rumores que podem ser ouvidos em tavernas e cidades.
    *   **Frontend:**
        *   **[✅ Concluído]** Exibir os rumores como parte da narração normal no `NewNarrativeLog.tsx`. Opcionalmente, criar uma nova aba ou seção no "Diário" para registrar os rumores mais importantes ouvidos pelo jogador.

*   **[✅ Concluído] Fase 4: Reputação com Facções e Guildas**
    *   **Backend:**
        *   **[✅ Concluído]** Instruir a IA a rastrear e atualizar a reputação do jogador com facções do mundo (ex: Guilda dos Ladrões, Guarda da Cidade) no campo `factionReputation` da entidade `Character`.
        *   **[✅ Concluído]** Garantir que a IA use essa reputação para modular diálogos, preços em lojas e a disponibilidade de missões.
    *   **Frontend:**
        *   **[✅ Concluído]** Implementar um componente no `ProgressionTab.tsx` ou em uma nova aba "Facções" para exibir a reputação do jogador com as diferentes guildas encontradas.

*   **[⬜️ A Fazer] Fase 5: Mapa do Mundo Interativo**
    *   **Backend:**
        *   **[⬜️ A Fazer]** Ensinar a IA a associar coordenadas (mesmo que relativas, como `x, y`) a cada novo `JournalEntry` (local) que ela cria.
    *   **Frontend:**
        *   **[⬜️ A Fazer]** Desenvolver um novo componente de UI (`InteractiveMap.tsx`) que renderize um mapa.
        *   **[⬜️ A Fazer]** Popular o mapa dinamicamente com marcadores para cada local salvo no `character.journal`.

---

## TASK-2: Mundo Vivo - NPCs, Monstros e Locais Persistentes (Concluído)

- **Objetivo:** Transformar o mundo do jogo em um ecossistema persistente e reativo, onde NPCs, monstros únicos e locais descobertos se tornam entidades persistentes no banco de dados, vinculadas a uma sessão de jogo.
- **Status:** Concluído. A fundação para um mundo com memória, NPCs únicos e consequências duradouras está implementada e funcional.

---

## TASK-1: Reestruturação da Plataforma Cliente-Servidor (Concluído)

- **Problema:** O frontend operava com lógicas antigas de estado no cliente, não aproveitando o potencial do novo backend.
- **Objetivo:** Refatorar completamente a aplicação para alinhar frontend e backend, adotando as melhores práticas de arquitetura para criar uma plataforma rápida, estável e imersiva.
- **Status:** Concluído. Todas as fases, da 1.1 à 1.4 (com exceção dos testes de integração), foram implementadas com sucesso, resultando em uma arquitetura robusta e uma experiência de usuário significativamente melhorada.
