# Screenshots UI — antes / depois

Pasta para documentar o redesign por fase. **Não versionar PNGs grandes** sem necessidade; preferir WebP comprimido ou anexar no PR.

## Como capturar

1. `npm run dev` com UI v2 (padrão).
2. Viewports: **390×844** (mobile) e **1280×800** (desktop).
3. Salvar como `{fase}-{tela}-{viewport}.webp`.

Para “antes”, rodar com `NEXT_PUBLIC_UI_V2=false` na mesma rota.

## Checklist por fase

| Fase | Telas sugeridas | Arquivos (exemplo) |
|------|-----------------|-------------------|
| A — Auth / Intro | Login, intro, landing pós-auth | `a-auth-mobile.webp`, `a-intro-desktop.webp` |
| B — Hub | Menu principal, lista de sessões, cofre | `b-hub-main-desktop.webp`, `b-vault-mobile.webp` |
| C — Personagem | Wizard passo 1 e resumo final | `c-wizard-race-mobile.webp` |
| D — Homebrew | Lista grimório, editor item | `d-homebrew-desktop.webp` |
| E — Gameplay | Narrativa + 4 opções, dados 3D, combate | `e-gameplay-mobile.webp`, `e-dice-modal.webp` |
| F — Mobile | Bottom nav, painel mapa/inventário | `f-mobile-nav.webp` |
| G — Motion | (opcional) vídeo curto ou 2 frames transição hub→jogo | `g-transition.webp` |

## Estrutura

```
docs/ui-screenshots/
  README.md          ← este arquivo
  .gitkeep
  a-auth/
  b-hub/
  ...
```

Subpastas vazias podem receber `.gitkeep` até as capturas existirem.
