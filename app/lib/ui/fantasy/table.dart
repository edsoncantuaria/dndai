import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../theme.dart';
import '../narration.dart';
import '../play_settings.dart';
import 'chrome.dart';
import 'drawers.dart';
import 'sigils.dart';

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
  });

  final GameView view;
  final Future<String?> Function(String text) onSend;
  final ItemAct onItem;
  final VoidCallback onLeave;
  final bool live;
  final bool sending;
  final String? portraitBase;
  final bool animateNarration;

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
      'ficha' => SheetDrawer(view: view, scroll: scroll),
      'bolsa' => BagDrawer(view: view, scroll: scroll, locked: view.pendingRolls.isNotEmpty, busy: widget.sending, onItem: widget.onItem),
      'grimorio' => SpellbookDrawer(view: view, scroll: scroll),
      'missoes' => QuestDrawer(view: view, scroll: scroll),
      'pessoas' => PeopleDrawer(view: view, scroll: scroll, portraitBase: widget.portraitBase),
      _ => MapDrawer(view: view, scroll: scroll),
    };
  }

  Future<void> _open(String id) async {
    final anchor = _anchors[id]?.currentContext;
    if (_wide && anchor != null) {
      await Scrollable.ensureVisible(anchor, duration: const Duration(milliseconds: 280), alignment: 0.02);
      return;
    }
    if (!mounted) return;
    await openDrawer(context, title: _meta(id).$2, body: (scroll) => _panel(id, scroll));
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
          child: ListView(shrinkWrap: true, children: [
            SwitchListTile(
              key: const Key('switch-texto-maior'),
              title: const Text('Texto maior', style: TextStyle(fontFamily: 'Cinzel', color: Palette.text)),
              subtitle: const Text('Aumenta a leitura em toda a mesa', style: TextStyle(color: Palette.textDim)),
              value: settings.largeText,
              onChanged: (v) => settings.setLargeText(v),
            ),
            SwitchListTile(
              key: const Key('switch-vibracao'),
              title: const Text('Vibração', style: TextStyle(fontFamily: 'Cinzel', color: Palette.text)),
              subtitle: const Text('Toque ao rolar dados e enviar', style: TextStyle(color: Palette.textDim)),
              value: settings.haptics,
              onChanged: (v) => settings.setHaptics(v),
            ),
            SwitchListTile(
              key: const Key('switch-sons'),
              title: const Text('Sons', style: TextStyle(fontFamily: 'Cinzel', color: Palette.text)),
              subtitle: const Text('Cliques do sistema ao agir', style: TextStyle(color: Palette.textDim)),
              value: settings.sounds,
              onChanged: (v) => settings.setSounds(v),
            ),
          ]),
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
      portraitBase: widget.portraitBase,
      animate: widget.animateNarration,
      lastMasterId: _lastMasterId,
      onMaster: (id) {
        if (_lastMasterId != id) setState(() => _lastMasterId = id);
      },
      onSuggest: (text) => _input.text = text,
      onPeople: () => _open('pessoas'),
    );
    final quick = view.pc?.inventory.where((i) => i.actions.contains('usar')).firstOrNull;
    final composer = _Composer(
      controller: _input,
      onSend: _send,
      sending: widget.sending || view.master.busy,
      locked: view.pendingRolls.isNotEmpty,
    );
    final bar = _QuickBar(order: settings.panelOrder, meta: _meta, onOpen: _open);

    return Scaffold(
      backgroundColor: Palette.leather,
      body: LeatherBackdrop(
        child: SafeArea(
          child: LayoutBuilder(builder: (context, constraints) {
            final wide = constraints.maxWidth >= 900;
            _wide = wide;
            return Column(children: [
              _TopBar(view: view, live: widget.live, onLeave: widget.onLeave, onSettings: _settings),
              if (view.pc != null) _HeroPlate(pc: view.pc!, portraitBase: widget.portraitBase, onOpenSheet: () => _open('ficha')),
              if (view.combat.isNotEmpty) InitiativeRail(view: view, portraitBase: widget.portraitBase),
              Expanded(
                child: wide
                    ? Row(children: [
                        Expanded(flex: 5, child: Column(children: [Expanded(child: journal), if (quick != null) _QuickUse(item: quick, enabled: view.pendingRolls.isEmpty && !widget.sending, onItem: widget.onItem), composer])),
                        const VerticalDivider(width: 1, color: Palette.line),
                        SizedBox(width: 400, child: _Dock(order: settings.panelOrder, meta: _meta, anchor: _anchor, panel: _panel, onReorder: settings.setPanelOrder)),
                      ])
                    : Column(children: [Expanded(child: journal), if (quick != null) _QuickUse(item: quick, enabled: view.pendingRolls.isEmpty && !widget.sending, onItem: widget.onItem), composer]),
              ),
              bar,
            ]);
          }),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.view, required this.live, required this.onLeave, required this.onSettings});
  final GameView view;
  final bool live;
  final VoidCallback onLeave, onSettings;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 4, 4),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(view.campaignName, maxLines: 1, overflow: TextOverflow.ellipsis, style: displayStyle(size: 18)),
            Text('Dia ${view.day} · ${view.time} · ${view.period}', style: const TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond', fontSize: 14)),
          ]),
        ),
        Semantics(
          label: live ? 'Conectado ao vivo' : 'Reconectando',
          child: Icon(Icons.circle, size: 12, color: live ? Palette.success : Palette.textDim),
        ),
        IconButton(key: const Key('btn-ajustes'), tooltip: 'Ajustes de leitura', onPressed: onSettings, icon: const Icon(Icons.tune, color: Palette.gold), iconSize: 26),
        IconButton(tooltip: 'Trocar campanha', onPressed: onLeave, icon: const Icon(Icons.logout, color: Palette.gold), iconSize: 24),
      ]),
    );
  }
}

class _HeroPlate extends StatelessWidget {
  const _HeroPlate({required this.pc, required this.onOpenSheet, this.portraitBase});
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: const BorderSide(color: Palette.brass, width: 1.5)),
        child: InkWell(
          onTap: onOpenSheet,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(children: [
              PortraitFace(name: pc.name, url: portraitUrl(pc.portrait, portraitBase), classKey: pc.classKey, classLabel: pc.classLabel, size: 52),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(pc.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, color: Palette.text, fontSize: 16)),
                  Text('${pc.classLabel} ${pc.level}${pc.status == 'vivo' ? '' : ' · ${pc.status}'}', style: const TextStyle(color: Palette.textDim, fontSize: 13, fontFamily: 'EBGaramond')),
                  const SizedBox(height: 4),
                  Semantics(
                    label: 'Pontos de vida ${pc.hp} de ${pc.maxHp}',
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: LinearProgressIndicator(value: ratio, minHeight: 8, color: ratio < 0.35 ? Palette.hpLow : Palette.hp, backgroundColor: Palette.line),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text('${pc.hp}/${pc.maxHp} PV${pc.tempHp > 0 ? ' +${pc.tempHp}' : ''}', style: const TextStyle(color: Palette.textDim, fontSize: 12, fontFamily: 'EBGaramond')),
                  if (pc.conditions.isNotEmpty)
                    SizedBox(height: 32, child: ListView(scrollDirection: Axis.horizontal, children: [for (final c in pc.conditions) ConditionChip(c)])),
                ]),
              ),
              _MiniStat('CA', '${pc.ac}'),
              _MiniStat('INI', signed(pc.initiative)),
            ]),
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
        decoration: BoxDecoration(border: Border.all(color: Palette.brassDark), borderRadius: BorderRadius.circular(4)),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(value, style: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, color: Palette.gold, fontSize: 16)),
          Text(label, style: const TextStyle(fontSize: 10, color: Palette.textDim, fontFamily: 'Cinzel')),
        ]),
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
          Center(child: Padding(padding: const EdgeInsets.only(right: 8), child: Text('R${view.combatRound ?? 1}', style: displayStyle(size: 16)))),
          for (final c in view.combat)
            Semantics(
              label: '${c.current ? 'Vez de ' : ''}${c.name}, iniciativa ${c.initiative}, ${c.hp} de ${c.maxHp} pontos de vida',
              child: Container(
                width: 84,
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: c.current ? Palette.brass.withValues(alpha: 0.18) : Palette.leatherRaised,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: c.current ? Palette.gold : (c.isPc ? Palette.mana : Palette.line), width: c.current ? 2 : 1),
                ),
                child: Opacity(
                  opacity: c.status == 'morto' ? 0.4 : 1,
                  child: Column(children: [
                    PortraitFace(
                      name: c.name,
                      url: portraitUrl(c.portrait, portraitBase),
                      classKey: c.isPc ? (pc?.classKey ?? '') : '',
                      classLabel: c.isPc ? (pc?.classLabel ?? '') : '',
                      size: 40,
                      ring: c.current ? Palette.gold : Palette.brassDark,
                    ),
                    const SizedBox(height: 4),
                    Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Palette.text, fontFamily: 'Cinzel')),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(2),
                      child: LinearProgressIndicator(
                        value: c.maxHp == 0 ? 0 : (c.hp / c.maxHp).clamp(0, 1).toDouble(),
                        minHeight: 4,
                        color: c.isPc ? Palette.hp : Palette.ember,
                        backgroundColor: Palette.line,
                      ),
                    ),
                  ]),
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
    required this.animate,
    required this.lastMasterId,
    required this.onMaster,
    required this.onSuggest,
    required this.onPeople,
    this.portraitBase,
  });
  final GameView view;
  final bool animate;
  final int lastMasterId;
  final ValueChanged<int> onMaster;
  final ValueChanged<String> onSuggest;
  final VoidCallback onPeople;
  final String? portraitBase;

  @override
  State<_Journal> createState() => _JournalState();
}

class _JournalState extends State<_Journal> {
  String? _ground;

  @override
  Widget build(BuildContext context) {
    final view = widget.view;
    final lastMaster = view.chat.where((c) => c.role == 'mestre').lastOrNull;
    final animate = widget.animate && lastMaster != null && lastMaster.id != widget.lastMasterId;
    if (lastMaster != null && lastMaster.id != widget.lastMasterId) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onMaster(lastMaster.id);
      });
    }
    final playerLine = lastMaster == null ? null : view.chat.where((c) => c.role != 'mestre' && c.id < lastMaster.id).lastOrNull;
    final earlier = view.chat.where((c) => lastMaster == null || c.id < (playerLine?.id ?? lastMaster.id)).toList();
    final after = lastMaster == null ? view.chat : view.chat.where((c) => c.id > lastMaster.id).toList();
    final location = view.location;

    return ListView(
      key: const Key('journal'),
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
      children: [
        if (location != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(location.name, style: displayStyle(size: 20)),
              if (location.parent != null) Text(location.parent!, style: const TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond', fontSize: 14)),
              if (location.exits.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final exit in location.exits)
                      ActionChip(
                        key: Key('exit-${exit.id}'),
                        materialTapTargetSize: MaterialTapTargetSize.padded,
                        label: Text('${exit.name} · ${exit.minutes} min'),
                        avatar: const Icon(Icons.signpost_outlined, size: 18, color: Palette.gold),
                        labelStyle: const TextStyle(color: Palette.text, fontFamily: 'EBGaramond', fontSize: 16),
                        backgroundColor: Palette.leatherRaised,
                        side: const BorderSide(color: Palette.brassDark),
                        onPressed: () => widget.onSuggest('Sigo para ${exit.name}.'),
                      ),
                  ]),
                ),
            ]),
          ),
        if (playerLine != null) _Note(message: playerLine),
        if (lastMaster != null || view.latestNarration.isNotEmpty)
          Parchment(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('O MESTRE', style: displayStyle(size: 13, color: Palette.inkEmph)),
              const SizedBox(height: 8),
              Narration(text: lastMaster?.text ?? view.latestNarration, animate: animate),
            ]),
          )
        else
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Text('Diga ao Mestre o que você quer fazer para começar.', style: TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond', fontSize: 18)),
          ),
        if (earlier.isNotEmpty)
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: Text('Páginas anteriores (${earlier.length})', style: const TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond')),
            children: [for (final message in earlier) _Note(message: message)],
          ),
        if (location != null && (location.summary.isNotEmpty || location.details.isNotEmpty))
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: const Text('O lugar', style: TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond')),
            children: [
              Parchment(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (location.summary.isNotEmpty) Text(location.summary),
                  if (location.details.isNotEmpty) Text(location.details, style: const TextStyle(color: Palette.inkSoft)),
                ]),
              ),
            ],
          ),
        for (final message in after) _Note(message: message),
        if (view.master.busy)
          const Padding(
            padding: EdgeInsets.only(top: 10),
            child: Text('O Mestre está narrando…', style: TextStyle(color: Palette.gold, fontFamily: 'EBGaramond', fontStyle: FontStyle.italic)),
          ),
        if (view.master.status == 'erro')
          Padding(padding: const EdgeInsets.only(top: 8), child: Text('O Mestre não respondeu: ${view.master.error ?? ''}', style: const TextStyle(color: Palette.failure))),
        if (view.present.isNotEmpty) ...[
          const SectionHeading('Em cena', onParchment: false),
          SizedBox(
            height: 132,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: view.present.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final npc = view.present[i];
                return LongPressDraggable<String>(
                  data: npc.id,
                  feedback: Material(color: Colors.transparent, child: _NpcToken(npc: npc, portraitBase: widget.portraitBase, wide: true)),
                  child: _NpcToken(npc: npc, portraitBase: widget.portraitBase, onTap: widget.onPeople),
                );
              },
            ),
          ),
        ],
        if (location != null && location.items.isNotEmpty) ...[
          const SectionHeading('No chão', onParchment: false),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final item in location.items)
              ActionChip(
                label: Text(item.qty > 1 ? '${item.qty}× ${item.name}' : item.name),
                onPressed: () => setState(() => _ground = _ground == item.id ? null : item.id),
              ),
          ]),
          if (_ground != null)
            for (final item in location.items.where((i) => i.id == _ground))
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Parchment(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(item.name, style: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600)),
                    if (item.effect != null) Text(item.effect!),
                    if (item.notes.isNotEmpty) Text(item.notes, style: const TextStyle(fontStyle: FontStyle.italic, color: Palette.inkSoft)),
                    const Text('Está no chão. Peça ao Mestre se quiser pegar.', style: TextStyle(color: Palette.inkSoft, fontSize: 14)),
                  ]),
                ),
              ),
        ],
      ],
    );
  }
}

class _NpcToken extends StatelessWidget {
  const _NpcToken({required this.npc, this.portraitBase, this.onTap, this.wide = false});
  final Npc npc;
  final String? portraitBase;
  final VoidCallback? onTap;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: wide ? 180 : 148,
      child: Parchment(
        padding: const EdgeInsets.all(8),
        child: InkWell(
          onTap: onTap,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              PortraitFace(name: npc.name, url: portraitUrl(npc.portrait, portraitBase), size: 36, ring: _tone(npc.attitudeLabel)),
              const SizedBox(width: 6),
              Expanded(child: Text(npc.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Cinzel', fontSize: 13, fontWeight: FontWeight.w600))),
            ]),
            Text(npc.attitudeLabel, style: TextStyle(color: _tone(npc.attitudeLabel), fontSize: 12)),
            if (npc.reaction != null) Text(npc.reaction!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Palette.inkEmph)),
          ]),
        ),
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
      return Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Parchment(child: Narration(text: message.text, animate: false)));
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
          border: Border.all(color: message.status == 'erro' ? Palette.failure : Palette.brassDark),
        ),
        child: Column(crossAxisAlignment: system ? CrossAxisAlignment.center : CrossAxisAlignment.end, children: [
          Text(cleanNarration(message.text), style: TextStyle(fontFamily: 'EBGaramond', fontSize: system ? 14 : 16, fontStyle: system ? FontStyle.italic : null, color: Palette.ink)),
          if (pending) const Text('enviando ao Mestre…', style: TextStyle(color: Palette.inkSoft, fontSize: 12)),
          if (message.status == 'erro') Text('não entregue: ${message.error}', style: const TextStyle(color: Palette.failure, fontSize: 12)),
        ]),
      ),
    );
  }
}

class _QuickUse extends StatelessWidget {
  const _QuickUse({required this.item, required this.enabled, required this.onItem});
  final Item item;
  final bool enabled;
  final ItemAct onItem;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
      child: Align(
        alignment: Alignment.centerRight,
        child: FilledButton.icon(
          key: const Key('quick-usar'),
          onPressed: enabled
              ? () async {
                  tableFeedback(context);
                  final text = await onItem('usar', item.id);
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text ?? 'Usar: ${item.name}')));
                }
              : null,
          icon: const Icon(Icons.local_drink_outlined),
          label: Text('Usar ${item.name}'),
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.onSend, required this.sending, required this.locked});
  final TextEditingController controller;
  final VoidCallback onSend;
  final bool sending, locked;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 8, 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: TextField(
            controller: controller,
            enabled: !locked,
            minLines: 1,
            maxLines: 4,
            maxLength: 4000,
            style: const TextStyle(color: Palette.ink, fontFamily: 'EBGaramond', fontSize: 17),
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => onSend(),
            decoration: InputDecoration(
              counterText: '',
              hintText: locked ? 'Role os dados pedidos pelo Mestre' : 'O que você faz?',
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
        ),
        const SizedBox(width: 8),
        IconButton.filled(
          onPressed: sending || locked ? null : onSend,
          icon: sending ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send_rounded),
          tooltip: 'Enviar ao Mestre',
          style: IconButton.styleFrom(minimumSize: const Size(52, 52), backgroundColor: Palette.ember, foregroundColor: Colors.white),
        ),
      ]),
    );
  }
}

class _QuickBar extends StatelessWidget {
  const _QuickBar({required this.order, required this.meta, required this.onOpen});
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
                    constraints: const BoxConstraints(minWidth: 72, minHeight: 52),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(meta(id).$1, color: Palette.gold, size: 22),
                      Text(meta(id).$2, style: const TextStyle(color: Palette.text, fontFamily: 'Cinzel', fontSize: 11)),
                    ]),
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
  const _Dock({required this.order, required this.meta, required this.anchor, required this.panel, required this.onReorder});
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
              decoration: BoxDecoration(color: Palette.leatherRaised, borderRadius: BorderRadius.circular(8), border: Border.all(color: Palette.brassDark)),
              child: Column(children: [
                Row(children: [
                  ReorderableDragStartListener(index: i, child: const SizedBox(width: 48, height: 48, child: Icon(Icons.drag_handle, color: Palette.gold))),
                  Icon(meta(order[i]).$1, color: Palette.gold, size: 18),
                  const SizedBox(width: 6),
                  Text(meta(order[i]).$2, style: displayStyle(size: 14)),
                ]),
                SizedBox(height: 420, child: panel(order[i], null)),
              ]),
            ),
          ),
      ],
    );
  }
}
