# Próximas Tarefas e Melhorias para "Crônicas de Aventuras"

Este documento descreve os próximos grandes recursos e melhorias arquitetônicas planejadas para o projeto, com o objetivo de evoluir a plataforma.

**Nota sobre a Estrutura de Diretórios:**
- **Caminho do Frontend:** `/home/user/studio/`
- **Caminho do Backend:** `/home/user/studio/backend`

---

## TASK-3: Aprofundando o "Mundo Vivo" (Próximas Etapas)

- **Objetivo:** Implementar funcionalidades que adicionem mais dinamismo, reatividade e imersão ao mundo do jogo, fazendo-o sentir-se verdadeiramente vivo.

### Fases da Implementação:

*   **[⬜️ A Fazer] Fase 1: Ciclo Dinâmico de Dia/Noite, Clima e Calendário**
    *   **Tarefa:** Instruir a IA para atualizar proativamente o `worldState` (tempo, clima e data) após ações como descanso, viagem ou eventos narrativos significativos.
    *   **Tarefa:** Fazer com que as mudanças climáticas e a data tenham efeitos mecânicos e narrativos (ex: desvantagem em Percepção durante uma nevasca, festivais em certas épocas do ano, NPCs que reagem à passagem do tempo).
    *   **Tarefa:** Exibir a data e o clima atuais na interface do jogador através do `WorldStatePanel`.

*   **[⬜️ A Fazer] Fase 2: NPCs com Agência e Rotinas**
    *   **Tarefa:** Criar um mecanismo para que a IA processe o que NPCs importantes fazem "fora da tela" enquanto o jogador está ocupado.
    *   **Tarefa:** Aprimorar o prompt da IA para que ela narre as mudanças na vida dos NPCs quando o jogador os reencontrar, refletindo a passagem do tempo.

*   **[⬜️ A Fazer] Fase 3: Sistema de Notícias e Rumores**
    *   **Tarefa:** Implementar uma nova entidade no backend (ex: `WorldNews`) para registrar feitos heróicos ou eventos mundiais importantes causados pelo jogador.
    *   **Tarefa:** Ensinar a IA a consultar essas "notícias" e transformá-las em rumores que podem ser ouvidos em tavernas e cidades, aumentando a sensação de impacto do jogador no mundo.

*   **[⬜️ A Fazer] Fase 4: Mapa do Mundo Interativo**
    *   **Tarefa:** Desenvolver um componente de UI no frontend que renderize um mapa.
    *   **Tarefa:** Usar os dados da entidade `JournalEntry` (locais descobertos) para popular o mapa dinamicamente, permitindo que o jogador visualize sua jornada e planeje seus próximos passos.

---

## TASK-2: Mundo Vivo - NPCs, Monstros e Locais Persistentes (Concluído)

- **Objetivo:** Transformar o mundo do jogo em um ecossistema persistente e reativo, onde NPCs, monstros únicos e locais descobertos se tornam entidades persistentes no banco de dados, vinculadas a uma sessão de jogo.
- **Status:** Concluído. A fundação para um mundo com memória, NPCs únicos e consequências duradouras está implementada e funcional.

---

## TASK-1: Reestruturação da Plataforma Cliente-Servidor (Concluído)

- **Problema:** O frontend operava com lógicas antigas de estado no cliente, não aproveitando o potencial do novo backend.
- **Objetivo:** Refatorar completamente a aplicação para alinhar frontend e backend, adotando as melhores práticas de arquitetura para criar uma plataforma rápida, estável e imersiva.
- **Status:** Concluído. Todas as fases, da 1.1 à 1.4 (com exceção dos testes de integração), foram implementadas com sucesso, resultando em uma arquitetura robusta e uma experiência de usuário significativamente melhorada.
