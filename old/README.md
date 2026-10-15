# old/ — dndai legado (arquivado em 2026-10-15)

Tudo que existia antes da recriação v2 (servidor Node + cliente Godot). Nada foi apagado; o histórico git é preservado (`git log --follow`). Tag do último estado: `legacy-flutter-final`.

| Pasta | O que era |
|---|---|
| `engine/` | motor CLI (Node, SQLite) + Mestre via Shellby/ChatGPT + TTS Kokoro. Ainda serve o conector `dndai-conector` (systemd) apontando para cá. |
| `app/` | app Flutter (substituído pelo cliente Godot em `game/`) |
| `mesa/` | mesa React antiga |
| `backend/`, `src/`, `apps/`, `packages/`, `services/`, `infra/`, `docker/` | PENAI (Fastify/Temporal/Qdrant/Gemini) e frontend Next |
| `data/` | SRD 2014 (substituído pelo 5e-database 2024 em `data/5e-database`) |
| `mom/` | submódulo `edsoncantuaria/mom` |

Reaproveitado na v2: ponte Shellby/Mestre, memória (contexto, capítulos, recall), TOON, guarda anti-alucinação, TTS de 3 vozes, fontes. Veja `docs/ARQUITETURA.md` na raiz.
