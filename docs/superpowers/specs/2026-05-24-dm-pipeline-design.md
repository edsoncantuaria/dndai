# Design: Pipeline do Mestre + Elenco (2026-05-24)

## Objetivo

Convergir narrativa, regras e rolagens em um único fluxo de **mestre virtual**: o servidor decide e rola; a IA narra o resultado.

## Fluxo

1. Cena → IA (`narration_only`)
2. Ação → motor valida → rolagem automática (opcional) → IA narra desfecho
3. Combate → mesmo pipeline com hints de combate

## Elenco

`session_cast_members` por sessão; PJ auto-registrado; API REST; painel na aba Crônica.

## Mundo assíncrono

Heróis do cofre na mesma região em outra sessão → rumores no prompt.

## Próximas fases

- Classificador de ação livre via LLM (além de heurística PT)
- Multi-jogador real (presença entre usuários)
- Importar personagem do cofre no elenco com UI
