# Prompt — mensagem de commit para `make sair-pc`

Gere **uma linha** de commit (máx. 72 caracteres) em português para contexto MOM/docs.

Formato: `distill: <o quê>` ou `docs: <o quê>`

Regras:
- Foque no **por quê** / decisão, não lista de arquivos
- Sem markdown, aspas ou corpo multi-linha
- Se só INDEX atualizado: `distill: atualiza INDEX MOM`
- Se docs architecture: `docs: …`

Entrada: diff e arquivos alterados em `mom/context/`, `docs/`, `.cursor/` MOM.
