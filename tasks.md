# Próximas Tarefas e Melhorias para "Crônicas de Aventuras"

Este documento descreve os próximos grandes recursos e melhorias arquitetônicas planejadas para o projeto, com o objetivo de evoluir a plataforma.

**Nota sobre a Estrutura de Diretórios:**
- **Caminho do Frontend:** `/home/user/studio/`
- **Caminho do Backend:** `/home/user/studio/backend`

---

## TASK-1: Streaming de Respostas da IA via Cloud Function

- **Problema:** Atualmente, o frontend espera que o backend processe toda a resposta do Genkit/Gemini antes de exibi-la. Em narrações longas, isso pode causar uma pausa perceptível (1-3 segundos), quebrando a imersão.
- **Solução Proposta:**
    1.  **Refatorar a Lógica da IA:** Mover o `gameMasterFlow` do backend do Express para uma **Google Cloud Function** dedicada.
    2.  **Habilitar Streaming:** Configurar o fluxo no Genkit para que ele retorne a resposta da IA em tempo real, palavra por palavra (`stream`).
    3.  **Conexão Direta do Frontend:** Modificar o `gameService.ts` no frontend para chamar diretamente essa nova Cloud Function.
    4.  **Atualizar a UI:** Implementar a lógica no frontend para renderizar a resposta da IA à medida que os "pedaços" de texto chegam, criando um efeito de "digitação" em tempo real.
- **Benefícios:**
    - **Imersão Total:** Elimina a pausa de carregamento, fazendo com que o Mestre de Jogo pareça responder instantaneamente.
    - **Performance Perceptível:** O jogo se sentirá muito mais rápido e responsivo.
    - **Escalabilidade:** Desacopla a lógica de IA do servidor principal, permitindo que cada um escale de forma independente.

---

## TASK-2: Implementação de WebSockets para Modo Multiplayer

- **Problema:** A arquitetura atual de requisição/resposta (HTTP) só funciona para um jogador. Não há como o servidor "empurrar" atualizações para múltiplos clientes simultaneamente, o que é um requisito para o multiplayer.
- **Solução Proposta:**
    1.  **Adicionar Servidor WebSocket:** Integrar um servidor WebSocket (usando uma biblioteca como `ws`) ao backend Express.js existente.
    2.  **Gerenciamento de Salas:** Criar uma lógica no servidor para gerenciar "salas" de jogo. Os jogadores poderão criar, entrar e sair dessas salas.
    3.  **Sincronização de Estado:** Quando um jogador realizar uma ação, o backend processará, salvará no banco de dados e, em vez de responder apenas a um cliente, ele **transmitirá** a atualização de estado (nova narração, mudança no combate, etc.) via WebSocket para **todos os jogadores** conectados na mesma sala.
    4.  **Adaptar o Frontend:** O frontend precisará estabelecer e manter uma conexão WebSocket com o servidor e "ouvir" por essas atualizações para re-renderizar a interface em tempo real para todos os jogadores do grupo.
- **Benefícios:**
    - **Fundação para Multiplayer:** É o pilar técnico que torna o modo cooperativo possível.
    - **Comunicação Instantânea:** Garante que todos os jogadores vejam a mesma coisa ao mesmo tempo.
    - **Interatividade em Tempo Real:** Abre portas para funcionalidades como um chat de grupo ou a visualização em tempo real do inventário dos companheiros.

---
