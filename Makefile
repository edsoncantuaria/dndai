# Sync contexto MOM + docs entre PCs
#   make sair-pc              agente gera commit + push
#   make sair-pc MSG="…"      commit manual + push
#   make chegar-pc            pull dndai + mom
#   make contexto-status      o que falta commitar/pushar

.PHONY: sair-pc chegar-pc contexto-status help

MSG ?=

sair-pc:
ifeq ($(strip $(MSG)),)
	npm run context:sync -- push --commit
else
	npm run context:sync -- push --commit "$(MSG)"
endif

chegar-pc:
	npm run context:sync -- pull

contexto-status:
	npm run context:sync -- status

help:
	@echo "Contexto dev (MOM) — sync entre PCs"
	@echo ""
	@echo "  make sair-pc              agente gera mensagem, commit + push"
	@echo "  make sair-pc MSG=\"…\"      commit manual + push"
	@echo "  make chegar-pc            baixa contexto no PC de destino"
	@echo "  make contexto-status    dirty / ahead / behind"
