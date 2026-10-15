# Crônicas — app (Flutter)

App do jogador, **mobile first** (Android, iOS) e também web. Substitui a mesa React (`../mesa`). Fala com o motor pelo contrato [`../engine/API.md`](../engine/API.md): toda regra fica no motor, o app só apresenta e envia.

- **Celular:** a narração ocupa a página. Vida, lugar e retratos ficam numa barra compacta que abre ao toque ou ao arrastar. Saídas e o campo livre ficam embaixo, sem cobrir o texto. A barra rápida abre ficha, bolsa, grimório, diário, pessoas e mapa.
- **Tela larga (≥ 900 px de largura do layout, web/tablet):** narração no centro, situação à esquerda e doca de painéis à direita.
- **Tempo real:** SSE (`/api/events`), com reconexão automática e releitura periódica.
- **Dados 3D nativos** (`lib/dice3d/`, Dart puro, sem WebView): d4, d6, d8, d10, d12, d20 como sólidos reais, física de corpo rígido (gravidade, quique, atrito, colisão com a mesa e entre dados), iluminação e sombras. Arremesso por gesto (direção e força) ou botão. O valor sai de `Random.secure()`; a física é simulada e as faces são renumeradas para que a face que realmente cai para cima mostre esse valor (testado em centenas de arremessos). O motor confere e calcula o resultado.
- **Rolagem não fica para depois:** o modal abre sozinho e não fecha sem rolar (o motor também bloqueia mensagens, ações e turno novo até a rolagem).
- **Itens:** só aparecem as ações que o motor permite agora (`ItemView.actions`).
- **Narração:** efeito de digitação (toque para pular), markdown leve; as marcas de voz `{m}`/`{f}` ficam ocultas.

## Rodar

```bash
flutter pub get
flutter run -d chrome                 # web (dev)
flutter run                           # celular/emulador conectado
flutter test                          # dados 3D, SSE e a mesa fantasia (inclui goldens)
flutter build web --release           # build web
flutter build apk --release           # Android
```

Servir a versão web pelo próprio motor (mesma origem, sem CORS):

```bash
../engine/bin/dnd serve --static ../app/build/web   # abre em http://127.0.0.1:8790/?campaign=<slug>
```

No celular, o app usa o servidor da mesa já configurado no build: o jogador só informa suas credenciais. Fora do loopback, o `dnd serve` exige `--token`.

## Estrutura

| Arquivo | Papel |
|---|---|
| `lib/api/models.dart` | tipos do `GameView` (leitura tolerante) |
| `lib/api/client.dart`, `events_*.dart` | cliente HTTP + SSE (celular via stream HTTP, web via `EventSource`) |
| `lib/state/game_controller.dart` | estado da campanha, tempo real e envio das ações |
| `lib/ui/game_screen.dart` | liga o controlador à mesa e abre o modal de dados sozinho |
| `lib/ui/fantasy/table.dart` | mesa: diário, iniciativa, compositor, barra rápida e doca larga |
| `lib/ui/fantasy/drawers.dart` | ficha, bolsa, grimório, missões, pessoas e mapa |
| `lib/ui/fantasy/chrome.dart`, `sigils.dart` | pergaminho, couro, retrato e sigilos de classe |
| `lib/theme.dart`, `lib/ui/play_settings.dart` | paleta, Cinzel/EB Garamond, texto maior, vibração e sons |
| `lib/ui/dice.dart` | modal de rolagem (sem opção de adiar; gesto de arremesso) |
| `lib/dice3d/` | dados 3D: geometria (casco convexo), física e renderização em perspectiva |
| `lib/ui/narration.dart` | narração com digitação |
| `test/goldens/` | capturas da mesa, ficha, bolsa, grimório, diário e layout largo |
