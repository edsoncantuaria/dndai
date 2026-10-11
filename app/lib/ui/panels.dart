import 'package:flutter/material.dart';

import '../api/models.dart';
import '../state/game_controller.dart';
import '../theme.dart';
import 'narration.dart';
import 'widgets.dart';

const _abilityNames = {'for': 'FOR', 'des': 'DES', 'con': 'CON', 'int': 'INT', 'sab': 'SAB', 'car': 'CAR'};
String _signed(int n) => n >= 0 ? '+$n' : '$n';

/// Ficha do personagem.
class SheetTab extends StatelessWidget {
  const SheetTab({super.key, required this.view});
  final GameView view;
  @override
  Widget build(BuildContext context) {
    final pc = view.pc;
    if (pc == null) return const _Empty('O personagem ainda não foi criado. Converse com o Mestre para criá-lo.');
    final t = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(pc.name, style: t.headlineMedium),
        Text('${pc.race} · ${pc.classLabel} nível ${pc.level} · XP ${pc.xp}${pc.nextLevelXp != null ? '/${pc.nextLevelXp}' : ''}', style: const TextStyle(color: Palette.textDim)),
        if (pc.levelUpReady) const Padding(padding: EdgeInsets.only(top: 6), child: Text('Subida de nível disponível — peça ao Mestre.', style: TextStyle(color: Palette.gold))),
        const SectionTitle('Atributos'),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 1.25,
          children: [
            for (final e in _abilityNames.entries)
              if (pc.abilities[e.key] case final a?)
                Card(
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(e.value, style: const TextStyle(color: Palette.goldDim, fontSize: 12, letterSpacing: 1.5)),
                    Text(_signed(a.mod), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                    Text('${a.score}', style: const TextStyle(color: Palette.textDim, fontSize: 12)),
                  ]),
                ),
          ],
        ),
        const SectionTitle('Combate'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          _Pill('CA', '${pc.ac}'),
          _Pill('PV', '${pc.hp}/${pc.maxHp}'),
          _Pill('Iniciativa', _signed(pc.initiative)),
          _Pill('Deslocamento', '${pc.speed} m'),
          _Pill('Proficiência', _signed(pc.profBonus)),
          _Pill('Percepção passiva', '${pc.passivePerception}'),
          if (pc.hp == 0 && pc.status != 'morto') _Pill('Contra a morte', '${pc.deathSuccess}✓ ${pc.deathFail}✗'),
        ]),
        const SectionTitle('Salvaguardas'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final e in _abilityNames.entries)
            if (pc.abilities[e.key] case final a?) _Pill(e.value, _signed(a.save), highlight: a.proficientSave),
        ]),
        const SectionTitle('Perícias'),
        Card(
          child: Column(children: [
            for (final s in pc.skills)
              ListTile(
                dense: true,
                leading: Icon(s.expertise ? Icons.star : (s.proficient ? Icons.circle : Icons.circle_outlined), size: 14, color: s.proficient ? Palette.gold : Palette.line),
                title: Text(s.label),
                subtitle: Text(_abilityNames[s.ability] ?? s.ability, style: const TextStyle(fontSize: 11, color: Palette.textDim)),
                trailing: Text(_signed(s.bonus), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              ),
          ]),
        ),
        if (pc.spellSaveDc != null) ...[
          const SectionTitle('Magia'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            _Pill('CD', '${pc.spellSaveDc}'),
            _Pill('Ataque', _signed(pc.spellAttack ?? 0)),
            for (final s in pc.slots) _Pill('${s.level}º círculo', '${s.max - s.used}/${s.max}'),
          ]),
          if (pc.spells.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(pc.spells.join(' · '), style: const TextStyle(color: Palette.textDim))),
        ],
        if (pc.features.isNotEmpty) ...[
          const SectionTitle('Habilidades'),
          for (final f in pc.features) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('• $f')),
        ],
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, this.value, {this.highlight = false});
  final String label, value;
  final bool highlight;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Palette.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: highlight ? Palette.gold : Palette.line),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text(label, style: const TextStyle(fontSize: 11, color: Palette.textDim)),
        ]),
      );
}

/// Bolsa: itens e moedas. As ações são exatamente as que o motor permite agora.
class BagTab extends StatelessWidget {
  const BagTab({super.key, required this.game});
  final GameController game;

  static const _labels = {'usar': 'Usar', 'equipar': 'Equipar', 'guardar': 'Guardar', 'empunhar': 'Empunhar', 'embainhar': 'Embainhar', 'largar': 'Largar'};
  static const _icons = {
    'usar': Icons.local_drink_outlined,
    'equipar': Icons.shield_outlined,
    'guardar': Icons.backpack_outlined,
    'empunhar': Icons.gavel,
    'embainhar': Icons.do_not_touch_outlined,
    'largar': Icons.file_download_outlined,
  };

  Future<void> _act(BuildContext context, String action, Item item) async {
    final messenger = ScaffoldMessenger.of(context);
    final err = await game.itemAction(action, item.id);
    messenger.showSnackBar(SnackBar(content: Text(err ?? game.lastActionText ?? '${_labels[action]}: ${item.name}')));
  }

  @override
  Widget build(BuildContext context) {
    final v = game.view!;
    final pc = v.pc;
    if (pc == null) return const _Empty('Sem personagem.');
    final locked = v.pendingRolls.isNotEmpty;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(children: [
          _Coin('po', pc.po, Palette.gold),
          _Coin('pp', pc.pp, const Color(0xFFC0C6CC)),
          _Coin('pc', pc.pcCoins, const Color(0xFFB87333)),
        ]),
        if (locked) const Padding(padding: EdgeInsets.only(top: 12), child: Text('Role os dados pedidos pelo Mestre antes de usar itens.', style: TextStyle(color: Palette.ember))),
        const SectionTitle('Inventário'),
        if (pc.inventory.isEmpty) const Text('Vazio.', style: TextStyle(color: Palette.textDim)),
        for (final item in pc.inventory)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: item.drawn ? Palette.ember : (item.equipped ? Palette.gold : Palette.line)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(item.qty > 1 ? '${item.qty}× ${item.name}' : item.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                    if (item.drawn) const Text('EM PUNHO', style: TextStyle(color: Palette.ember, fontSize: 11, fontWeight: FontWeight.w800))
                    else if (item.equipped) const Text('EQUIPADO', style: TextStyle(color: Palette.gold, fontSize: 11, fontWeight: FontWeight.w800)),
                  ]),
                  if (item.effect != null) Text(item.effect!, style: const TextStyle(color: Palette.textDim, fontSize: 13)),
                  if (item.notes.isNotEmpty) Text(item.notes, style: const TextStyle(color: Palette.textDim, fontSize: 12, fontStyle: FontStyle.italic)),
                  if (item.actions.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final a in item.actions)
                        OutlinedButton.icon(
                          onPressed: locked || game.sending ? null : () => _act(context, a, item),
                          icon: Icon(_icons[a], size: 18),
                          label: Text(_labels[a] ?? a),
                          style: OutlinedButton.styleFrom(minimumSize: const Size(48, 44)),
                        ),
                    ]),
                  ],
                ]),
              ),
            ),
          ),
      ],
    );
  }
}

class _Coin extends StatelessWidget {
  const _Coin(this.label, this.value, this.color);
  final String label;
  final int value;
  final Color color;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Column(children: [
              Icon(Icons.circle, color: color, size: 18),
              Text('$value', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              Text(label, style: const TextStyle(color: Palette.textDim, fontSize: 12)),
            ]),
          ),
        ),
      );
}

/// Mapa: locais conhecidos do multiverso agrupados por região, com as ligações.
class MapTab extends StatelessWidget {
  const MapTab({super.key, required this.view});
  final GameView view;
  @override
  Widget build(BuildContext context) {
    if (view.places.isEmpty) return const _Empty('Nenhum local descoberto ainda.');
    final byId = {for (final p in view.places) p.id: p};
    final roots = view.places.where((p) => p.parent == null || !byId.containsKey(p.parent)).toList();
    List<MapPlace> childrenOf(String id) => view.places.where((p) => p.parent == id).toList();
    Widget node(MapPlace p, int depth) {
      final links = view.links.where((l) => l.from == p.id).toList();
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: EdgeInsets.only(left: depth * 18.0, bottom: 6),
          child: Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: p.current ? Palette.gold : Palette.line, width: p.current ? 2 : 1)),
            child: ListTile(
              leading: Icon(p.current ? Icons.my_location : (p.visited ? Icons.place : Icons.help_outline), color: p.current ? Palette.gold : (p.visited ? Palette.text : Palette.textDim)),
              title: Text(p.name, style: TextStyle(fontWeight: p.current ? FontWeight.w800 : FontWeight.w500)),
              subtitle: Text(
                [p.kind, if (!p.visited) 'inexplorado', for (final l in links) if (byId[l.to] case final to?) '→ ${to.name} (${l.minutes} min)'].join(' · '),
                style: const TextStyle(fontSize: 12, color: Palette.textDim),
              ),
            ),
          ),
        ),
        for (final c in childrenOf(p.id)) node(c, depth + 1),
      ]);
    }

    return ListView(padding: const EdgeInsets.all(16), children: [for (final r in roots) node(r, 0)]);
  }
}

/// Diário: missões, fatos conhecidos e a crônica.
class JournalTab extends StatelessWidget {
  const JournalTab({super.key, required this.view});
  final GameView view;
  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(view.campaignName, style: Theme.of(context).textTheme.headlineMedium),
        Text(view.premise, style: const TextStyle(color: Palette.textDim)),
        const SectionTitle('Missões'),
        if (view.quests.isEmpty) const Text('Nenhuma missão.', style: TextStyle(color: Palette.textDim)),
        for (final q in view.quests)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(q.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                    Text(q.status, style: TextStyle(color: q.status == 'ativa' ? Palette.gold : Palette.textDim, fontSize: 12)),
                  ]),
                  Text(q.summary, style: const TextStyle(color: Palette.textDim)),
                  for (final (text, done) in q.objectives)
                    Row(children: [
                      Icon(done ? Icons.check_box : Icons.check_box_outline_blank, size: 18, color: done ? Palette.success : Palette.textDim),
                      const SizedBox(width: 6),
                      Expanded(child: Text(text, style: TextStyle(decoration: done ? TextDecoration.lineThrough : null))),
                    ]),
                ]),
              ),
            ),
          ),
        const SectionTitle('O que você sabe'),
        if (view.facts.isEmpty) const Text('Nada registrado.', style: TextStyle(color: Palette.textDim)),
        for (final (text, day) in view.facts) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('Dia $day · $text')),
        const SectionTitle('Crônica'),
        for (final t in view.journal.reversed)
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: Text('Turno ${t.n} · Dia ${t.day}, ${t.time}', style: const TextStyle(fontSize: 13, color: Palette.goldDim)),
            subtitle: Text(t.summary.isEmpty ? t.action : t.summary),
            children: [if (t.narration.isNotEmpty) Narration(text: t.narration, animate: false)],
          ),
      ],
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(32), child: Text(text, textAlign: TextAlign.center, style: const TextStyle(color: Palette.textDim))));
}
