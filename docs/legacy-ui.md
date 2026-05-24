# UI legada vs v2

UI v2 está **ativa por padrão**. Para forçar a interface antiga:

```bash
NEXT_PUBLIC_UI_V2=false npm run dev
```

## Mapeamento de substituição

| Legado | Substituto (v2) |
|--------|------------------|
| `GameMenuContent` monólito (hub premium) | `GameMenuContentLegacy` + roteador fino em `GameMenuContent.tsx` |
| Hub inline em `GameMenuContent` | `features/hub/HubShell` |
| `GameScreen` / `GameScreenLegacy` | `features/gameplay/GameplayScreen` + `GameplayShell` |
| `NewCombatTracker` (legacy branch) | `features/gameplay/combat/GameplayCombatTracker` |
| `NewCharacterCreation` | `features/character-create/CharacterCreationWizard` |
| `HomebrewStore` (fullscreen) | `features/homebrew/HomebrewStorePage` (embeds store) |
| `TranslationStudio` variant `legacy` | `features/homebrew/TranslationStudioPage` |

## O que ainda não foi removido

- **HomebrewStore.tsx** — ainda contém o motor de CRUD; a página v2 apenas envolve com layout Dnd.
- **GameMenuContentLegacy.tsx** — ~500 linhas para flag `UI_V2=false`.
- **GameScreenLegacy** — gameplay monolítico completo.

Remoção física desses arquivos só após período sem uso da flag legada.

## CSS

- Tokens canônicos: `src/design-system/tokens.css`
- Utilitários globais: `src/app/globals.css` (vinheta, dice flash, `.hb-form`, legado `.menu-button`)
