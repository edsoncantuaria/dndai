# Arquitetura

## Camadas

| Camada | Onde | Responsabilidade |
|---|---|---|
| SRD | `server/src/srd/`, `data/5e-database` | Importa as 25 coleções 2024 para `srd.db` (FTS5, referências resolvidas, overlay pt-BR oficial + glossário). Falha se aparecer coleção nova ou referência órfã. |
| Núcleo | `server/src/core/` | Regras 2024 lidas do SRD: criação, progressão, mecânica, mundo, escopo. Toda escrita passa pelo **ledger**. |
| Mestre | `server/src/mestre/` | Beat (`submit`), guarda de narração, contexto TOON, capítulos, recall, conector MCP, fila Shellby. |
| API | `server/src/api.ts`, `view.ts` | HTTP+WebSocket para o cliente; `GET /api/c/:slug/view` é a única fonte do que a tela mostra. |
| Cliente | `game/` | Godot 4.7. Só apresenta e envia; nenhuma regra. |
| Voz | `tts/` | Kokoro ONNX local; narrador, `{m}` e `{f}` com vozes diferentes. |

## Ledger (estado e undo)

`world.db` tem as tabelas de estado e o `ledger` (ops já resolvidas: dados rolados, ids alocados). Estado = projeção do ledger. `Campaign.atomic()` agrupa commits (um passo de undo, invariantes conferidas no fim); `undo()` apaga o último lote e reaplica o ledger. Ids curtos: `pc`, `n1` NPC, `m1` monstro, `l1` local, `i1` item, `q1` missão.

## Um turno

1. Jogador age → `POST /act` abre o turno e põe a mensagem na fila (`chat.db`) com a cena (delta TOON).
2. A fila entrega ao Shellby/ChatGPT. O Mestre chama `dnd_agir {beat}` (1+ vezes): mecânica sem `narration` (rolagens do motor), depois `narration`+`summary` fecha o turno.
3. O motor valida (ops estritas, escopo, guarda de narração), grava, fecha capítulos (a cada 8 turnos) e avisa pelo WebSocket; o cliente busca `/view`, anima os dados 3D (`rolls[].faces`) e fala a narração (`/tts`).

## Memória

Cena em TOON (delta desde a última leitura), capítulos a cada 8 turnos fechados, `resume` por arcos, `recall` por busca, consolidação de memória de NPC (`memory.consolidate`). Conversa nova no ChatGPT a cada capítulo.

## Segurança

Conector MCP por campanha (URL com segredo próprio, escopo isolado, auditoria). API exige `DNDAI_TOKEN` fora do loopback. O Mestre não tem shell, arquivo nem SQL: só `dnd_ler` e `dnd_agir`.
