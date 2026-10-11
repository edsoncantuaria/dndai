import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme.dart';
import 'narration.dart';

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 18, 0, 8),
        child: Text(text.toUpperCase(), style: const TextStyle(color: Palette.goldDim, fontSize: 12, letterSpacing: 2, fontWeight: FontWeight.w700)),
      );
}

Color attitudeColor(String label) => switch (label) {
      'hostil' => Palette.failure,
      'desconfiado' => const Color(0xFFD08A3C),
      'amigável' => Palette.success,
      'leal' => Palette.gold,
      _ => Palette.textDim,
    };

class NpcCard extends StatelessWidget {
  const NpcCard({super.key, required this.npc});
  final Npc npc;
  @override
  Widget build(BuildContext context) {
    final color = attitudeColor(npc.attitudeLabel);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: color.withValues(alpha: 0.18),
                child: Text(npc.name.characters.first, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 18)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Flexible(child: Text(npc.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                      if (npc.companion) const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.shield_moon_outlined, size: 16, color: Palette.gold)),
                    ]),
                    Text(npc.summary, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Palette.textDim, fontSize: 13)),
                    const SizedBox(height: 6),
                    Wrap(spacing: 6, runSpacing: 4, children: [
                      _Tag(npc.attitudeLabel, color),
                      if (npc.hp != null) _Tag('${npc.hp}/${npc.maxHp} PV', Palette.hp),
                      if (npc.status != 'vivo') _Tag(npc.status, Palette.failure),
                    ]),
                    if (npc.reaction != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Row(children: [
                          const Icon(Icons.warning_amber_rounded, size: 16, color: Palette.ember),
                          const SizedBox(width: 4),
                          Expanded(child: Text(npc.reaction!, style: const TextStyle(color: Palette.ember, fontSize: 13, fontStyle: FontStyle.italic))),
                        ]),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag(this.text, this.color);
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
        child: Text(text, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
      );
}

class ChatBubble extends StatelessWidget {
  const ChatBubble({super.key, required this.message});
  final ChatMessage message;
  @override
  Widget build(BuildContext context) {
    if (message.role == 'mestre') {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Narration(text: message.text, animate: false));
    }
    final system = message.role == 'sistema';
    final pending = message.status != 'entregue' && message.status != 'erro';
    return Align(
      alignment: system ? Alignment.center : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: const BoxConstraints(maxWidth: 520),
        decoration: BoxDecoration(
          color: system ? Colors.transparent : Palette.surfaceHigh,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: message.status == 'erro' ? Palette.failure : (system ? Palette.line : Palette.goldDim.withValues(alpha: 0.35))),
        ),
        child: Column(
          crossAxisAlignment: system ? CrossAxisAlignment.center : CrossAxisAlignment.end,
          children: [
            Text(cleanNarration(message.text),
                textAlign: system ? TextAlign.center : TextAlign.start,
                style: TextStyle(color: system ? Palette.textDim : Palette.text, fontSize: system ? 12.5 : 15, fontStyle: system ? FontStyle.italic : null)),
            if (pending) const Padding(padding: EdgeInsets.only(top: 4), child: Text('enviando ao Mestre…', style: TextStyle(color: Palette.textDim, fontSize: 11))),
            if (message.status == 'erro') Padding(padding: const EdgeInsets.only(top: 4), child: Text('não entregue: ${message.error}', style: const TextStyle(color: Palette.failure, fontSize: 11))),
          ],
        ),
      ),
    );
  }
}

class MasterThinking extends StatelessWidget {
  const MasterThinking({super.key, required this.master});
  final MasterState master;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Row(children: [
          const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Palette.gold)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              master.status == 'na_fila' ? 'O Mestre vai ler sua jogada…' : 'O Mestre está narrando${master.activity != null ? ' · ${master.activity}' : '…'}',
              style: const TextStyle(color: Palette.textDim, fontStyle: FontStyle.italic),
            ),
          ),
        ]),
      );
}

/// Faixa de iniciativa (estilo BG3) quando há combate.
class CombatStrip extends StatelessWidget {
  const CombatStrip({super.key, required this.view});
  final GameView view;
  @override
  Widget build(BuildContext context) => Container(
        height: 76,
        color: Palette.surface,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          children: [
            Center(child: Padding(padding: const EdgeInsets.only(right: 10), child: Text('R${view.combatRound}', style: const TextStyle(color: Palette.gold, fontWeight: FontWeight.w800)))),
            for (final c in view.combat)
              Container(
                width: 92,
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: c.current ? Palette.gold.withValues(alpha: 0.15) : Palette.surfaceHigh,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: c.current ? Palette.gold : (c.isPc ? Palette.mana : Palette.line), width: c.current ? 2 : 1),
                ),
                child: Opacity(
                  opacity: c.status == 'morto' ? 0.4 : 1,
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    LinearProgressIndicator(value: (c.hp / c.maxHp).clamp(0, 1), minHeight: 5, color: c.isPc ? Palette.hp : Palette.ember, backgroundColor: Palette.line, borderRadius: BorderRadius.circular(3)),
                    Text('${c.initiative} · ${c.hp}/${c.maxHp}', style: const TextStyle(fontSize: 11, color: Palette.textDim)),
                  ]),
                ),
              ),
          ],
        ),
      );
}

/// Barra do herói (PV, CA, condições) — fica sempre visível.
class HeroBar extends StatelessWidget {
  const HeroBar({super.key, required this.pc});
  final Pc pc;
  @override
  Widget build(BuildContext context) {
    final ratio = (pc.hp / pc.maxHp).clamp(0.0, 1.0);
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
      decoration: const BoxDecoration(color: Palette.surface, border: Border(bottom: BorderSide(color: Palette.line))),
      child: Row(children: [
        CircleAvatar(radius: 20, backgroundColor: Palette.gold.withValues(alpha: 0.18), child: Text(pc.name.characters.first, style: const TextStyle(color: Palette.gold, fontWeight: FontWeight.w800))),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(pc.name, style: const TextStyle(fontWeight: FontWeight.w700))),
              Text('  ${pc.classLabel} ${pc.level}', style: const TextStyle(color: Palette.textDim, fontSize: 12)),
              if (pc.levelUpReady) const Padding(padding: EdgeInsets.only(left: 6), child: Icon(Icons.keyboard_double_arrow_up, size: 16, color: Palette.gold)),
            ]),
            const SizedBox(height: 4),
            Semantics(
              label: 'Pontos de vida ${pc.hp} de ${pc.maxHp}',
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(value: ratio, minHeight: 8, color: ratio < 0.35 ? Palette.hpLow : Palette.hp, backgroundColor: Palette.line),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              ['${pc.hp}/${pc.maxHp} PV${pc.tempHp > 0 ? ' +${pc.tempHp}' : ''}', if (pc.status != 'vivo') pc.status.toUpperCase(), ...pc.conditions].join(' · '),
              style: TextStyle(fontSize: 11.5, color: pc.status == 'vivo' ? Palette.textDim : Palette.failure),
            ),
          ]),
        ),
        const SizedBox(width: 12),
        _Stat('CA', '${pc.ac}'),
        _Stat('INIC', pc.initiative >= 0 ? '+${pc.initiative}' : '${pc.initiative}'),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Container(
        width: 52,
        margin: const EdgeInsets.only(left: 6),
        padding: const EdgeInsets.symmetric(vertical: 4),
        decoration: BoxDecoration(color: Palette.surfaceHigh, borderRadius: BorderRadius.circular(10), border: Border.all(color: Palette.line)),
        child: Column(children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text(label, style: const TextStyle(fontSize: 10, color: Palette.textDim)),
        ]),
      );
}
