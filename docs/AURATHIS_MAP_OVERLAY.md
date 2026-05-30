# Aurathis — mapa artístico e sobreposição 1:1

## Está tudo interligado?

Sim. O grafo de viagem em `backend/src/data/regionsSeed.json` (`links`) conecta as **28 regiões** (testado em BFS a partir da Cidadela do Aço-Luz: nenhuma região isolada).

Rotas de jogo = arestas do seed + links em `canonical_region_links` (Postgres) após `seed:penai-world`.

## Sistema de coordenadas (sobreposição perfeita)

| Campo | Valor |
|--------|--------|
| Canvas | **1100 × 780 px** |
| Espaço | `coordinateSpace: "pixel"` — sem reescala no frontend |
| Nós | `metadata.mapLayout.nodes[slug] = { x, y }` |
| Arte | `metadata.mapArt` → `/assets/AI/aurathis-continente-v3.svg` (mesmo tamanho) |

Marcadores (cidades, masmorras, rotas) usam **as mesmas coordenadas** que a arte. Trocar o PNG/SVG mantendo 1100×780 e os mesmos `nodes` = alinhamento preservado.

## Arte atual (v3)

- **Ficheiro:** `public/assets/AI/aurathis-continente-v3.svg`
- **URL no app:** `/assets/AI/aurathis-continente-v3.svg`
- **Geração:** `npm run map:generate-aurathis --prefix backend` — lê `regionsSeed.json` e desenha a camada `#canon-routes` com as **67 arestas jogáveis** (exclui links meta `aurathis` → reino).
- **Grafo:** ~74 rotas no seed, **93 POIs** (todos com `mapLayout.pois`; clusters manuais em `aurathisPoiClusterLayouts.ts`, aplicar com `npm run map:calibrate-pois`).
- Estilo de rota no SVG: cor/tracejado por `travelMode`; espessura/opacidade por `difficulty`; laranja tracejado = `isLocked`.
- Camada `#map-anchors`: círculos nas coordenadas exatas de `mapLayout.nodes` (opacidade baixa).

## Substituir por ilustração final (IA / Photoshop / Krita)

**Prompts prontos (anexar `aurathis-continente-v3.svg`):** [`docs/AURATHIS_MAP_AI_PROMPT.md`](./AURATHIS_MAP_AI_PROMPT.md)

1. Gerar fundo 1100×780 com o prompt (rotas e marcadores ficam no código do jogo).
2. Guardar em `public/assets/AI/` (ex.: `aurathis-continente-v4.png`).
3. Atualizar `regionsSeed.json` → `aurathis.metadata.mapArt.url` (e `version`).
4. Ajustar `mapLayout.nodes` só se deslocaste uma cidade no desenho.
5. `PENAI_WORLD_SEED_FORCE=true npm run seed:penai-world` — **apenas** se mudares rotas no seed.
6. Hard refresh no mapa mundi.

## Ferramentas no repo

- **Jogo:** `WorldMapModal` — fundo `mapArt` + marcadores + rotas `reachable` / `fromCurrent`.
- **Código layout:** `src/lib/aurathisMapArt.ts`, `src/utils/worldMapLayout.ts`.
- **Snapshot API:** `GET /api/v2/sessions/:id/world-map` inclui `metadata` por região (mundo = Aurathis).

## Lista de âncoras (slug → x, y)

Ver `backend/src/data/regionsSeed.json` → `aurathis.metadata.mapLayout.nodes`.

Cidades spawn (`intro`): `cidadela-do-aco-luz`, `vila-prata-lua`, `porto-corsario`.
