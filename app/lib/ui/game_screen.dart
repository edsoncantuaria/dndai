import 'package:flutter/material.dart';

import '../api/client.dart';
import '../state/game_controller.dart';
import '../theme.dart';
import 'dice.dart';
import 'panels.dart';
import 'scene_tab.dart';
import 'widgets.dart';

/// Tela do jogo. Mobile first: abas embaixo; em telas largas (web/tablet), cena + painel lado a lado.
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
  int _tab = 0;
  int _side = 0;
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
    super.dispose();
  }

  /// O Mestre pediu rolagem: o modal abre sozinho e não fecha sem rolar.
  void _maybeOpenRoll() {
    final pending = game.view?.pendingRolls ?? const [];
    if (_rollOpen || pending.isEmpty || !mounted) return;
    _rollOpen = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await showRollSheet(context, game, pending.first);
      _rollOpen = false;
      _maybeOpenRoll();
    });
  }

  static const _tabs = [
    (Icons.auto_stories_outlined, Icons.auto_stories, 'Cena'),
    (Icons.person_outline, Icons.person, 'Ficha'),
    (Icons.backpack_outlined, Icons.backpack, 'Bolsa'),
    (Icons.map_outlined, Icons.map, 'Mapa'),
    (Icons.menu_book_outlined, Icons.menu_book, 'Diário'),
  ];

  Widget _panel(int i) {
    final v = game.view!;
    return switch (i) {
      0 => SceneTab(game: game),
      1 => SheetTab(view: v),
      2 => BagTab(game: game),
      3 => MapTab(view: v),
      _ => JournalTab(view: v),
    };
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: game,
      builder: (context, _) {
        final v = game.view;
        final appBar = AppBar(
          backgroundColor: Palette.bg,
          titleSpacing: 16,
          title: Text(v?.campaignName ?? 'Carregando…', style: Theme.of(context).textTheme.titleMedium, overflow: TextOverflow.ellipsis),
          actions: [
            Tooltip(
              message: game.live ? 'Ao vivo' : 'Reconectando…',
              child: Icon(Icons.circle, size: 10, color: game.live ? Palette.success : Palette.textDim),
            ),
            IconButton(tooltip: 'Trocar campanha', onPressed: widget.onLeave, icon: const Icon(Icons.logout)),
          ],
        );
        if (v == null) {
          return Scaffold(
            appBar: appBar,
            body: Center(
              child: game.error == null
                  ? const CircularProgressIndicator()
                  : Padding(padding: const EdgeInsets.all(24), child: Text(game.error!, textAlign: TextAlign.center, style: const TextStyle(color: Palette.failure))),
            ),
          );
        }
        final wide = MediaQuery.sizeOf(context).width >= 900;
        final hero = v.pc == null ? null : HeroBar(pc: v.pc!);
        if (!wide) {
          return Scaffold(
            appBar: appBar,
            body: Column(children: [
              ?hero,
              Expanded(child: _panel(_tab)),
            ]),
            bottomNavigationBar: NavigationBar(
              selectedIndex: _tab,
              onDestinationSelected: (i) => setState(() => _tab = i),
              destinations: [for (final t in _tabs) NavigationDestination(icon: Icon(t.$1), selectedIcon: Icon(t.$2), label: t.$3)],
            ),
          );
        }
        return Scaffold(
          appBar: appBar,
          body: Column(children: [
            ?hero,
            Expanded(
              child: Row(children: [
                Expanded(flex: 3, child: _panel(0)),
                const VerticalDivider(width: 1, color: Palette.line),
                Expanded(
                  flex: 2,
                  child: Column(children: [
                    NavigationBar(
                      height: 64,
                      selectedIndex: _side,
                      onDestinationSelected: (i) => setState(() => _side = i),
                      destinations: [for (final t in _tabs.skip(1)) NavigationDestination(icon: Icon(t.$1), selectedIcon: Icon(t.$2), label: t.$3)],
                    ),
                    Expanded(child: _panel(_side + 1)),
                  ]),
                ),
              ]),
            ),
          ]),
        );
      },
    );
  }
}
