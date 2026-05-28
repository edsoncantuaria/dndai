---
name: dndai-documentation
description: >-
  Mantém docs/ECOSSISTEMA.md e docs/DESIGN_FRONTEND.md alinhados ao código.
  Use ao concluir features de arquitetura, IA, filas, UI v2 ou memória/Qdrant.
---

# Manutenção da documentação viva

## Quando usar

- Feature altera fluxo jogador, WS, fila, motor, IA, memória ou UI v2.
- Usuário pede “atualizar documentação” ou consolidar conhecimento do projeto.
- Após P0–P5 ou item marcado ✅ em `TODO-ARQUITETURA.md`.

## O que editar

| Mudança | Documento |
|---------|-----------|
| Backend, IA, dados, filas, P*, homebrew servidor | `docs/ECOSSISTEMA.md` |
| Cores, estágios, gameplay shell, UX | `docs/DESIGN_FRONTEND.md` |
| Checklist / pacote revisão | `docs/VALIDACAO_SENIOR.md` |
| Memória agente dev (não partida) | `docs/MOM_DESENVOLVIMENTO.md` + vault MOM |
| Tarefa / status | `TODO-ARQUITETURA.md` |

**Não** recriar `ARQUITETURA_*` separados — conteúdo vai nos dois vivos.

## Regras de escrita

1. **Não inventar** — confirmar no código antes.
2. **ECOSSISTEMA:** evitar mapa de pastas; explicar comportamento e invariantes.
3. **DESIGN:** referenciar [site D&D](https://www.dungeonsanddragons.com/) como inspiração; tokens `dnd.*`; sem assets WotC.
4. Atualizar data “Última revisão” no topo do doc tocado.
5. MOM: distinguir agente de código (`mom/`) vs runtime Qdrant/SQL.

## Não fazer

- Popular `docs/archive/` com docs novos.
- Duplicar fluxo inteiro entre os dois vivos — cross-reference em uma frase só.

## Checklist

- [ ] Seção correta atualizada
- [ ] Glossário/roadmap se conceito novo
- [ ] TODO-ARQUITETURA se item de roadmap
- [ ] Rule `dndai-documentation-hub.mdc` ainda coerente (só se mudar lista de skills/docs)
