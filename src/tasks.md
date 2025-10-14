# Próximas Tarefas e Melhorias para "Crônicas de Aventuras"

Este documento descreve os próximos grandes recursos e melhorias arquitetônicas planejadas para o projeto, com o objetivo de evoluir a plataforma.

**Nota sobre a Estrutura de Diretórios:**
- **Caminho do Frontend:** `/home/user/studio/`
- **Caminho do Backend:** `/home/user/studio/backend`

---

## TASK-4: Agência Assíncrona e Mundo Contínuo (Próximos Passos)

- **Objetivo:** Aproveitar o tempo de "digitação" da IA no frontend para executar processos de fundo no backend, simulando um mundo que evolui de forma contínua. Para mais detalhes, consulte o documento de planejamento: `npc-monsters-maps-stuffs.md`.
- **Backend:**
    - **[⬜️ A Fazer]** Implementar um sistema de fila ou "web worker" para lidar com tarefas assíncronas, como a progressão da rotina de um NPC ou o avanço de eventos mundiais.
    - **[⬜️ A Fazer]** Criar um gatilho que, após uma ação do jogador que resulte em passagem de tempo, adicione tarefas de "evolução do mundo" a essa fila.
- **Frontend:**
    - **[⬜️ A Fazer]** Desenvolver um sistema de notificações sutis (talvez via WebSocket) para alertar o jogador sobre eventos que ocorreram em segundo plano (ex: "Você recebe uma carta de um mensageiro" ou "Os sinos da cidade começam a tocar ao longe").


---

## TASK-3: Aprofundando o "Mundo Vivo" (Concluído)

- **Objetivo:** Implementar funcionalidades que adicionem mais dinamismo, reatividade e imersão ao mundo do jogo, fazendo-o sentir-se verdadeiramente vivo.
- **Status:** Concluído. Todas as fases foram implementadas, criando a base para um mundo persistente e reativo.

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
        *   **[✅ Concluído]** Aprimorar o componente `NewRelationships.tsx` para exibir um status ou uma nota sobre a última atividade conhecida de um NPC, atualizada quando a IA fornece essa informação.

*   **[✅ Concluído] Fase 3: Sistema de Notícias e Rumores**
    *   **Backend:**
        *   **[✅ Concluído]** Instruir a IA a identificar eventos de grande impacto causados pelo jogador e marcá-los em um novo campo `majorEvents` dentro do `worldState`.
        *   **[✅ Concluído]** Ensinar a IA a consultar esses "eventos" e transformá-los em rumores que podem ser ouvidos em tavernas e cidades.
    *   **Frontend:**
        *   **[✅ Concluído]** Exibir os rumores como parte da narração normal no `NewNarrativeLog.tsx` e registrar os mais importantes no "Diário".

*   **[✅ Concluído] Fase 4: Reputação com Facções e Guildas**
    *   **Backend:**
        *   **[✅ Concluído]** Instruir a IA a rastrear e atualizar a reputação do jogador com facções do mundo no campo `factionReputation` da entidade `Character`.
        *   **[✅ Concluído]** Garantir que a IA use essa reputação para modular diálogos, preços em lojas e a disponibilidade de missões.
    *   **Frontend:**
        *   **[✅ Concluído]** Implementar um componente no `ProgressionTab.tsx` para exibir visualmente a reputação do jogador.

*   **[⬜️ A Fazer] Fase 5: Mapa do Mundo Interativo**
    *   **Backend:**
        *   **[⬜️ A Fazer]** Ensinar a IA a associar coordenadas (mesmo que relativas, como `x, y`) a cada novo `JournalEntry` (local) que ela cria.
    *   **Frontend:**
        *   **[⬜️ A Fazer]** Desenvolver um novo componente de UI (`InteractiveMap.tsx`) que renderize um mapa.
        *   **[⬜️ A Fazer]** Popular o mapa dinamicamente com marcadores para cada local salvo no `character.journal`.

---

## TASK-2: Mundo Vivo - NPCs, Monstros e Locais Persistentes (Concluído)

- **Objetivo:** Transformar o mundo do jogo em um ecossistema persistente e reativo.
- **Status:** Concluído. A fundação para um mundo com memória, NPCs únicos e consequências duradouras está implementada.

---

## TASK-1: Reestruturação da Plataforma Cliente-Servidor (Concluído)

- **Objetivo:** Refatorar completamente a aplicação para alinhar frontend e backend.
- **Status:** Concluído.
