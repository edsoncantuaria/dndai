# dndai engine

Motor de mundo do dndai. É a **fonte única de verdade** de campanhas mestradas pelo ChatGPT via [Shellby MCP](../../../../Projetos/shellby-mcp). Substitui o backend PENAI (Fastify, Postgres, Temporal, Qdrant e Gemini), que fica no repo só para consulta.

```
Jogador ─▶ mesa (navegador) ─▶ dnd serve :8790 ─MCP─▶ dnd mestre :8791 (MCP dndai-mestre)
                ▲                                          │ MCP local (subagent_run/result)
                │ SSE: estado + narração                    ▼
                │                                    Shellby :3333 ─▶ ChatGPT Web (1 conversa por campanha)
                │                                                        │ shell via Shellby
                └──────────── campaigns/<slug>/world.db ◀── bin/dnd ◀────┘
```

Também dá para jogar direto no ChatGPT (sem mesa), usando a skill.

- **Sem infraestrutura:** Node ≥ 22.18 roda o TypeScript direto e o banco é `node:sqlite` com FTS5 para a memória. Dependências: `zod` e o SDK oficial de MCP.
- **Anti-alucinação:** o Mestre só muda o mundo por `apply` (lote validado e atômico). Toda rolagem é feita pelo motor ou pela mesa. O `context` lista exatamente quem está em cena, o que cada NPC lembra e o que é fato.
- **Mundo vivo:** NPCs com persona, rotina, atitude e memórias próprias. Agendas (relógios) e eventos avançam sozinhos quando o tempo passa.
- **Turnos com rollback:** `turn begin` guarda um backup e `dnd undo` restaura o estado anterior ao turno.

## Uso

```bash
npm install                 # uma vez (zod)
npm test                    # testes do motor
bin/dnd help
bin/dnd campaign new minha --name "Minha Campanha" --premise "..." --tone "..."
bin/dnd -c minha context
```

Skill do Mestre: [`skill/SKILL.md`](skill/SKILL.md). O Shellby a carrega de `<workspace>/skills/mestre-dndai` (symlink para esta pasta). No ChatGPT: *"use a skill mestre-dndai e vamos jogar"*.

## Mestre via servidor (MCP dndai-mestre)

```bash
bin/dnd mestre                 # MCP em http://127.0.0.1:8791/mcp; precisa do Shellby rodando (:3333)
bin/dnd serve --static ../mesa/dist
```

- Cada campanha usa o escopo `x-openai-session: dndai-<slug>` no Shellby, com o subagent `mestre-N`: uma conversa persistente no ChatGPT por campanha.
- A conversa fica em `campaigns/<slug>/chat.db`, separada do mundo (o `undo` não apaga mensagens).
- Ferramentas MCP: `mestre_enviar`, `mestre_conversa`, `mestre_reiniciar` e `campanhas`. Qualquer cliente MCP (Claude Code, Codex, automações) pode jogar por elas.
- Rode **um** `dnd mestre` por servidor: ele é o único que entrega mensagens ao ChatGPT.

## Conector "dndai" no ChatGPT (permanente)

O Mestre (ChatGPT) joga pelas ferramentas `dnd_ler`/`dnd_agir` do conector MCP `dndai`, sem shell (`dnd conector`). Neste servidor:

| Peça | Onde |
|---|---|
| Conector MCP | serviço systemd de usuário `dndai-conector` (`dnd conector --port 8794`) |
| Túnel | serviço `dndai-tunnel` (túnel Cloudflare nomeado `dndai`, config `~/.cloudflared/dndai.yml`) |
| URL pública | `https://dndai.cloudive.com.br/mcp/<segredo>`; o segredo fica em `campaigns/conector-secret` (600). O túnel só expõe `/mcp/<hex>` e `/healthz`. |
| ChatGPT | Plugins → Adicionar → servidor MCP personalizado, "Sem autenticação", permissão "Permitir todas as ferramentas" |

```bash
systemctl --user status dndai-conector dndai-tunnel
journalctl --user -u dndai-conector -f
```

Para trocar o segredo: apague `campaigns/conector-secret`, rode `systemctl --user restart dndai-conector` e atualize a URL do plugin no ChatGPT.

## App (Flutter) e mesa visual

O app do jogador agora é [`../app`](../app) (Flutter, mobile first + web). A mesa React em `../mesa` continua só até a migração ser confirmada.

## Mesa visual (legado)

```bash
bin/dnd serve --static ../mesa/dist                     # http://127.0.0.1:8790/?campaign=<slug>
DNDAI_TOKEN=<segredo> bin/dnd serve --host 0.0.0.0     # fora do loopback, o token é obrigatório
```

Contrato da API: [`API.md`](API.md). Para publicar no servidor, aponte um túnel (cloudflared) para a porta do `dnd serve` e abra a mesa com `?campaign=<slug>&token=<segredo>`.

## Voz da narração (TTS local)

```bash
sudo apt install espeak-ng ffmpeg   # uma vez
npm run tts                         # serviço em http://127.0.0.1:8795; na 1ª vez baixa o modelo (~340 MB)
```

[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) em ONNX, no CPU e sem custo, roda no `engine/tts` (Python via `uv`).
O narrador usa a voz Santa. As falas que o Mestre marca com `{m}` ou `{f}` usam Alex ou Dora. Tudo a 0,84 de velocidade.
O `dnd serve` expõe a voz em `GET /api/tts`. O áudio sai frase a frase em MP3, com o 1º som em cerca de 1 s, e fica em cache em `tts/cache/`.
Para mudar vozes ou velocidade, edite o topo de `tts/server.py` e troque `VERSION`, para o cache antigo não ser reaproveitado.

## Variáveis

| Variável | Padrão | Uso |
|---|---|---|
| `DNDAI_HOME` | `engine/campaigns` | onde ficam as campanhas (gitignored) |
| `DND_CAMPAIGN` | — | campanha padrão do shell (a skill usa `-c` explícito) |
| `DNDAI_TOKEN` | — | token da API da mesa |
| `DNDAI_CORS_ORIGINS` | — | origens extras permitidas (separadas por vírgula) |
| `DNDAI_SHELLBY_URL` | `http://127.0.0.1:3333/mcp` | MCP do Shellby usado pelo `dnd mestre` |
| `DNDAI_MESTRE_URL` | `http://127.0.0.1:8791/mcp` | MCP dndai-mestre usado pelo `dnd serve` |
| `DNDAI_TTS_URL` | `http://127.0.0.1:8795` | serviço de voz usado pelo `dnd serve` |
| `DNDAI_TTS_PORT` / `DNDAI_TTS_CACHE` | `8795` / `tts/cache` | porta e cache do serviço de voz |
| `DNDAI_ESPEAK_LIB` / `DNDAI_ESPEAK_DATA` | do sistema | espeak-ng fora do caminho padrão |
| `DNDAI_MESTRE_TOKEN` | — | token do MCP dndai-mestre |
| `DNDAI_SRD_DIR` | `data/srd/2014/normalized` | snapshot SRD para `srd` e `create.npc {srd}` |

## Código

| Arquivo | Responsabilidade |
|---|---|
| `src/db.ts` | schema SQLite, transação, versão do mundo |
| `src/campaign.ts` | campanhas, backups e restauração |
| `src/world.ts` | entidades, referências, tempo e dinheiro |
| `src/rules.ts`, `src/dice.ts` | núcleo 5e e dados |
| `src/mechanics.ts` | testes, ataques, dano, morte, descanso, nível, pedidos de rolagem |
| `src/simulation.ts` | passagem do tempo, rotinas, agendas, eventos, viagem, combate |
| `src/ops.ts` | lote `apply` (única via de mudança narrativa) |
| `src/context.ts` | `context`, `resume`, `show`, `recall` (visão do Mestre, com segredos) |
| `src/view.ts`, `src/server.ts` | visão do jogador e API HTTP da mesa (sem segredos) |
| `src/master/` | MCP dndai-mestre: fila de conversa, cliente do Shellby, servidor MCP |
| `src/cli.ts` | CLI `dnd` |
