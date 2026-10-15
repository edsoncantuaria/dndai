# Crônicas de Aventuras — app móvel (Expo)

App **Android e iOS** com intro nativa orbital + **WebView do mesmo Next.js** da web (login, hub, sessão, WS, homebrew, mesa).

## Por que WebView?

| Abordagem | Paridade com a web | Esforço |
|-----------|-------------------|---------|
| **WebView** (escolhida) | Imediata — um só cliente | Shell + intro |
| UI 100% nativa | Reimplementar tudo | Meses |

## Login / “Failed to fetch”

O WebView injeta `window.__DNDAI_RUNTIME_CONFIG__` com a **mesma API** do `apps/mobile/.env` (IP da LAN). Sem isso, o Next tentava `localhost:8071` no celular e o login falhava.

Regenere os envs: `npm run lan:env` na raiz.

## Um comando (recomendado)

Na **raiz do monorepo**, mesma rede Wi‑Fi que o celular:

```bash
npm run dev:mobile:lan
```

Isso:

1. Detecta o IP da máquina (`192.168.x.x`)
2. Gera `.env.local` (Next) e `apps/mobile/.env` (Expo)
3. Sobe API, worker Temporal e Next em `0.0.0.0` (se ainda não estiverem rodando)
4. Abre o Expo com `--lan` para o Expo Go

Escaneie o QR no celular → intro nativa → **mesmo jogo** da web.

### Flags

| Flag | Efeito |
|------|--------|
| `--expo-only` | Só Expo; API/Next já rodando |
| `--no-worker` | Sem worker Temporal (narração assíncrona off) |
| `--skip-infra` | Não tenta subir Postgres via Docker |

## Outros scripts (raiz)

| Comando | Uso |
|---------|-----|
| `npm run lan:env` | Só regenera `.env.local` + `apps/mobile/.env` |
| `npm run dev:lan` | Next na LAN (API em outro terminal) |
| `npm run dev:all:lan` | Stack Docker dev com `NEXT_PUBLIC_*` na LAN |

## Manual

### 1. Infra + API

```bash
npm run dev:infra
cd backend && npm run dev:penai
cd backend && npm run worker:temporal   # outro terminal
```

### 2. URLs LAN

```bash
npm run lan:env
npm run dev          # Next em 0.0.0.0:9002
```

### 3. Expo

```bash
cd apps/mobile && npm run start:lan
```

## Produção

1. Deploy HTTPS do Next
2. `EXPO_PUBLIC_WEB_APP_URL=https://app.seudominio.com` no build EAS
3. `eas build`

## Stack

Expo SDK **54** (`expo ~54.0.33`) — compatível com Expo Go · WebView · intro com `Animated` nativo (sem Reanimated)
