import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../theme.dart';
import '../narration.dart';
import '../play_settings.dart';
import 'chrome.dart';
import 'drawers.dart';
import 'sigils.dart';
import 'voice.dart';

/// Mesa do jogador. No celular, gavetas arrastáveis; no tablet/web, painéis que trocam de lugar.
class GameTable extends StatefulWidget {
  const GameTable({
    super.key,
    required this.view,
    required this.onSend,
    required this.onItem,
    required this.onLeave,
    this.live = false,
    this.sending = false,
    this.portraitBase,
    this.animateNarration = true,
    this.onListen,
    this.onResource,
    this.onLevelUp,
    this.onLevelOptions,
    this.onRest,
  });

  final GameView view;
  final Future<String?> Function(String text) onSend;
  final ItemAct onItem;
  final ResourceAct? onResource;
  final LevelUpAct? onLevelUp;
  final LevelOptionsAct? onLevelOptions;
  final RestAct? onRest;
  final VoidCallback onLeave;
  final bool live;
  final bool sending;
  final String? portraitBase;
  final bool animateNarration;
  final Future<void> Function(String key)? onListen;

  @override
  State<GameTable> createState() => _GameTableState();
}

class _GameTableState extends State<GameTable> {
  final _input = TextEditingController();
  final _anchors = <String, GlobalKey>{};
  int _lastMasterId = -1;
  bool _wide = false;

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  GlobalKey _anchor(String id) => _anchors.putIfAbsent(id, GlobalKey.new);

  (IconData, String) _meta(String id) => switch (id) {
    'ficha' => (Icons.person_outline, 'Ficha'),
    'bolsa' => (Icons.backpack_outlined, 'Bolsa'),
    'grimorio' => (Icons.menu_book_outlined, 'Grimório'),
    'missoes' => (Icons.edit_note_outlined, 'Diário'),
    'pessoas' => (Icons.groups_outlined, 'Pessoas'),
    'mapa' => (Icons.map_outlined, 'Mapa'),
    _ => (Icons.circle_outlined, id),
  };

  Widget _panel(String id, ScrollController? scroll) {
    final view = widget.view;
    return switch (id) {
      'ficha' => SheetDrawer(
        view: view,
        scroll: scroll,
        onResource: widget.onResource,
        onLevelUp: widget.onLevelUp,
        onLevelOptions: widget.onLevelOptions,
        onRest: widget.onRest,
        busy: widget.sending,
      ),
      'bolsa' => BagDrawer(
        view: view,
        scroll: scroll,
        locked: view.pendingRolls.isNotEmpty,
        busy: widget.sending,
        onItem: widget.onItem,
      ),
      'grimorio' => SpellbookDrawer(view: view, scroll: scroll),
      'missoes' => QuestDrawer(view: view, scroll: scroll),
      'pessoas' => PeopleDrawer(
        view: view,
        scroll: scroll,
        portraitBase: widget.portraitBase,
      ),
      _ => MapDrawer(view: view, scroll: scroll),
    };
  }

  Future<void> _open(String id) async {
    final anchor = _anchors[id]?.currentContext;
    if (_wide && anchor != null) {
      await Scrollable.ensureVisible(
        anchor,
        duration: const Duration(milliseconds: 280),
        alignment: 0.02,
      );
      return;
    }
    if (!mounted) return;
    await openDrawer(
      context,
      title: _meta(id).$2,
      body: (scroll) => _panel(id, scroll),
    );
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || widget.sending) return;
    tableFeedback(context);
    final err = await widget.onSend(text);
    if (!mounted) return;
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
    } else {
      _input.clear();
    }
  }

  void _settings() {
    final settings = PlaySettingsScope.of(context);
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Palette.leather,
      showDragHandle: true,
      builder: (ctx) => ListenableBuilder(
        listenable: settings,
        builder: (ctx, _) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              SwitchListTile(
                key: const Key('switch-texto-maior'),
                title: const Text(
                  'Texto maior',
                  style: TextStyle(fontFamily: 'Cinzel', color: Palette.text),
                ),
                subtitle: const Text(
                  'Aumenta a leitura em toda a mesa',
                  style: TextStyle(color: Palette.textDim),
                ),
                value: settings.largeText,
                onChanged: (v) => settings.setLargeText(v),
              ),
              SwitchListTile(
                key: const Key('switch-vibracao'),
                title: const Text(
                  'Vibração',
                  style: TextStyle(fontFamily: 'Cinzel', color: Palette.text),
                ),
                subtitle: const Text(
                  'Toque ao rolar dados e enviar',
                  style: TextStyle(color: Palette.textDim),
                ),
                value: settings.haptics,
                onChanged: (v) => settings.setHaptics(v),
              ),
              SwitchListTile(
                key: const Key('switch-sons'),
                title: const Text(
                  'Sons',
                  style: TextStyle(fontFamily: 'Cinzel', color: Palette.text),
                ),
                subtitle: const Text(
                  'Cliques do sistema ao agir',
                  style: TextStyle(color: Palette.textDim),
                ),
                value: settings.sounds,
                onChanged: (v) => settings.setSounds(v),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final settings = PlaySettingsScope.of(context);
    final view = widget.view;
    final journal = _Journal(
      view: view,
      narrationSize: settings.narrationSize,
      animate: widget.animateNarration,
      lastMasterId: _lastMasterId,
      onMaster: (id) {
        if (_lastMasterId != id) setState(() => _lastMasterId = id);
      },
      onListen: widget.onListen,
      onStep: (step) => settings.setNarrationStep(step),
      step: settings.narrationStep,
    );
    final composer = _Composer(
      controller: _input,
      onSend: _send,
      sending: widget.sending || view.master.busy,
      locked: view.pendingRolls.isNotEmpty,
    );
    final actions = _ActionRow(
      view: view,
      enabled: view.pendingRolls.isEmpty && !widget.sending,
      onSuggest: (text) => _input.text = text,
      onItem: widget.onItem,
    );
    final bar = _QuickBar(
      order: settings.panelOrder,
      meta: _meta,
      onOpen: _open,
    );

    return Scaffold(
      backgroundColor: Palette.leather,
      body: LeatherBackdrop(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 900;
              _wide = wide;
              final center = Column(
                children: [
                  Expanded(child: journal),
                  actions,
                  composer,
                ],
              );
              if (wide) {
                return Column(
                  children: [
                    _TopBar(
                      view: view,
                      live: widget.live,
                      onLeave: widget.onLeave,
                      onSettings: _settings,
                    ),
                    Expanded(
                      child: Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: _StatusDeck(
                              view: view,
                              portraitBase: widget.portraitBase,
                              side: true,
                              onPeople: () => _open('pessoas'),
                              onOpenSheet: () => _open('ficha'),
                            ),
                          ),
                          const VerticalDivider(width: 1, color: Palette.line),
                          Expanded(flex: 6, child: center),
                          const VerticalDivider(width: 1, color: Palette.line),
                          Expanded(
                            flex: 4,
                            child: _Dock(
                              order: settings.panelOrder,
                              meta: _meta,
                              anchor: _anchor,
                              panel: _panel,
                              onReorder: settings.setPanelOrder,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              }
              return Column(
                children: [
                  _StatusDeck(
                    view: view,
                    live: widget.live,
                    portraitBase: widget.portraitBase,
                    maxBody: constraints.maxHeight * 0.38,
                    onLeave: widget.onLeave,
                    onSettings: _settings,
                    onPeople: () => _open('pessoas'),
                    onOpenSheet: () => _open('ficha'),
                  ),
                  Expanded(child: center),
                  bar,
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.view,
    required this.live,
    required this.onLeave,
    required this.onSettings,
  });
  final GameView view;
  final bool live;
  final VoidCallback onLeave, onSettings;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 4, 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  view.campaignName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: displayStyle(size: 18),
                ),
                Text(
                  'Dia ${view.day} · ${view.time} · ${view.period}',
                  style: const TextStyle(
                    color: Palette.textDim,
                    fontFamily: 'EBGaramond',
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          Semantics(
            label: live ? 'Conectado ao vivo' : 'Reconectando',
            child: Icon(
              Icons.circle,
              size: 12,
              color: live ? Palette.success : Palette.textDim,
            ),
          ),
          IconButton(
            key: const Key('btn-ajustes'),
            tooltip: 'Ajustes de leitura',
            onPressed: onSettings,
            icon: const Icon(Icons.tune, color: Palette.gold),
            iconSize: 26,
          ),
          IconButton(
            tooltip: 'Trocar campanha',
            onPressed: onLeave,
            icon: const Icon(Icons.logout, color: Palette.gold),
            iconSize: 24,
          ),
        ],
      ),
    );
  }
}

class _StatusDeck extends StatefulWidget {
  const _StatusDeck({
    required this.view,
    required this.portraitBase,
    required this.onPeople,
    required this.onOpenSheet,
    this.live = false,
    this.side = false,
    this.maxBody = 280,
    this.onLeave,
    this.onSettings,
  });

  final GameView view;
  final String? portraitBase;
  final VoidCallback onPeople;
  final VoidCallback onOpenSheet;
  final bool live;
  final bool side;
  final double maxBody;
  final VoidCallback? onLeave;
  final VoidCallback? onSettings;

  @override
  State<_StatusDeck> createState() => _StatusDeckState();
}

class _StatusDeckState extends State<_StatusDeck> {
  double _fraction = 0;

  @override
  Widget build(BuildContext context) {
    final body = _StatusBody(
      view: widget.view,
      portraitBase: widget.portraitBase,
      onPeople: widget.onPeople,
      onOpenSheet: widget.onOpenSheet,
    );
    if (widget.side) {
      return Material(
        color: Palette.leatherRaised,
        child: SingleChildScrollView(child: body),
      );
    }
    final pc = widget.view.pc;
    final place = widget.view.location?.name ?? '';
    final round = widget.view.combat.isEmpty
        ? ''
        : ' · R${widget.view.combatRound ?? 1}';
    return Material(
      color: Palette.leatherRaised,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  key: const Key('status-bar'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () =>
                      setState(() => _fraction = _fraction > 0.5 ? 0 : 1),
                  onVerticalDragUpdate: (d) => setState(
                    () => _fraction = (_fraction + d.delta.dy / widget.maxBody)
                        .clamp(0.0, 1.0),
                  ),
                  onVerticalDragEnd: (d) {
                    final velocity = d.primaryVelocity ?? 0;
                    setState(
                      () => _fraction =
                          velocity < -250 ||
                              (_fraction < 0.35 && velocity <= 250)
                          ? 0
                          : 1,
                    );
                  },
                  child: Semantics(
                    button: true,
                    label:
                        '${pc?.name ?? widget.view.campaignName}, ${pc == null ? '' : '${pc.hp} de ${pc.maxHp} pontos de vida, '}$place. Toque ou arraste para ver a situação.',
                    child: SizedBox(
                      height: 56,
                      child: Padding(
                        padding: const EdgeInsets.only(left: 10),
                        child: Row(
                          children: [
                            if (pc != null)
                              PortraitFace(
                                name: pc.name,
                                url: portraitUrl(
                                  pc.portrait,
                                  widget.portraitBase,
                                ),
                                classKey: pc.classKey,
                                classLabel: pc.classLabel,
                                size: 36,
                              ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    pc == null
                                        ? widget.view.campaignName
                                        : '${pc.name} · ${pc.hp}/${pc.maxHp}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontFamily: 'Cinzel',
                                      fontWeight: FontWeight.w600,
                                      color: Palette.text,
                                      fontSize: 15,
                                    ),
                                  ),
                                  Text(
                                    '$place$round'.trim(),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Palette.textDim,
                                      fontFamily: 'EBGaramond',
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Icon(
                              widget.live
                                  ? Icons.circle
                                  : Icons.circle_outlined,
                              size: 10,
                              color: widget.live
                                  ? Palette.success
                                  : Palette.textDim,
                            ),
                            Icon(
                              _fraction > 0.5
                                  ? Icons.expand_less
                                  : Icons.expand_more,
                              color: Palette.gold,
                            ),
                            const SizedBox(width: 4),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              if (widget.onSettings != null)
                IconButton(
                  key: const Key('btn-ajustes'),
                  tooltip: 'Ajustes de leitura',
                  onPressed: widget.onSettings,
                  icon: const Icon(Icons.tune, color: Palette.gold),
                  iconSize: 24,
                  constraints: const BoxConstraints(
                    minWidth: 48,
                    minHeight: 48,
                  ),
                ),
              if (widget.onLeave != null)
                IconButton(
                  tooltip: 'Trocar campanha',
                  onPressed: widget.onLeave,
                  icon: const Icon(Icons.logout, color: Palette.gold),
                  iconSize: 22,
                  constraints: const BoxConstraints(
                    minWidth: 48,
                    minHeight: 48,
                  ),
                ),
            ],
          ),
          if (_fraction > 0)
            ClipRect(
              child: Align(
                alignment: Alignment.topCenter,
                heightFactor: _fraction,
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: widget.maxBody),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: body,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _StatusBody extends StatelessWidget {
  const _StatusBody({
    required this.view,
    required this.portraitBase,
    required this.onPeople,
    required this.onOpenSheet,
  });
  final GameView view;
  final String? portraitBase;
  final VoidCallback onPeople;
  final VoidCallback onOpenSheet;

  @override
  Widget build(BuildContext context) {
    final pc = view.pc;
    final place = view.location;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (pc != null)
            _HeroPlate(
              pc: pc,
              portraitBase: portraitBase,
              onOpenSheet: onOpenSheet,
            ),
          if (view.combat.isNotEmpty)
            InitiativeRail(view: view, portraitBase: portraitBase),
          if (view.present.isNotEmpty) ...[
            const SectionHeading('Em cena', onParchment: false),
            SizedBox(
              height: 88,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: view.present.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final npc = view.present[i];
                  return LongPressDraggable<String>(
                    data: npc.id,
                    feedback: Material(
                      color: Colors.transparent,
                      child: _PortraitChip(
                        npc: npc,
                        portraitBase: portraitBase,
                      ),
                    ),
                    child: _PortraitChip(
                      npc: npc,
                      portraitBase: portraitBase,
                      onTap: onPeople,
                    ),
                  );
                },
              ),
            ),
          ],
          if (place != null) ...[
            const SectionHeading('Lugar', onParchment: false),
            Text(place.name, style: displayStyle(size: 16)),
            if (place.parent != null)
              Text(
                place.parent!,
                style: const TextStyle(
                  color: Palette.textDim,
                  fontFamily: 'EBGaramond',
                ),
              ),
            if (place.summary.isNotEmpty)
              Text(
                place.summary,
                style: const TextStyle(
                  color: Palette.text,
                  fontFamily: 'EBGaramond',
                  height: 1.35,
                ),
              ),
            if (place.details.isNotEmpty)
              Text(
                place.details,
                style: const TextStyle(
                  color: Palette.textDim,
                  fontFamily: 'EBGaramond',
                  height: 1.35,
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _PortraitChip extends StatelessWidget {
  const _PortraitChip({required this.npc, this.portraitBase, this.onTap});
  final Npc npc;
  final String? portraitBase;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72,
      child: InkWell(
        onTap: onTap,
        child: Column(
          children: [
            PortraitFace(
              name: npc.name,
              url: portraitUrl(npc.portrait, portraitBase),
              size: 40,
              ring: _tone(npc.attitudeLabel),
            ),
            const SizedBox(height: 4),
            Text(
              npc.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Palette.text,
                fontFamily: 'Cinzel',
                fontSize: 12,
              ),
            ),
            Text(
              npc.attitudeLabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: _tone(npc.attitudeLabel),
                fontSize: 11,
                fontFamily: 'EBGaramond',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroPlate extends StatelessWidget {
  const _HeroPlate({
    required this.pc,
    required this.onOpenSheet,
    this.portraitBase,
  });
  final Pc pc;
  final VoidCallback onOpenSheet;
  final String? portraitBase;

  @override
  Widget build(BuildContext context) {
    final ratio = pc.maxHp == 0 ? 0.0 : (pc.hp / pc.maxHp).clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Material(
        color: Palette.leatherRaised,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: Palette.brass, width: 1.5),
        ),
        child: InkWell(
          onTap: onOpenSheet,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                PortraitFace(
                  name: pc.name,
                  url: portraitUrl(pc.portrait, portraitBase),
                  classKey: pc.classKey,
                  classLabel: pc.classLabel,
                  size: 52,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        pc.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontFamily: 'Cinzel',
                          fontWeight: FontWeight.w600,
                          color: Palette.text,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        '${pc.classLabel} ${pc.level}${pc.status == 'vivo' ? '' : ' · ${pc.status}'}',
                        style: const TextStyle(
                          color: Palette.textDim,
                          fontSize: 13,
                          fontFamily: 'EBGaramond',
                        ),
                      ),
                      const SizedBox(height: 4),
                      Semantics(
                        label: 'Pontos de vida ${pc.hp} de ${pc.maxHp}',
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(3),
                          child: LinearProgressIndicator(
                            value: ratio,
                            minHeight: 8,
                            color: ratio < 0.35 ? Palette.hpLow : Palette.hp,
                            backgroundColor: Palette.line,
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${pc.hp}/${pc.maxHp} PV${pc.tempHp > 0 ? ' +${pc.tempHp}' : ''}',
                        style: const TextStyle(
                          color: Palette.textDim,
                          fontSize: 12,
                          fontFamily: 'EBGaramond',
                        ),
                      ),
                      if (pc.conditions.isNotEmpty)
                        SizedBox(
                          height: 32,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            children: [
                              for (final c in pc.conditions) ConditionChip(c),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                _MiniStat('CA', '${pc.ac}'),
                _MiniStat('INI', signed(pc.initiative)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Container(
    width: 48,
    margin: const EdgeInsets.only(left: 6),
    padding: const EdgeInsets.symmetric(vertical: 6),
    decoration: BoxDecoration(
      border: Border.all(color: Palette.brassDark),
      borderRadius: BorderRadius.circular(4),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: const TextStyle(
            fontFamily: 'Cinzel',
            fontWeight: FontWeight.w600,
            color: Palette.gold,
            fontSize: 16,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            color: Palette.textDim,
            fontFamily: 'Cinzel',
          ),
        ),
      ],
    ),
  );
}

class InitiativeRail extends StatelessWidget {
  const InitiativeRail({super.key, required this.view, this.portraitBase});
  final GameView view;
  final String? portraitBase;

  @override
  Widget build(BuildContext context) {
    final pc = view.pc;
    return SizedBox(
      height: 108,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Text(
                'R${view.combatRound ?? 1}',
                style: displayStyle(size: 16),
              ),
            ),
          ),
          for (final c in view.combat)
            Semantics(
              label:
                  '${c.current ? 'Vez de ' : ''}${c.name}, iniciativa ${c.initiative}, ${c.hp} de ${c.maxHp} pontos de vida',
              child: Container(
                width: 84,
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: c.current
                      ? Palette.brass.withValues(alpha: 0.18)
                      : Palette.leatherRaised,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: c.current
                        ? Palette.gold
                        : (c.isPc ? Palette.mana : Palette.line),
                    width: c.current ? 2 : 1,
                  ),
                ),
                child: Opacity(
                  opacity: c.status == 'morto' ? 0.4 : 1,
                  child: Column(
                    children: [
                      PortraitFace(
                        name: c.name,
                        url: portraitUrl(c.portrait, portraitBase),
                        classKey: c.isPc ? (pc?.classKey ?? '') : '',
                        classLabel: c.isPc ? (pc?.classLabel ?? '') : '',
                        size: 40,
                        ring: c.current ? Palette.gold : Palette.brassDark,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        c.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Palette.text,
                          fontFamily: 'Cinzel',
                        ),
                      ),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: LinearProgressIndicator(
                          value: c.maxHp == 0
                              ? 0
                              : (c.hp / c.maxHp).clamp(0, 1).toDouble(),
                          minHeight: 4,
                          color: c.isPc ? Palette.hp : Palette.ember,
                          backgroundColor: Palette.line,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Journal extends StatefulWidget {
  const _Journal({
    required this.view,
    required this.narrationSize,
    required this.animate,
    required this.lastMasterId,
    required this.onMaster,
    required this.onStep,
    required this.step,
    this.onListen,
  });
  final GameView view;
  final double narrationSize;
  final bool animate;
  final int lastMasterId;
  final int step;
  final ValueChanged<int> onMaster;
  final ValueChanged<int> onStep;
  final Future<void> Function(String key)? onListen;

  @override
  State<_Journal> createState() => _JournalState();
}

class _JournalState extends State<_Journal> {
  final _featureKey = GlobalKey();
  int? _pinnedFor;
  bool _pinScheduled = false;

  void _pin(int id) {
    if (_pinnedFor == id || _pinScheduled) return;
    _pinScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _pinScheduled = false;
      if (!mounted) return;
      final target = _featureKey.currentContext;
      if (target == null) return;
      _pinnedFor = id;
      Scrollable.ensureVisible(target, alignment: 0);
    });
  }

  @override
  Widget build(BuildContext context) {
    final view = widget.view;
    final lastMaster = view.chat.where((c) => c.role == 'mestre').lastOrNull;
    final animate =
        widget.animate &&
        lastMaster != null &&
        lastMaster.id != widget.lastMasterId;
    if (lastMaster != null && lastMaster.id != widget.lastMasterId) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onMaster(lastMaster.id);
      });
    }
    final history = view.chat
        .where((c) => lastMaster == null || c.id < lastMaster.id)
        .toList();
    final after = lastMaster == null
        ? view.chat
        : view.chat.where((c) => c.id > lastMaster.id).toList();
    final text = lastMaster?.text ?? view.latestNarration;
    final voiceKey = lastMaster != null
        ? 'chat-${lastMaster.id}'
        : (view.journal.isNotEmpty ? 'turn-${view.journal.last.n}' : null);
    _pin(lastMaster?.id ?? -1);

    return LayoutBuilder(
      builder: (context, constraints) {
        final page = constraints.maxHeight.isFinite
            ? constraints.maxHeight
            : 480.0;
        return ListView(
          key: const Key('journal'),
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
          children: [
            if (history.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.only(bottom: 6),
                child: Text(
                  'Páginas anteriores',
                  style: TextStyle(
                    color: Palette.textDim,
                    fontFamily: 'EBGaramond',
                    fontSize: 14,
                  ),
                ),
              ),
              for (final message in history) _Note(message: message),
            ],
            ConstrainedBox(
              key: _featureKey,
              constraints: BoxConstraints(minHeight: page),
              child: KeyedSubtree(
                key: const Key('narracao-destaque'),
                child: Parchment(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            'O MESTRE',
                            style: displayStyle(
                              size: 13,
                              color: Palette.goldBright,
                            ),
                          ),
                          const Spacer(),
                          IconButton(
                            key: const Key('font-menor'),
                            tooltip: 'Texto menor na narração',
                            onPressed: widget.step > 0
                                ? () => widget.onStep(widget.step - 1)
                                : null,
                            icon: const Icon(Icons.text_decrease),
                            color: Palette.gold,
                            iconSize: 22,
                            constraints: const BoxConstraints(
                              minWidth: 48,
                              minHeight: 48,
                            ),
                          ),
                          IconButton(
                            key: const Key('font-maior'),
                            tooltip: 'Texto maior na narração',
                            onPressed:
                                widget.step <
                                    PlaySettings.narrationSizes.length - 1
                                ? () => widget.onStep(widget.step + 1)
                                : null,
                            icon: const Icon(Icons.text_increase),
                            color: Palette.gold,
                            iconSize: 22,
                            constraints: const BoxConstraints(
                              minWidth: 48,
                              minHeight: 48,
                            ),
                          ),
                          if (widget.onListen != null && voiceKey != null)
                            ValueListenableBuilder<VoiceStatus>(
                              valueListenable:
                                  TableVoice.instance.statusNotifier,
                              builder: (context, status, _) {
                                final isCurrent =
                                    TableVoice.instance.currentKey == voiceKey;
                                final loading =
                                    isCurrent && status == VoiceStatus.loading;
                                final playing =
                                    isCurrent && status == VoiceStatus.playing;
                                final error =
                                    isCurrent && status == VoiceStatus.error;

                                Widget iconWidget;
                                String tip;
                                if (loading) {
                                  iconWidget = const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Palette.goldBright,
                                    ),
                                  );
                                  tip = 'Carregando voz do Mestre...';
                                } else if (playing) {
                                  iconWidget = const Icon(
                                    Icons.stop_circle_outlined,
                                    color: Palette.goldBright,
                                  );
                                  tip = 'Parar voz do Mestre';
                                } else if (error) {
                                  iconWidget = const Icon(
                                    Icons.volume_off_outlined,
                                    color: Palette.failure,
                                  );
                                  tip = 'Voz do Mestre indisponível';
                                } else {
                                  iconWidget = const Icon(
                                    Icons.volume_up_outlined,
                                    color: Palette.gold,
                                  );
                                  tip = 'Ouvir a narração';
                                }

                                return IconButton(
                                  key: const Key('btn-ouvir'),
                                  tooltip: tip,
                                  onPressed: () => widget.onListen!(voiceKey),
                                  icon: iconWidget,
                                  color: Palette.gold,
                                  iconSize: 22,
                                  constraints: const BoxConstraints(
                                    minWidth: 48,
                                    minHeight: 48,
                                  ),
                                );
                              },
                            ),
                        ],
                      ),
                      if (text.isNotEmpty)
                        Narration(
                          text: text,
                          animate: animate,
                          fontSize: widget.narrationSize,
                        )
                      else
                        const Text(
                          'Diga ao Mestre o que você quer fazer para começar.',
                          style: TextStyle(
                            color: Palette.inkSoft,
                            fontFamily: 'EBGaramond',
                            fontSize: 20,
                            height: 1.5,
                          ),
                        ),
                      for (final message in after) _Note(message: message),
                      if (view.master.busy)
                        const Padding(
                          padding: EdgeInsets.only(top: 10),
                          child: Text(
                            'O Mestre está narrando…',
                            style: TextStyle(
                              color: Palette.inkEmph,
                              fontFamily: 'EBGaramond',
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ),
                      if (view.master.status == 'erro')
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'O Mestre não respondeu: ${view.master.error ?? ''}',
                            style: const TextStyle(color: Palette.failure),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.view,
    required this.enabled,
    required this.onSuggest,
    required this.onItem,
  });
  final GameView view;
  final bool enabled;
  final ValueChanged<String> onSuggest;
  final ItemAct onItem;

  @override
  Widget build(BuildContext context) {
    final exits = view.location?.exits ?? const <Exit>[];
    final ground = view.location?.items ?? const <Item>[];
    final quick = view.pc?.inventory
        .where((i) => i.actions.contains('usar'))
        .firstOrNull;
    if (exits.isEmpty && ground.isEmpty && quick == null) {
      return const SizedBox.shrink();
    }
    return SizedBox(
      height: 56,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          for (final exit in exits)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ActionChip(
                key: Key('exit-${exit.id}'),
                materialTapTargetSize: MaterialTapTargetSize.padded,
                label: Text('${exit.name} · ${exit.minutes} min'),
                avatar: const Icon(
                  Icons.signpost_outlined,
                  size: 18,
                  color: Palette.gold,
                ),
                labelStyle: const TextStyle(
                  color: Palette.text,
                  fontFamily: 'EBGaramond',
                  fontSize: 16,
                ),
                backgroundColor: Palette.leatherRaised,
                side: const BorderSide(color: Palette.brassDark),
                onPressed: () => onSuggest('Sigo para ${exit.name}.'),
              ),
            ),
          for (final item in ground)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ActionChip(
                label: Text(
                  item.qty > 1 ? '${item.qty}× ${item.name}' : item.name,
                ),
                avatar: const Icon(
                  Icons.inventory_2_outlined,
                  size: 18,
                  color: Palette.gold,
                ),
                labelStyle: const TextStyle(
                  color: Palette.text,
                  fontFamily: 'EBGaramond',
                  fontSize: 16,
                ),
                backgroundColor: Palette.leatherRaised,
                side: const BorderSide(color: Palette.brassDark),
                onPressed: () => onSuggest('Pego ${item.name}.'),
              ),
            ),
          if (quick != null)
            FilledButton.icon(
              key: const Key('quick-usar'),
              onPressed: enabled
                  ? () async {
                      tableFeedback(context);
                      final text = await onItem('usar', quick.id);
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(text ?? 'Usar: ${quick.name}')),
                      );
                    }
                  : null,
              icon: const Icon(Icons.local_drink_outlined),
              label: Text('Usar ${quick.name}'),
            ),
        ],
      ),
    );
  }
}

Color _tone(String label) => switch (label) {
  'hostil' => Palette.failure,
  'desconfiado' => Palette.legendary,
  'amigável' => Palette.success,
  'leal' => Palette.inkEmph,
  _ => Palette.inkSoft,
};

class _Note extends StatelessWidget {
  const _Note({required this.message});
  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    if (message.role == 'mestre') {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Parchment(child: Narration(text: message.text, animate: false)),
      );
    }
    final system = message.role == 'sistema';
    final pending = message.status != 'entregue' && message.status != 'erro';
    return Align(
      alignment: system ? Alignment.center : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        constraints: const BoxConstraints(maxWidth: 480),
        decoration: BoxDecoration(
          color: system ? Colors.transparent : Palette.parchmentDeep,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: message.status == 'erro'
                ? Palette.failure
                : Palette.brassDark,
          ),
        ),
        child: Column(
          crossAxisAlignment: system
              ? CrossAxisAlignment.center
              : CrossAxisAlignment.end,
          children: [
            Text(
              cleanNarration(message.text),
              style: TextStyle(
                fontFamily: 'EBGaramond',
                fontSize: system ? 14 : 16,
                fontStyle: system ? FontStyle.italic : null,
                color: Palette.ink,
              ),
            ),
            if (pending)
              const Text(
                'enviando ao Mestre…',
                style: TextStyle(color: Palette.inkSoft, fontSize: 12),
              ),
            if (message.status == 'erro')
              Text(
                'não entregue: ${message.error}',
                style: const TextStyle(color: Palette.failure, fontSize: 12),
              ),
          ],
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.onSend,
    required this.sending,
    required this.locked,
  });
  final TextEditingController controller;
  final VoidCallback onSend;
  final bool sending, locked;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 8, 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              enabled: !locked,
              minLines: 1,
              maxLines: 4,
              maxLength: 4000,
              style: const TextStyle(
                color: Palette.ink,
                fontFamily: 'EBGaramond',
                fontSize: 17,
              ),
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              decoration: InputDecoration(
                counterText: '',
                hintText: locked
                    ? 'Role os dados pedidos pelo Mestre'
                    : 'O que você faz?',
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          IconButton.filled(
            onPressed: sending || locked ? null : onSend,
            icon: sending
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.send_rounded),
            tooltip: 'Enviar ao Mestre',
            style: IconButton.styleFrom(
              minimumSize: const Size(52, 52),
              backgroundColor: Palette.ember,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickBar extends StatelessWidget {
  const _QuickBar({
    required this.order,
    required this.meta,
    required this.onOpen,
  });
  final List<String> order;
  final (IconData, String) Function(String id) meta;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Palette.leatherRaised,
      child: SizedBox(
        height: 68,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          children: [
            for (final id in order)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: InkWell(
                  key: Key('quick-$id'),
                  onTap: () => onOpen(id),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    constraints: const BoxConstraints(
                      minWidth: 72,
                      minHeight: 52,
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(meta(id).$1, color: Palette.gold, size: 22),
                        Text(
                          meta(id).$2,
                          style: const TextStyle(
                            color: Palette.text,
                            fontFamily: 'Cinzel',
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Dock extends StatelessWidget {
  const _Dock({
    required this.order,
    required this.meta,
    required this.anchor,
    required this.panel,
    required this.onReorder,
  });
  final List<String> order;
  final (IconData, String) Function(String id) meta;
  final GlobalKey Function(String id) anchor;
  final Widget Function(String id, ScrollController? scroll) panel;
  final Future<void> Function(List<String> next) onReorder;

  @override
  Widget build(BuildContext context) {
    return ReorderableListView(
      buildDefaultDragHandles: false,
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 16),
      onReorderItem: (oldIndex, newIndex) {
        final next = [...order];
        final id = next.removeAt(oldIndex);
        next.insert(newIndex, id);
        onReorder(next);
      },
      children: [
        for (var i = 0; i < order.length; i++)
          Padding(
            key: anchor(order[i]),
            padding: const EdgeInsets.only(bottom: 8),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Palette.leatherRaised,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Palette.brassDark),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      ReorderableDragStartListener(
                        index: i,
                        child: const SizedBox(
                          width: 48,
                          height: 48,
                          child: Icon(Icons.drag_handle, color: Palette.gold),
                        ),
                      ),
                      Icon(meta(order[i]).$1, color: Palette.gold, size: 18),
                      const SizedBox(width: 6),
                      Text(meta(order[i]).$2, style: displayStyle(size: 14)),
                    ],
                  ),
                  SizedBox(height: 420, child: panel(order[i], null)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
