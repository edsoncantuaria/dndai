# Mesa — dndai

Mesa visual do jogo ("Baldur's Gate 3 narrado"). O jogador joga pela mesa: fala com o Mestre (ChatGPT) na caixa de
diálogo (`POST /api/messages`), lê a narração com digitação e voz, acompanha o estado do motor (`engine/`, `dnd serve`)
em tempo real pelo SSE e rola os dados 3D pedidos.

Stack: Vite + React + TypeScript + Tailwind v4, sem backend próprio. Contrato: [`../engine/API.md`](../engine/API.md),
espelhado em [`src/api/types.ts`](src/api/types.ts).

## Comandos

```bash
npm install
npm run dev:mock    # mesa com mock local de GameView (sem motor), http://localhost:5180
npm run dev         # mesa contra o motor em http://127.0.0.1:8790 (rode `dnd serve` antes)
npm run typecheck
npm run build       # gera dist/
```

Servir a mesa pronta pelo próprio motor (mesma origem, sem CORS):

```bash
npm run build && dnd serve --static ../mesa/dist   # abra http://127.0.0.1:8790
```

## Configuração

| Parâmetro de URL | Variável | Padrão |
|---|---|---|
| `?api=` | `VITE_API_URL` (em `.env.development`) | dev: `http://127.0.0.1:8790` · build: mesma origem |
| `?campaign=` | — | obrigatório; sem ele a mesa lista `/api/campaigns` para escolher (entra direto se houver só uma) |
| `?token=` | — | só com `dnd serve --token`: vai para o `sessionStorage` e sai da URL; um 401 pede o token |
| `?mock=1` | `VITE_MESA_MOCK=1` | desligado |

O build usa caminhos relativos (`base: "./"`) para ser servido pelo `dnd serve --static`.

No modo mock, a caixa de diálogo responde com um Mestre simulado (fila → pensando → narração), e o botão **Mock**
(canto inferior direito) força: narração sem fala do jogador, falha da próxima resposta (testa o "Reenviar"), Mestre
offline (503), loot (moedas, item, XP, descoberta), pedidos de rolagem (normal, vantagem, desvantagem, ataque com dano, dano), combate, dano/cura e rolagem
resolvida pelo motor.

## Estrutura

- `src/api/` — tipos do contrato e cliente HTTP/SSE (`EventSource` com reconexão; relê o estado a cada `change`).
- `src/mock/` — fixture tipada e mock que aplica as mesmas regras de rolagem do API.md.
- Itens: o inventário e a hotbar mostram as ações que o motor permite em `ItemView.actions` (usar, equipar, guardar,
  empunhar, embainhar, largar) e chamam `POST /api/actions`; a reação dos NPCs (`NpcView.reaction`) aparece nos cartões.
  Avisos estilo BG3 (item recebido, moedas, XP, missões, descobertas, condições, reações) saem da comparação entre estados.
- `src/components/` — palco da narração (última fala do Mestre, markdown leve, digitação + voz pt-BR), caixa de diálogo
  com o Mestre, cena, NPCs, crônica (journal), hotbar, faixa de iniciativa,
  painel de abas (ficha, inventário, missões, mapa, fatos, dados) e o modal de rolagem 3D (`@3d-dice/dice-box`).
- `public/` — assets dos dados 3D (copiados de `@3d-dice/dice-box/dist/assets`), imagens cinematográficas e efeitos
  sonoros (Kenney, CC0) reaproveitados do projeto antigo.
