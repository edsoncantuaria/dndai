import 'package:flutter/material.dart';

import '../api/client.dart';
import '../state/game_controller.dart';
import '../theme.dart';
import 'dice.dart';
import 'fantasy/chrome.dart';
import 'fantasy/table.dart';
import 'fantasy/voice.dart';

/// Tela do jogo. O fluxo (SSE, rolagem obrigatória, ações) fica no [GameController]; a mesa só apresenta.
class GameScreen extends StatefulWidget {
  const GameScreen({
    super.key,
    required this.api,
    required this.campaign,
    required this.onLeave,
  });
  final ApiClient api;
  final String campaign;
  final VoidCallback onLeave;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  late final GameController game = GameController(widget.api, widget.campaign)
    ..start();
  bool _rollOpen = false;

  @override
  void initState() {
    super.initState();
    game.addListener(_maybeOpenRoll);
  }

  @override
  void dispose() {
    game.removeListener(_maybeOpenRoll);
    game.dispose();
    TableVoice.instance.stop();
    super.dispose();
  }

  /// O Mestre pediu rolagem: o modal abre sozinho e não fecha sem rolar (mas pode ser minimizado para ler a narração).
  void _maybeOpenRoll() {
    final pending = game.view?.pendingRolls ?? const [];
    if (pending.isEmpty || _rollOpen || !mounted) return;
    _rollOpen = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await showRollSheet(context, game, pending.first);
      _rollOpen = false;
      _maybeOpenRoll();
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: game,
      builder: (context, _) {
        final view = game.view;
        if (view == null) {
          return Scaffold(
            backgroundColor: Palette.leather,
            appBar: AppBar(
              backgroundColor: Palette.leather,
              title: Text(
                game.error == null ? 'Carregando…' : 'Crônica',
                style: displayStyle(size: 18),
              ),
              actions: [
                IconButton(
                  tooltip: 'Trocar campanha',
                  onPressed: widget.onLeave,
                  icon: const Icon(Icons.logout, color: Palette.gold),
                ),
              ],
            ),
            body: LeatherBackdrop(
              child: Center(
                child: game.error == null
                    ? const CircularProgressIndicator(color: Palette.gold)
                    : Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              game.error!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Palette.failure,
                                fontFamily: 'EBGaramond',
                                fontSize: 18,
                              ),
                            ),
                            const SizedBox(height: 16),
                            FilledButton.icon(
                              onPressed: game.refresh,
                              icon: const Icon(Icons.refresh),
                              label: const Text('Tentar novamente'),
                            ),
                          ],
                        ),
                      ),
              ),
            ),
          );
        }
        final table = GameTable(
          view: view,
          live: game.live,
          sending: game.sending,
          portraitBase: widget.api.baseUrl,
          onLeave: widget.onLeave,
          onSend: game.send,
          onListen: (key) => TableVoice.instance.toggle(
            widget.api.ttsUri(widget.campaign, key).toString(),
            key: key,
          ),
          onItem: (action, id) async {
            final err = await game.itemAction(action, id);
            return err ?? game.lastActionText;
          },
          onResource: (id, amount) async {
            final err = await game.useResource(id, amount);
            return err ?? game.lastActionText;
          },
          onLevelUp: game.levelUp,
          onLevelOptions: game.levelUpOptions,
          onRest: game.rest,
        );

        return table;
      },
    );
  }
}
