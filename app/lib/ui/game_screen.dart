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
  const GameScreen({super.key, required this.api, required this.campaign, required this.onLeave});
  final ApiClient api;
  final String campaign;
  final VoidCallback onLeave;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  late final GameController game = GameController(widget.api, widget.campaign)..start();
  bool _rollOpen = false;
  bool _rollMinimized = false;

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
    if (pending.isEmpty) {
      if (_rollMinimized) setState(() => _rollMinimized = false);
      return;
    }
    if (_rollOpen || _rollMinimized || !mounted) return;
    _rollOpen = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final minimized = await showRollSheet(context, game, pending.first);
      _rollOpen = false;
      if (minimized) {
        setState(() => _rollMinimized = true);
      } else {
        _maybeOpenRoll();
      }
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
              title: Text(game.error == null ? 'Carregando…' : 'Crônica', style: displayStyle(size: 18)),
              actions: [IconButton(tooltip: 'Trocar campanha', onPressed: widget.onLeave, icon: const Icon(Icons.logout, color: Palette.gold))],
            ),
            body: LeatherBackdrop(
              child: Center(
                child: game.error == null
                    ? const CircularProgressIndicator(color: Palette.gold)
                    : Padding(padding: const EdgeInsets.all(24), child: Text(game.error!, textAlign: TextAlign.center, style: const TextStyle(color: Palette.failure, fontFamily: 'EBGaramond', fontSize: 18))),
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
          onListen: (key) => TableVoice.instance.toggle(widget.api.ttsUri(widget.campaign, key).toString(), key: key),
          onItem: (action, id) async {
            final err = await game.itemAction(action, id);
            return err ?? game.lastActionText;
          },
          onResource: (id, amount) async {
            final err = await game.useResource(id, amount);
            return err ?? game.lastActionText;
          },
          onLevelUp: game.levelUp,
          onRest: game.rest,
        );

        if (_rollMinimized && view.pendingRolls.isNotEmpty) {
          final pending = view.pendingRolls.first;
          return Stack(
            children: [
              table,
              Positioned(
                top: MediaQuery.paddingOf(context).top + 60,
                left: 16,
                right: 16,
                child: Material(
                  elevation: 8,
                  borderRadius: BorderRadius.circular(12),
                  color: Palette.surface,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Palette.gold, width: 2),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.casino, color: Palette.gold),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text('ROLAGEM OBRIGATÓRIA', style: TextStyle(color: Palette.gold, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1)),
                              Text(pending.label, style: const TextStyle(color: Palette.text, fontWeight: FontWeight.w600, fontSize: 15)),
                            ],
                          ),
                        ),
                        FilledButton.icon(
                          style: FilledButton.styleFrom(backgroundColor: Palette.ember),
                          icon: const Icon(Icons.expand_less, size: 18),
                          label: const Text('Rolar Agora'),
                          onPressed: () {
                            setState(() => _rollMinimized = false);
                            _maybeOpenRoll();
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        }
        return table;
      },
    );
  }
}
