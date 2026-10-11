import 'package:flutter/material.dart';

import '../api/models.dart';
import '../state/game_controller.dart';
import '../theme.dart';
import 'narration.dart';
import 'widgets.dart';

/// Cena: narração atual, conversa com o Mestre, quem está presente e o campo para agir.
class SceneTab extends StatefulWidget {
  const SceneTab({super.key, required this.game});
  final GameController game;

  @override
  State<SceneTab> createState() => _SceneTabState();
}

class _SceneTabState extends State<SceneTab> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  int _lastMasterId = -1;

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    final err = await widget.game.send(text);
    if (!mounted) return;
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
    } else {
      _input.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.game.view!;
    final lastMaster = v.chat.where((c) => c.role == 'mestre').lastOrNull;
    final animate = lastMaster != null && lastMaster.id != _lastMasterId;
    if (lastMaster != null) _lastMasterId = lastMaster.id;
    // O que provocou a narração atual: a última fala do jogador ou aviso da mesa antes dela.
    final playerLine = lastMaster == null ? null : v.chat.where((c) => c.role != 'mestre' && c.id < lastMaster.id).lastOrNull;
    final earlier = v.chat.where((c) => lastMaster == null || c.id < (playerLine?.id ?? lastMaster.id)).toList();
    final after = lastMaster == null ? v.chat : v.chat.where((c) => c.id > lastMaster.id).toList();
    final locked = v.pendingRolls.isNotEmpty;

    return Column(
      children: [
        if (v.combat.isNotEmpty) CombatStrip(view: v),
        Expanded(
          child: ListView(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            children: [
              if (v.location != null) _PlaceHeader(location: v.location!, view: v),
              if (earlier.isNotEmpty)
                ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  title: Text('Conversa anterior (${earlier.length})', style: const TextStyle(color: Palette.textDim, fontSize: 13)),
                  children: [for (final m in earlier) ChatBubble(message: m)],
                ),
              if (playerLine != null) ChatBubble(message: playerLine),
              const SizedBox(height: 8),
              if (lastMaster != null || v.latestNarration.isNotEmpty)
                Container(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 4),
                  decoration: BoxDecoration(
                    color: Palette.surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: Palette.goldDim.withValues(alpha: 0.4)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(children: [
                        Icon(Icons.auto_stories_outlined, size: 16, color: Palette.gold),
                        SizedBox(width: 6),
                        Text('O MESTRE', style: TextStyle(color: Palette.gold, fontSize: 12, letterSpacing: 2, fontWeight: FontWeight.w700)),
                      ]),
                      const SizedBox(height: 10),
                      Narration(text: lastMaster?.text ?? v.latestNarration, animate: animate),
                    ],
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Text('Diga ao Mestre o que você quer fazer para começar.', style: narrationStyle(context).copyWith(color: Palette.textDim)),
                ),
              for (final m in after) ChatBubble(message: m),
              if (v.master.busy) MasterThinking(master: v.master),
              if (v.master.status == 'erro')
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text('O Mestre não respondeu: ${v.master.error ?? ''}', style: const TextStyle(color: Palette.failure)),
                ),
              const SizedBox(height: 16),
              if (v.present.isNotEmpty) ...[
                const SectionTitle('Em cena'),
                for (final n in v.present) NpcCard(npc: n),
              ],
              if (v.location?.items.isNotEmpty ?? false) ...[
                const SectionTitle('No chão'),
                Wrap(spacing: 8, runSpacing: 8, children: [for (final i in v.location!.items) Chip(label: Text(i.qty > 1 ? '${i.qty}× ${i.name}' : i.name))]),
              ],
            ],
          ),
        ),
        _Composer(controller: _input, onSend: _send, sending: widget.game.sending || v.master.busy, locked: locked),
      ],
    );
  }
}

class _PlaceHeader extends StatelessWidget {
  const _PlaceHeader({required this.location, required this.view});
  final Location location;
  final GameView view;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(location.name, style: t.titleLarge),
          Text(
            [if (location.parent != null) location.parent!, 'Dia ${view.day} · ${view.time} · ${view.period}'].join(' · '),
            style: t.bodySmall?.copyWith(color: Palette.textDim),
          ),
          const SizedBox(height: 6),
          Text(location.summary, style: t.bodyMedium?.copyWith(color: Palette.textDim)),
          if (location.exits.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final e in location.exits)
                Chip(
                  avatar: const Icon(Icons.signpost_outlined, size: 16),
                  label: Text('${e.name} · ${e.minutes} min'),
                  visualDensity: VisualDensity.compact,
                ),
            ]),
          ],
        ],
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
    return Material(
      color: Palette.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  enabled: !locked,
                  minLines: 1,
                  maxLines: 5,
                  maxLength: 4000,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => onSend(),
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: locked ? 'Role os dados pedidos pelo Mestre' : 'O que você faz?',
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: sending || locked ? null : onSend,
                icon: sending ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send_rounded),
                tooltip: 'Enviar ao Mestre',
                style: IconButton.styleFrom(minimumSize: const Size(52, 52)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
