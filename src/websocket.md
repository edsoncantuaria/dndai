# Roteiro para Implementação Multiplayer com WebSockets

Este documento descreve o plano e a arquitetura propostos para a implementação de um modo multiplayer cooperativo para o "Crônicas de Aventuras".

## 1. Visão Geral

O objetivo é transformar a experiência de RPG de texto solo em uma aventura cooperativa online, onde um pequeno grupo de jogadores (2 a 3) pode compartilhar o mesmo mundo e interagir com um único Mestre de Jogo (IA). A jogabilidade será baseada em turnos sequenciais, garantindo que cada jogador tenha seu momento de agir e que a história progrida de forma ordenada.

- **Gerenciamento de Sessão**: Os jogadores poderão criar salas de jogo privadas (protegidas por senha) ou entrar em salas existentes.
- **Persistência**: O estado completo da sessão (personagens dos jogadores, histórico da aventura, estado do mundo) será salvo no servidor, permitindo que o grupo continue a aventura mais tarde.
- **Inteligência de Grupo**: A IA será adaptada para gerenciar um grupo, dirigindo-se a jogadores específicos, criando desafios balanceados para múltiplos heróis e narrando eventos que afetam todo o grupo.

## 2. Arquitetura Proposta

### 2.1. Tecnologia Principal: WebSockets

A comunicação em tempo real entre os jogadores e o servidor é crucial. **WebSockets** são a escolha ideal para isso.

- **Por que WebSockets?**: Eles fornecem um canal de comunicação bidirecional e persistente entre o cliente (navegador do jogador) e o servidor. Isso permite que o servidor envie atualizações instantâneas (como a narração do Mestre ou a ação de outro jogador) para todos os clientes conectados sem que eles precisem fazer novas requisições.
- **Implementação**: Usaremos uma biblioteca como a `ws` em um backend Node.js para criar um servidor WebSocket. O frontend (React/Next.js) se conectará a este servidor ao entrar em uma sala de jogo.

### 2.2. Backend do Servidor

Será necessário um backend leve para orquestrar as sessões de jogo.

- **Responsabilidades**:
    - Gerenciar conexões WebSocket.
    - Autenticar jogadores em salas.
    - Manter o estado de cada sessão de jogo ativa (quem está na sala, de quem é o turno, o histórico de log completo).
    - Receber a ação de um jogador, encaminhá-la para a IA (junto com o estado completo do jogo) e, em seguida, transmitir a resposta do Mestre para todos os jogadores na sala.
    - Persistir o estado do jogo em um banco de dados simples (por exemplo, Firestore ou um arquivo JSON no servidor) quando a sessão terminar.

### 2.3. Fluxo de Jogo Multiplayer

O loop de jogo será adaptado para um modelo baseado em turnos.

1.  O Mestre de Jogo (IA) descreve a cena para todo o grupo.
2.  O servidor informa que é o turno do **Jogador 1**. A interface dele é habilitada para ação.
3.  O **Jogador 1** envia sua ação (ex: "Eu ataco o goblin").
4.  O servidor recebe a ação, atualiza o estado do jogo e o envia para a IA.
5.  A IA processa a ação e retorna a consequência.
6.  O servidor transmite a narração do Mestre para **todos os jogadores** na sala.
7.  O servidor informa que é o turno do **Jogador 2**. O ciclo se repete.

A IA será instruída a gerenciar esse fluxo, por exemplo: `O Mestre de Jogo descreve o ataque de Elara. "O goblin cambaleia para trás! Agora, Baelor, o que você faz?"`.

### 2.4. Estrutura de Mensagens (JSON)

Toda a comunicação via WebSocket será feita com objetos JSON padronizados para garantir clareza.

**Exemplo de mensagem Cliente -> Servidor:**
```json
{
  "type": "PLAYER_ACTION",
  "payload": {
    "actionText": "Eu investigo a estátua no centro da sala.",
    "playerId": "baelor_id_123"
  }
}
```

**Exemplo de mensagem Servidor -> Cliente:**
```json
{
  "type": "GAME_STATE_UPDATE",
  "payload": {
    "logEntries": [
        { "type": "narration", "content": "Baelor se aproxima da estátua..." }
    ],
    "activePlayerId": "gimli_id_456",
    "updatedCharacters": { ... }
  }
}
```

## 3. Gerenciamento de Chaves de API

Sua ideia de um sistema de failover de chaves de API é excelente e pode ser implementada no backend.

- **Lógica do Servidor**: O servidor manterá uma lista das chaves de API de todos os jogadores na sessão.
- **Uso Primário**: Ele tentará primeiro usar a chave do jogador ativo no turno atual.
- **Failover**: Se a chamada para a API do Gemini falhar com um erro de autenticação ou cota, o servidor tentará automaticamente a chamada novamente usando a chave do próximo jogador na lista.
- **Notificação**: Se todas as chaves falharem, o servidor enviará uma mensagem de erro para o grupo, informando sobre o problema e pausando o jogo.

## 4. Desafios e Limitações a Considerar

- **Complexidade do Estado**: Gerenciar o estado de múltiplos jogadores e um histórico de jogo completo aumenta a complexidade. O servidor precisa ser robusto.
- **Custo de Tokens**: Enviar o estado de 3 personagens mais um histórico de jogo longo para a IA a cada turno consumirá significativamente mais tokens. Isso pode exigir o uso de modelos com janelas de contexto maiores (como Gemini 1.5 Pro) e implica um custo maior.
- **Tratamento de Desconexões**: É preciso definir uma lógica para o que acontece quando um jogador se desconecta. O jogo pausa? A IA assume o controle do personagem temporariamente?
- **Infraestrutura**: Requer a hospedagem de um servidor backend persistente, além da aplicação Next.js.

Este roteiro fornece uma base sólida para construir uma experiência multiplayer rica e imersiva, expandindo o incrível potencial do "Crônicas de Aventuras".
