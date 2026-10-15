# dndai v2

RPG solo de **D&D 2024** em PT-BR, estilo Baldur's Gate 3, com **Mestre de IA** (ChatGPT via Shellby). O motor é a fonte única de verdade; o Mestre só muda o mundo por operações validadas.

```
Godot (game/) ──HTTP+WS──▶ server/ (Node 24, SQLite) ──MCP──▶ Shellby ─▶ ChatGPT (Mestre)
                              │                                    ▲
                              ├─ srd.db ◀── data/5e-database (2024)│ dnd_ler / dnd_agir (conector MCP)
                              └─ tts/ (Kokoro, 3 vozes) ◀── /api/c/:slug/tts
```

- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — como as peças se falam.
- [`docs/ESCOPO-JOGAVEL.md`](docs/ESCOPO-JOGAVEL.md) — o que o Mestre pode e não pode (contrato imposto em código).
- [`skill/SKILL.md`](skill/SKILL.md) — instruções do Mestre.
- Mundo pronto: **Auralis** (alta fantasia mística) em `server/src/world/`; masmorras e encontros em `server/src/core/`.
- [`old/`](old/README.md) — legado (engine 2014, Flutter, mesa React, PENAI), preservado.

## Rodar

```bash
git submodule update --init            # data/5e-database
cd server && npm install
npm run serve                          # API :8790 + conector MCP :8794 (importa o SRD na 1ª vez)
# jogar sem ChatGPT (Mestre de mentira, só para testar a mesa):
DNDAI_FAKE_MESTRE=1 npm run serve

/home/edson/Game/Godot/Godot_v4.7.2-stable_linux.x86_64 --path game   # cliente
```

Voz: `cd tts && uv sync` (1ª vez; precisa de `espeak-ng` e `ffmpeg`); o servidor sobe o serviço sozinho quando a mesa pede áudio.

## Testes

```bash
scripts/check.sh      # servidor (typecheck + testes) e cliente Godot (scripts, geometria dos dados)
```

## Variáveis

| Variável | Padrão | Uso |
|---|---|---|
| `DNDAI_HOME` | `server/campaigns` | onde ficam as campanhas (`world.db`, `chat.db`, segredos) |
| `DNDAI_TOKEN` | — | token da API; **obrigatório** fora do loopback |
| `DNDAI_SHELLBY_URL` | `http://127.0.0.1:3333/mcp` | Shellby que fala com o ChatGPT |
| `DNDAI_FAKE_MESTRE` | — | `1` usa um Mestre de mentira |
| `DNDAI_TTS_URL` | `http://127.0.0.1:8795` | serviço de voz |
| `DNDAI_SRD_DB` | `server/data/srd.db` | banco do SRD (gerado) |
| `DNDAI_URL` | `http://127.0.0.1:8790` | (cliente) servidor, sobrepõe a configuração salva |
