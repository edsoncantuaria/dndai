# MOM — manter contexto persistente (`mom/`)

Pasta: **`mom/context/`** (versionada no git) · Vault local opcional: **`mom/.vault/`** (gitignored)

Rule automática: `.cursor/rules/dndai-mom-context.mdc` · Skill: `dndai-mom-context`

---

## Prompt sempre ativo (colar em User Rules ou iniciar chat)

Use este bloco se quiser reforçar além da rule `alwaysApply`:

```
Contexto MOM (obrigatório):

INÍCIO — antes de codar ou responder:
1. Leia mom/context/INDEX.md e entradas active com tags da tarefa.
2. Leia trecho pertinente de docs/ECOSSISTEMA.md ou docs/DESIGN_FRONTEND.md.
3. Se MCP MOM disponível: mom_recall("<tema>").
4. Resuma em até 5 bullets o que recuperou.

DURANTE — se descobrir decisão, bug raiz ou convenção nova:
- Anote mentalmente para distill; não deixe só no chat.

FIM — antes de encerrar a tarefa:
1. Criar/atualizar mom/context/<area>-<slug>.md (formato na rule dndai-mom-context).
2. Atualizar mom/context/INDEX.md.
3. Se comportamento mudou → docs vivos (+ ADR se arquitetura).
4. Nunca commitar secrets.

MOM = dev/agentes. NÃO confundir com memória de partida (Qdrant/SessionFact/Redis).
```

---

## Início de sessão (RECALL)

```
Recall MOM — tarefa: "<descreva em 1 linha>"

1. mom/context/INDEX.md + arquivos active relevantes
2. ECOSSISTEMA ou DESIGN_FRONTEND (seção pertinente)
3. mom_recall se MCP configurado

Entregue: 5 bullets de contexto + arquivos mom/context lidos + gaps que ainda não estão no MOM.
```

---

## Fim de sessão (DISTILL)

```
Distill MOM — encerrar tarefa

Persistir em mom/context/ tudo que um próximo agente repetiria sem saber:
- decisões, bugs sistêmicos, convenções, config dev

Checklist:
- [ ] mom/context/<area>-<slug>.md criado ou atualizado
- [ ] mom/context/INDEX.md atualizado (título, status, tags)
- [ ] docs/ECOSSISTEMA.md ou DESIGN_FRONTEND.md se comportamento mudou
- [ ] ADR em docs/adr/ se decisão arquitetural
- [ ] Entradas obsoletas marcadas superseded

Entregue: lista do destilado + paths tocados. Sem secrets.
```

---

## Distill rápido (uma decisão)

```
Distill MOM — título: "<Título>"
Por quê: <1–2 frases>
Bullets: <3 bullets o quê>
Armadilhas: <opcional>
Doc: <ECOSSISTEMA § … | DESIGN § … | ADR NNNN>
Gravar em mom/context/<area>-<slug>.md e atualizar INDEX.
```

---

## Mid-session (checkpoint)

```
Checkpoint MOM — o que aprendemos até aqui?

Liste decisões/fixes ainda não gravados em mom/context/.
Se houver ≥1 item não trivial, distill agora (não esperar o fim).
```

---

## Formato de entrada (`mom/context/*.md`)

```markdown
# Título curto

Status: active | superseded
Atualizado: YYYY-MM-DD
Doc: ECOSSISTEMA § … | DESIGN § … | ADR NNNN

## Por quê
- …

## O quê (bullets)
- …

## Armadilhas
- …

## Comandos / paths
- …
```

Tags sugeridas no INDEX: `ws` `ia` `gemini` `oss` `fila` `frontend` `auth` `dev` `docker` `combate` `memoria` `docs`
