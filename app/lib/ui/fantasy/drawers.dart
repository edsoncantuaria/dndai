import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../api/models.dart';
import '../../theme.dart';
import '../play_settings.dart';
import 'chrome.dart';
import 'sigils.dart';

typedef ResourceAct = Future<String?> Function(String resource, int amount);
typedef LevelUpAct = Future<String?> Function({
  String hpMode,
  String? subclass,
  String? asi,
  String? feat,
  Map<String, List<String>>? choices,
});
typedef RestAct = Future<String?> Function({String kind, int dice});

class SheetDrawer extends StatelessWidget {
  const SheetDrawer({super.key, required this.view, this.scroll, this.onResource, this.onLevelUp, this.onRest, this.busy = false});
  final GameView view;
  final ScrollController? scroll;
  final ResourceAct? onResource;
  final LevelUpAct? onLevelUp;
  final RestAct? onRest;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final pc = view.pc;
    if (pc == null) {
      return ListView(controller: scroll, padding: const EdgeInsets.all(16), children: const [Parchment(child: EmptyNote('O personagem ainda não foi criado. Converse com o Mestre para criá-lo.'))]);
    }
    return ListView(
      controller: scroll,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Parchment(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              ClassSigil(classKey: pc.classKey, label: pc.classLabel, size: 48, color: Palette.ink),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(pc.name, style: displayStyle(size: 26, color: Palette.ink)),
                  Text(
                    [pc.race, pc.classLabel, if (pc.subclass.isNotEmpty) pc.subclass, 'nível ${pc.level}'].where((s) => s.isNotEmpty).join(' · '),
                    style: const TextStyle(color: Palette.inkSoft),
                  ),
                  if (pc.background.isNotEmpty) Text(pc.background, style: const TextStyle(color: Palette.inkSoft, fontStyle: FontStyle.italic)),
                ]),
              ),
            ]),
            if (pc.levelUpReady)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: FilledButton.icon(
                  icon: const Icon(Icons.arrow_upward, color: Palette.gold),
                  label: const Text('Subir de Nível'),
                  onPressed: onLevelUp != null ? () => _showLevelUpDialog(context, pc) : null,
                ),
              ),
            if (pc.nextLevelXp != null) ...[
              const SizedBox(height: 8),
              Text('XP ${pc.xp} / ${pc.nextLevelXp}', style: const TextStyle(color: Palette.inkSoft, fontSize: 14)),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: (pc.xp / pc.nextLevelXp!).clamp(0, 1),
                  minHeight: 6,
                  color: Palette.inkEmph,
                  backgroundColor: Palette.parchmentDeep,
                ),
              ),
            ],
            const SectionHeading('Atributos'),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 0.95,
              children: [
                for (final key in abilityOrder)
                  if (pc.abilities[key] case final ability?)
                    DecoratedBox(
                      decoration: BoxDecoration(color: Palette.parchmentDeep, border: Border.all(color: Palette.brassDark, width: 2), borderRadius: BorderRadius.circular(4)),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Text(abilityShort[key]!, style: const TextStyle(fontFamily: 'Cinzel', fontSize: 12, letterSpacing: 1.2, color: Palette.inkEmph)),
                        Text(signed(ability.mod), style: const TextStyle(fontFamily: 'Cinzel', fontSize: 26, fontWeight: FontWeight.w600, color: Palette.ink)),
                        Text('${ability.score}', style: const TextStyle(color: Palette.inkSoft, fontSize: 13)),
                      ]),
                    ),
              ],
            ),
            const SectionHeading('Combate'),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _StatPlate('CA', '${pc.ac}'),
              _StatPlate('PV', '${pc.hp}/${pc.maxHp}${pc.tempHp > 0 ? ' +${pc.tempHp}' : ''}'),
              _StatPlate('Iniciativa', signed(pc.initiative)),
              _StatPlate('Desloc.', '${pc.speed} m'),
              _StatPlate('Prof.', signed(pc.profBonus)),
              _StatPlate('Percepção', '${pc.passivePerception}'),
            ]),
            if (pc.hp == 0 && pc.status != 'morto') ...[
              const SectionHeading('Testes contra a morte'),
              Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, runSpacing: 6, children: [
                const Text('Sucessos'),
                for (var i = 0; i < 3; i++) _DeathPip(filled: i < pc.deathSuccess, good: true),
                const SizedBox(width: 8),
                const Text('Falhas'),
                for (var i = 0; i < 3; i++) _DeathPip(filled: i < pc.deathFail, good: false),
              ]),
            ],
            if (pc.conditions.isNotEmpty) ...[
              const SectionHeading('Condições'),
              Wrap(children: [for (final c in pc.conditions) ConditionChip(c, onParchment: true)]),
            ],
            if (pc.hitDie > 0) ...[
              const SectionHeading('Dados de vida & Descanso'),
              Text('d${pc.hitDie} · ${pc.hitDiceMax - pc.hitDiceUsed}/${pc.hitDiceMax} dados disponíveis'),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.bedtime_outlined, size: 16),
                    label: const Text('Descanso Curto', style: TextStyle(fontSize: 12)),
                    onPressed: onRest != null && pc.hitDiceMax - pc.hitDiceUsed > 0 ? () => _rest(context, 'short') : null,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    icon: const Icon(Icons.nightlight_round, size: 16),
                    label: const Text('Descanso Longo', style: TextStyle(fontSize: 12)),
                    onPressed: onRest != null ? () => _rest(context, 'long') : null,
                  ),
                ),
              ]),
            ],
            const SectionHeading('Salvaguardas'),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final key in abilityOrder)
                if (pc.abilities[key] case final ability?) _StatPlate(abilityShort[key]!, signed(ability.save), highlight: ability.proficientSave),
            ]),
            const SectionHeading('Perícias'),
            for (final skill in pc.skills)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(children: [
                  Icon(skill.expertise ? Icons.star : (skill.proficient ? Icons.circle : Icons.circle_outlined), size: 14, color: skill.proficient ? Palette.inkEmph : Palette.inkSoft),
                  const SizedBox(width: 8),
                  Expanded(child: Text(skill.label)),
                  Text(abilityShort[skill.ability] ?? skill.ability, style: const TextStyle(color: Palette.inkSoft, fontSize: 13)),
                  const SizedBox(width: 10),
                  Text(signed(skill.bonus), style: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, fontSize: 16)),
                ]),
              ),
            if (pc.resources.isNotEmpty) ...[
              const SectionHeading('Recursos de habilidades'),
              for (final resource in pc.resources)
                _ResourceCard(resource: resource, locked: busy || view.pendingRolls.isNotEmpty, onResource: onResource),
            ],
            for (final group in {'race': 'Características raciais', 'class': 'Habilidades de classe', 'subclass': 'Habilidades de arquétipo', 'feat': 'Talentos'}.entries)
              if (pc.featureDetails.any((f) => f.source == group.key)) ...[
                SectionHeading(group.value),
                for (final feature in pc.featureDetails.where((f) => f.source == group.key))
                  ExpansionTile(title: Text(feature.name), children: [Padding(padding: const EdgeInsets.all(8), child: Text(feature.description))]),
              ],
            if (pc.pendingChoices.isNotEmpty) ...[
              const SectionHeading('Escolhas pendentes'),
              const Text('Combine suas escolhas com o Mestre no chat.'),
              for (final choice in pc.pendingChoices) Padding(padding: const EdgeInsets.only(top: 6), child: Text(choice)),
            ],
            if (pc.features.any((name) => !pc.featureDetails.any((f) => f.name == name))) ...[
              const SectionHeading('Habilidades'),
              for (final feature in pc.features.where((name) => !pc.featureDetails.any((f) => f.name == name))) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text('• $feature')),
            ],
            const SectionHeading('Moedas'),
            Text('${pc.po} ouro · ${pc.pp} prata · ${pc.pcCoins} cobre'),
          ]),
        ),
      ],
    );
  }

  Future<void> _showLevelUpDialog(BuildContext context, Pc pc) async {
    String hpMode = 'media';
    final targetLevel = pc.level + 1;
    final needSubclass = pc.subclass.isEmpty && targetLevel >= 3;
    final isAsiLevel = targetLevel % 4 == 0;
    String? selectedSubclass;
    String asiChoice = 'for+2';

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Subir para Nível $targetLevel', style: const TextStyle(fontFamily: 'Cinzel', color: Palette.gold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Parabéns pela evolução de ${pc.name}!'),
                const SizedBox(height: 12),
                const Text('Pontos de Vida (PV):', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'media', label: Text('Média da classe')),
                    ButtonSegment(value: 'rolar', label: Text('Rolar dado')),
                  ],
                  selected: {hpMode},
                  onSelectionChanged: (set) => setDialogState(() => hpMode = set.first),
                ),
                if (needSubclass) ...[
                  const SizedBox(height: 12),
                  const Text('Arquétipo / Subclasse:', style: TextStyle(fontWeight: FontWeight.w600)),
                  TextField(
                    decoration: const InputDecoration(hintText: 'Ex: campeao, ladrao, evocacao'),
                    onChanged: (v) => selectedSubclass = v.trim(),
                  ),
                ],
                if (isAsiLevel) ...[
                  const SizedBox(height: 12),
                  const Text('Aumento de Atributo (ASI):', style: TextStyle(fontWeight: FontWeight.w600)),
                  TextField(
                    decoration: const InputDecoration(hintText: 'Ex: for+2 ou des+1,con+1'),
                    onChanged: (v) => asiChoice = v.trim(),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            FilledButton(
              onPressed: () async {
                Navigator.pop(ctx);
                final res = await onLevelUp!(
                  hpMode: hpMode,
                  subclass: selectedSubclass,
                  asi: isAsiLevel ? asiChoice : null,
                );
                if (context.mounted && res != null) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res)));
                }
              },
              child: const Text('Confirmar Evolução'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _rest(BuildContext context, String kind) async {
    final res = await onRest!(kind: kind, dice: 1);
    if (context.mounted && res != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res)));
    }
  }
}

class _ResourceCard extends StatefulWidget {
  const _ResourceCard({required this.resource, required this.locked, required this.onResource});
  final TrackedResource resource;
  final bool locked;
  final ResourceAct? onResource;
  @override
  State<_ResourceCard> createState() => _ResourceCardState();
}

class _ResourceCardState extends State<_ResourceCard> {
  int _amount = 1;
  bool _sending = false;
  Future<void> _use() async {
    if (_sending || widget.locked || widget.onResource == null) return;
    setState(() => _sending = true);
    try {
      tableFeedback(context);
      final text = await widget.onResource!(widget.resource.id, _amount);
      if (mounted && text != null) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }
  @override
  Widget build(BuildContext context) {
    final r = widget.resource;
    final enabled = r.available && !widget.locked && !_sending && widget.onResource != null;
    final points = ['cura-pelas-maos', 'ki', 'pontos-de-feiticaria'].contains(r.id);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${r.name}: ${r.unlimited ? 'Ilimitado' : '${r.max - r.used}/${r.max}'}', style: const TextStyle(fontWeight: FontWeight.w700)),
        Text(r.effect),
        Text('Recarga: descanso ${r.resetsOn == 'short' ? 'curto ou longo' : 'longo'}', style: const TextStyle(color: Palette.inkSoft, fontSize: 12)),
        Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, children: [
          if (points) ...[
            IconButton(tooltip: 'Gastar menos pontos', onPressed: enabled && _amount > 1 ? () => setState(() => _amount--) : null, icon: const Icon(Icons.remove)),
            Text('$_amount ponto(s)'),
            IconButton(tooltip: 'Gastar mais pontos', onPressed: enabled && _amount < r.max - r.used ? () => setState(() => _amount++) : null, icon: const Icon(Icons.add)),
          ],
          OutlinedButton(onPressed: enabled ? _use : null, child: Text(r.id == 'cura-pelas-maos' ? 'Curar a si mesmo' : 'Usar ${r.name}')),
        ]),
      ]),
    );
  }
}

class _StatPlate extends StatelessWidget {
  const _StatPlate(this.label, this.value, {this.highlight = false});
  final String label, value;
  final bool highlight;

  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minWidth: 72, minHeight: 48),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Palette.parchmentDeep,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: highlight ? Palette.inkEmph : Palette.brassDark, width: highlight ? 2 : 1),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(value, style: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, fontSize: 16, color: Palette.ink)),
          Text(label, style: const TextStyle(fontSize: 12, color: Palette.inkSoft)),
        ]),
      );
}

class _DeathPip extends StatelessWidget {
  const _DeathPip({required this.filled, required this.good});
  final bool filled, good;

  @override
  Widget build(BuildContext context) => Container(
        width: 16,
        height: 16,
        margin: const EdgeInsets.symmetric(horizontal: 3),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: filled ? (good ? Palette.success : Palette.failure) : Colors.transparent,
          border: Border.all(color: good ? Palette.success : Palette.failure, width: 2),
        ),
      );
}

typedef ItemAct = Future<String?> Function(String action, String itemId);

class BagDrawer extends StatelessWidget {
  const BagDrawer({super.key, required this.view, required this.onItem, this.locked = false, this.busy = false, this.scroll});
  final GameView view;
  final ItemAct onItem;
  final bool locked, busy;
  final ScrollController? scroll;

  @override
  Widget build(BuildContext context) {
    final pc = view.pc;
    if (pc == null) return const Center(child: EmptyNote('Sem personagem.'));
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Segure um item e solte em Equipar ou Usar. Os botões continuam disponíveis.', style: TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond', fontSize: 14)),
          if (locked) const Padding(padding: EdgeInsets.only(top: 6), child: Text('Role os dados pedidos pelo Mestre antes de usar itens.', style: TextStyle(color: Palette.gold))),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _DropZone(id: 'equipar', label: 'Equipar ou empunhar', icon: Icons.shield_outlined, enabled: !locked && !busy, inventory: pc.inventory, onItem: onItem)),
            const SizedBox(width: 8),
            Expanded(child: _DropZone(id: 'usar', label: 'Usar', icon: Icons.local_drink_outlined, enabled: !locked && !busy, inventory: pc.inventory, onItem: onItem)),
          ]),
        ]),
      ),
      Expanded(
        child: ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            if (pc.inventory.isEmpty) const Parchment(child: EmptyNote('A bolsa está vazia.')),
            for (final item in pc.inventory)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _ItemCard(item: item, locked: locked || busy, onItem: onItem),
              ),
          ],
        ),
      ),
    ]);
  }
}

class _DropZone extends StatelessWidget {
  const _DropZone({required this.id, required this.label, required this.icon, required this.enabled, required this.inventory, required this.onItem});
  final String id, label;
  final IconData icon;
  final bool enabled;
  final List<Item> inventory;
  final ItemAct onItem;

  @override
  Widget build(BuildContext context) {
    return DragTarget<String>(
      onWillAcceptWithDetails: (_) => enabled,
      onAcceptWithDetails: (details) async {
        final matches = inventory.where((it) => it.id == details.data);
        if (matches.isEmpty) return;
        final item = matches.first;
        final messenger = ScaffoldMessenger.of(context);
        if (!enabled) {
          messenger.showSnackBar(const SnackBar(content: Text('Role os dados primeiro.')));
          return;
        }
        final action = id == 'usar'
            ? (item.actions.contains('usar') ? 'usar' : null)
            : (item.actions.contains('empunhar') ? 'empunhar' : (item.actions.contains('equipar') ? 'equipar' : null));
        if (action == null) {
          messenger.showSnackBar(SnackBar(content: Text('${item.name} não pode ${id == 'usar' ? 'ser usado' : 'ser equipado'} agora.')));
          return;
        }
        final text = await onItem(action, item.id);
        if (!context.mounted) return;
        messenger.showSnackBar(SnackBar(content: Text(text ?? '${itemActionLabels[action]}: ${item.name}')));
      },
      builder: (context, candidate, _) {
        final hot = candidate.isNotEmpty;
        return Semantics(
          label: 'Soltar aqui para $label',
          child: Container(
            key: Key('drop-$id'),
            constraints: const BoxConstraints(minHeight: 64),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            decoration: BoxDecoration(
              color: hot ? Palette.brass.withValues(alpha: 0.25) : Palette.leatherRaised,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: hot ? Palette.gold : Palette.brassDark, width: hot ? 2 : 1),
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, color: Palette.gold, size: 20),
              const SizedBox(width: 6),
              Flexible(child: Text(label, textAlign: TextAlign.center, style: const TextStyle(color: Palette.text, fontFamily: 'Cinzel', fontSize: 13))),
            ]),
          ),
        );
      },
    );
  }
}

class _ItemCard extends StatefulWidget {
  const _ItemCard({required this.item, required this.locked, required this.onItem});
  final Item item;
  final bool locked;
  final ItemAct onItem;

  @override
  State<_ItemCard> createState() => _ItemCardState();
}

class _ItemCardState extends State<_ItemCard> {
  bool _open = false;

  Future<void> _act(String action) async {
    final messenger = ScaffoldMessenger.of(context);
    final text = await widget.onItem(action, widget.item.id);
    if (!mounted) return;
    messenger.showSnackBar(SnackBar(content: Text(text ?? '${itemActionLabels[action]}: ${widget.item.name}')));
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final color = rarityColor(item.rarity);
    final haptics = PlaySettingsScope.of(context).haptics;
    Widget card() => Parchment(
      color: color,
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(_kindIcon(item.kind), size: 20, color: color ?? Palette.ink),
          const SizedBox(width: 8),
          Expanded(child: Text(item.qty > 1 ? '${item.qty}× ${item.name}' : item.name, style: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, fontSize: 16, color: Palette.ink))),
          if (item.rarity != null) Text(item.rarity!, style: TextStyle(color: color, fontSize: 12, fontFamily: 'Cinzel')),
        ]),
        if (item.drawn)
          const Text('EM PUNHO', style: TextStyle(color: Palette.failure, fontSize: 12, fontWeight: FontWeight.w700))
        else if (item.equipped)
          const Text('EQUIPADO', style: TextStyle(color: Palette.inkEmph, fontSize: 12, fontWeight: FontWeight.w700)),
        if (item.effect != null) Text(item.effect!, style: const TextStyle(color: Palette.inkSoft)),
        if (_open && item.notes.isNotEmpty) Text(item.notes, style: const TextStyle(color: Palette.inkSoft, fontStyle: FontStyle.italic)),
        if (_open && item.actions.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final action in item.actions)
              OutlinedButton(
                onPressed: widget.locked ? null : () => _act(action),
                child: Text(itemActionLabels[action] ?? action),
              ),
          ]),
        ],
      ]),
    );
    return LongPressDraggable<String>(
      data: item.id,
      delay: const Duration(milliseconds: 220),
      hapticFeedbackOnStart: haptics,
      dragAnchorStrategy: pointerDragAnchorStrategy,
      feedback: Material(color: Colors.transparent, child: SizedBox(width: 220, child: card())),
      childWhenDragging: Opacity(opacity: 0.35, child: card()),
      child: Semantics(
        button: true,
        label: '${item.name}${item.rarity != null ? ', raridade ${item.rarity}' : ''}. Toque para ver ações. Segure para arrastar.',
        child: GestureDetector(
          key: Key('item-${item.id}'),
          onTap: () => setState(() => _open = !_open),
          child: card(),
        ),
      ),
    );
  }
}

IconData _kindIcon(String kind) {
  final k = kind.toLowerCase();
  if (k.contains('arma')) return Icons.gavel;
  if (k.contains('armadura') || k.contains('escudo')) return Icons.shield_outlined;
  if (k.contains('consum') || k.contains('poç') || k.contains('poc')) return Icons.local_drink_outlined;
  if (k.contains('manto') || k.contains('anel') || k.contains('amuleto')) return Icons.diamond_outlined;
  return Icons.inventory_2_outlined;
}

class SpellbookDrawer extends StatelessWidget {
  const SpellbookDrawer({super.key, required this.view, this.scroll});
  final GameView view;
  final ScrollController? scroll;

  @override
  Widget build(BuildContext context) {
    final pc = view.pc;
    final slots = pc?.slots ?? const <Slot>[];
    final spells = pc?.spells ?? const <String>[];
    return ListView(
      controller: scroll,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Parchment(
          child: pc == null || (pc.spellSaveDc == null && spells.isEmpty && slots.isEmpty)
              ? const EmptyNote('Este personagem não conjura magias.')
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Grimório', style: displayStyle(size: 22, color: Palette.ink)),
                  if (pc.spellAbilityLabel != null) Text('Atributo: ${pc.spellAbilityLabel}', style: const TextStyle(color: Palette.inkSoft)),
                  if (pc.spellSaveDc != null) Text('CD ${pc.spellSaveDc} · ataque ${signed(pc.spellAttack ?? 0)}'),
                  const SectionHeading('Espaços'),
                  if (slots.isEmpty) const EmptyNote('Nenhum espaço de magia.'),
                  for (final slot in slots) ...[
                    Text('${slot.level}º círculo · ${slot.max - slot.used}/${slot.max}', style: const TextStyle(fontFamily: 'Cinzel', fontSize: 14)),
                    const SizedBox(height: 4),
                    Semantics(
                      label: 'Círculo ${slot.level}: ${slot.max - slot.used} de ${slot.max} espaços',
                      child: Wrap(spacing: 6, runSpacing: 6, children: [
                        for (var i = 0; i < slot.max; i++)
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: i < slot.max - slot.used ? Palette.mana : Colors.transparent,
                              border: Border.all(color: Palette.mana, width: 2),
                            ),
                          ),
                      ]),
                    ),
                    const SizedBox(height: 10),
                  ],
                  const SectionHeading('Magias conhecidas'),
                  if (spells.isEmpty) const EmptyNote('Nenhuma magia listada na ficha.'),
                  for (final spell in spells)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(spell, style: const TextStyle(fontSize: 17)),
                    ),
                ]),
        ),
      ],
    );
  }
}

class QuestDrawer extends StatelessWidget {
  const QuestDrawer({super.key, required this.view, this.scroll});
  final GameView view;
  final ScrollController? scroll;

  @override
  Widget build(BuildContext context) {
    return ListView(
      controller: scroll,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: 8),
          child: Text(
            'Missões e fatos que você já conhece. Ganchos que só o Mestre guarda não aparecem aqui.',
            style: TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond'),
          ),
        ),
        Parchment(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(view.campaignName, style: displayStyle(size: 22, color: Palette.ink)),
            if (view.premise.isNotEmpty) Text(view.premise, style: const TextStyle(color: Palette.inkSoft)),
            if (view.tone.isNotEmpty) Text(view.tone, style: const TextStyle(color: Palette.inkSoft, fontStyle: FontStyle.italic)),
            const SectionHeading('Missões'),
            if (view.quests.isEmpty) const EmptyNote('Nenhuma missão anotada.'),
            for (final quest in view.quests)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(quest.title, style: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, fontSize: 16))),
                    Text(quest.status, style: TextStyle(color: quest.status == 'ativa' ? Palette.inkEmph : Palette.inkSoft, fontSize: 13)),
                  ]),
                  if (quest.giver != null) Text('De ${quest.giver}', style: const TextStyle(color: Palette.inkSoft, fontSize: 14)),
                  Text(quest.summary),
                  for (final (text, done) in quest.objectives)
                    Row(children: [
                      Icon(done ? Icons.check_box : Icons.check_box_outline_blank, size: 20, color: done ? Palette.success : Palette.inkSoft),
                      const SizedBox(width: 6),
                      Expanded(child: Text(text, style: TextStyle(decoration: done ? TextDecoration.lineThrough : null))),
                    ]),
                ]),
              ),
            const SectionHeading('O que você sabe'),
            if (view.facts.isEmpty) const EmptyNote('Nada registrado ainda.'),
            for (final fact in view.facts)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text('Dia ${fact.day}${fact.about != null ? ' · ${fact.about}' : ''} · ${fact.text}'),
              ),
            const SectionHeading('Crônica'),
            for (final turn in view.journal.reversed)
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: Text('Turno ${turn.n} · Dia ${turn.day}, ${turn.time}', style: const TextStyle(fontSize: 14, color: Palette.inkEmph, fontFamily: 'Cinzel')),
                subtitle: Text(turn.summary.isEmpty ? turn.action : turn.summary, style: const TextStyle(color: Palette.ink)),
                children: [if (turn.narration.isNotEmpty) Text(turn.narration, style: const TextStyle(color: Palette.ink))],
              ),
          ]),
        ),
      ],
    );
  }
}

class PeopleDrawer extends StatefulWidget {
  const PeopleDrawer({super.key, required this.view, this.scroll, this.portraitBase});
  final GameView view;
  final ScrollController? scroll;
  final String? portraitBase;

  @override
  State<PeopleDrawer> createState() => _PeopleDrawerState();
}

class _PeopleDrawerState extends State<PeopleDrawer> {
  late List<String> _order = [for (final n in widget.view.present) n.id];

  @override
  void didUpdateWidget(PeopleDrawer old) {
    super.didUpdateWidget(old);
    final ids = [for (final n in widget.view.present) n.id];
    _order = [..._order.where(ids.contains), ...ids.where((id) => !_order.contains(id))];
  }

  @override
  Widget build(BuildContext context) {
    final byId = {for (final n in widget.view.present) n.id: n};
    if (byId.isEmpty) {
      return ListView(controller: widget.scroll, padding: const EdgeInsets.all(16), children: const [Parchment(child: EmptyNote('Não há ninguém com você neste local.'))]);
    }
    return Column(children: [
      const Padding(
        padding: EdgeInsets.fromLTRB(16, 4, 16, 8),
        child: Text('Arraste pelo puxador para ordenar nesta tela. Atitude, PV e reação vêm do motor.', style: TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond', fontSize: 14)),
      ),
      Expanded(
        child: ReorderableListView.builder(
          scrollController: widget.scroll,
          buildDefaultDragHandles: false,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          itemCount: _order.length,
          onReorderItem: (oldIndex, newIndex) {
            setState(() {
              final id = _order.removeAt(oldIndex);
              _order.insert(newIndex, id);
            });
          },
          itemBuilder: (context, index) {
            final npc = byId[_order[index]]!;
            return Padding(
              key: ValueKey(npc.id),
              padding: const EdgeInsets.only(bottom: 8),
              child: _PersonCard(npc: npc, index: index, portraitBase: widget.portraitBase),
            );
          },
        ),
      ),
    ]);
  }
}

class _PersonCard extends StatefulWidget {
  const _PersonCard({required this.npc, required this.index, this.portraitBase});
  final Npc npc;
  final int index;
  final String? portraitBase;

  @override
  State<_PersonCard> createState() => _PersonCardState();
}

class _PersonCardState extends State<_PersonCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final npc = widget.npc;
    final color = _attitude(npc.attitudeLabel);
    return Parchment(
      color: color,
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          ReorderableDragStartListener(
            index: widget.index,
            child: const SizedBox(width: 48, height: 48, child: Icon(Icons.drag_handle, color: Palette.inkSoft)),
          ),
          PortraitFace(name: npc.name, url: portraitUrl(npc.portrait, widget.portraitBase), size: 48, ring: color),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _open = !_open),
              behavior: HitTestBehavior.opaque,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(npc.name, style: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, fontSize: 16)),
                Text(npc.attitudeLabel, style: TextStyle(color: color, fontSize: 13)),
                if (!_open) Text(npc.summary, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Palette.inkSoft, fontSize: 14)),
              ]),
            ),
          ),
          IconButton(
            tooltip: _open ? 'Recolher' : 'Expandir',
            onPressed: () => setState(() => _open = !_open),
            icon: Icon(_open ? Icons.expand_less : Icons.expand_more),
          ),
        ]),
        if (_open) ...[
          const SizedBox(height: 6),
          Text(npc.summary),
          const SizedBox(height: 6),
          Wrap(spacing: 6, runSpacing: 6, children: [
            if (npc.companion) const Text('Companheiro', style: TextStyle(color: Palette.inkEmph)),
            if (npc.hp != null) Text('${npc.hp}/${npc.maxHp} PV'),
            if (npc.status != 'vivo') Text(npc.status, style: const TextStyle(color: Palette.failure)),
          ]),
          if (npc.reaction != null) Text(npc.reaction!, style: const TextStyle(fontStyle: FontStyle.italic, color: Palette.inkEmph)),
        ],
      ]),
    );
  }
}

Color _attitude(String label) => switch (label) {
      'hostil' => Palette.failure,
      'desconfiado' => Palette.legendary,
      'amigável' => Palette.success,
      'leal' => Palette.inkEmph,
      _ => Palette.inkSoft,
    };

class MapDrawer extends StatefulWidget {
  const MapDrawer({super.key, required this.view, this.scroll});
  final GameView view;
  final ScrollController? scroll;

  @override
  State<MapDrawer> createState() => _MapDrawerState();
}

class _MapDrawerState extends State<MapDrawer> {
  final _transform = TransformationController();
  Map<String, Offset> _pos = {};

  @override
  void initState() {
    super.initState();
    _pos = _layout(widget.view);
  }

  @override
  void didUpdateWidget(MapDrawer old) {
    super.didUpdateWidget(old);
    for (final place in widget.view.places) {
      _pos.putIfAbsent(place.id, () => const Offset(24, 24));
    }
    _pos.removeWhere((id, _) => widget.view.places.every((p) => p.id != id));
  }

  @override
  void dispose() {
    _transform.dispose();
    super.dispose();
  }

  Map<String, Offset> _layout(GameView view) {
    final byId = {for (final p in view.places) p.id: p};
    int depth(MapPlace place) {
      var d = 0;
      var id = place.parent;
      final seen = <String>{};
      while (id != null && byId.containsKey(id) && seen.add(id) && d < 12) {
        d++;
        id = byId[id]!.parent;
      }
      return d;
    }

    final counts = <int, int>{};
    final out = <String, Offset>{};
    for (final place in view.places) {
      final d = depth(place);
      final i = counts[d] ?? 0;
      counts[d] = i + 1;
      out[place.id] = Offset(16 + d * 190, 16 + i * 96);
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final view = widget.view;
    if (view.places.isEmpty) {
      return ListView(controller: widget.scroll, padding: const EdgeInsets.all(16), children: const [Parchment(child: EmptyNote('Nenhum local descoberto ainda.'))]);
    }
    final byId = {for (final p in view.places) p.id: p};
    var maxX = 640.0;
    var maxY = 420.0;
    for (final offset in _pos.values) {
      maxX = math.max(maxX, offset.dx + 200);
      maxY = math.max(maxY, offset.dy + 110);
    }
    final here = view.places.where((p) => p.current).firstOrNull;
    return LayoutBuilder(builder: (context, constraints) {
      return Column(children: [
      const Padding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
        child: Text('Arraste os locais para olhar o mapa. O caminho em si não muda — para viajar, diga ao Mestre.', style: TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond')),
      ),
      if (here != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Text('Você está em ${here.name}', style: const TextStyle(color: Palette.gold, fontFamily: 'Cinzel', fontWeight: FontWeight.w600, fontSize: 16)),
        ),
      Expanded(
        flex: 3,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: DecoratedBox(
            decoration: BoxDecoration(color: Palette.parchmentDeep, border: Border.all(color: Palette.brassDark, width: 2), borderRadius: BorderRadius.circular(8)),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: InteractiveViewer(
                transformationController: _transform,
                constrained: false,
                minScale: 0.55,
                maxScale: 2.4,
                boundaryMargin: const EdgeInsets.all(120),
                child: SizedBox(
                  width: maxX,
                  height: maxY,
                  child: Stack(children: [
                    Positioned.fill(child: CustomPaint(painter: _LinkPainter(links: view.links, pos: _pos, byId: byId))),
                    for (final place in view.places)
                      Positioned(
                        left: _pos[place.id]?.dx ?? 0,
                        top: _pos[place.id]?.dy ?? 0,
                        child: GestureDetector(
                          onPanUpdate: (d) {
                            final scale = _transform.value.getMaxScaleOnAxis();
                            setState(() => _pos[place.id] = (_pos[place.id] ?? Offset.zero) + d.delta / scale);
                          },
                          child: _PlaceToken(place: place),
                        ),
                      ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
      Expanded(
        child: ListView(
          controller: widget.scroll,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            const SectionHeading('Locais', onParchment: false),
            for (final place in view.places)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  '${place.current ? 'Você está em ' : ''}${place.name} · ${place.kind}${place.visited ? '' : ' · inexplorado'}',
                  style: const TextStyle(color: Palette.text, fontFamily: 'EBGaramond'),
                ),
              ),
            if (view.location != null && view.location!.exits.isNotEmpty) ...[
              const SectionHeading('Saídas daqui', onParchment: false),
              for (final exit in view.location!.exits)
                Text('${exit.name} · ${exit.minutes} min${exit.via.isNotEmpty ? ' · ${exit.via}' : ''}', style: const TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond')),
            ],
          ],
        ),
      ),
    ]);
    });
  }
}

class _PlaceToken extends StatelessWidget {
  const _PlaceToken({required this.place});
  final MapPlace place;

  @override
  Widget build(BuildContext context) => Semantics(
        label: '${place.name}, ${place.kind}${place.current ? ', você está aqui' : ''}',
        child: Container(
          width: 168,
          constraints: const BoxConstraints(minHeight: 64),
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Palette.parchment,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: place.current ? Palette.inkEmph : Palette.brassDark, width: place.current ? 2.5 : 1.5),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(place.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, fontSize: 14, color: Palette.ink)),
            Text(place.visited ? place.kind : 'inexplorado', style: const TextStyle(color: Palette.inkSoft, fontSize: 12)),
          ]),
        ),
      );
}

class _LinkPainter extends CustomPainter {
  _LinkPainter({required this.links, required this.pos, required this.byId});
  final List<MapLink> links;
  final Map<String, Offset> pos;
  final Map<String, MapPlace> byId;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Palette.brassDark
      ..strokeWidth = 2;
    for (final link in links) {
      final a = pos[link.from];
      final b = pos[link.to];
      if (a == null || b == null || !byId.containsKey(link.to)) continue;
      canvas.drawLine(a + const Offset(84, 32), b + const Offset(84, 32), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _LinkPainter old) => true;
}
