import 'dart:math';


import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/models.dart';
import '../dice3d/math3d.dart';
import '../dice3d/physics.dart';
import '../dice3d/renderer.dart';
import '../state/game_controller.dart';
import '../theme.dart';
import 'play_settings.dart';

final _rng = Random.secure();

/// Abre o pedido de rolagem do Mestre. Não pode ser fechado sem rolar: a rolagem não fica para depois.
Future<void> showRollSheet(BuildContext context, GameController game, RollRequest req) {
  return showModalBottomSheet<void>(
    context: context,
    isDismissible: false,
    enableDrag: false,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Palette.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (_) => PopScope(canPop: false, child: _RollSheet(game: game, req: req)),
  );
}

class _RollSheet extends StatefulWidget {
  const _RollSheet({required this.game, required this.req});
  final GameController game;
  final RollRequest req;

  @override
  State<_RollSheet> createState() => _RollSheetState();
}

class _RollSheetState extends State<_RollSheet> with SingleTickerProviderStateMixin {
  late final AnimationController _anim = AnimationController(vsync: this);
  // Antes do arremesso os dados já estão pousados na mesa.
  late Recording _rec = simulate(widget.req.dice, rng: _rng, strength: 0.15);
  int _frame = 1 << 30;
  Offset _drag = Offset.zero;
  RollOutcome? _outcome;
  String? _error;
  bool _rolling = false;

  static const _dieColors = [Color(0xFF9E2B1E), Color(0xFF7A2A1C), Color(0xFF3E5C8A), Color(0xFF2F6B4F), Color(0xFF6B4A8A), Color(0xFF8A6A2E)];

  @override
  void initState() {
    super.initState();
    _anim.addListener(() {
      final f = (_anim.value * (_rec.frames.length - 1)).round();
      if (f != _frame) {
        if (_rec.impacts.contains(f)) _feel(light: true);
        setState(() => _frame = f);
      }
    });
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  /// Arremessa: sorteia os valores (gerador seguro), simula a física e toca a gravação; depois o motor confere.
  Future<void> _roll({V3? dir, double strength = 0.75}) async {
    if (_rolling || _outcome != null) return;
    _feel();
    final values = widget.req.dice.map((s) => _rng.nextInt(s) + 1).toList();
    final rec = simulate(widget.req.dice, values: values, rng: _rng, throwDir: dir, strength: strength);
    setState(() {
      _rolling = true;
      _error = null;
      _rec = rec;
      _frame = 0;
    });
    _anim.duration = Duration(milliseconds: (rec.frames.length * 1000 / 60).round());
    await _anim.forward(from: 0);
    _feel(heavy: true);
    final err = await widget.game.resolveRoll(widget.req.id, values);
    if (!mounted) return;
    setState(() {
      _rolling = false;
      if (err != null) {
        _error = err;
      } else {
        _outcome = widget.game.lastOutcome;
      }
    });
  }

  void _feel({bool heavy = false, bool light = false}) {
    final settings = PlaySettingsScope.of(context);
    if (settings.haptics) {
      if (heavy) {
        HapticFeedback.heavyImpact();
      } else if (light) {
        HapticFeedback.lightImpact();
      } else {
        HapticFeedback.mediumImpact();
      }
    }
    if (settings.sounds) SystemSound.play(heavy ? SystemSoundType.alert : SystemSoundType.click);
  }

  /// Vantagem/desvantagem: o d20 descartado fica apagado; 20 natural mantido brilha.
  (Set<int>, Set<int>) _highlights() {
    final o = _outcome;
    if (o == null || o.kept.isEmpty) return (const {}, const {});
    final req = widget.req;
    final d20s = req.mode == 'normal' ? 1 : 2;
    var keptIndex = 0;
    if (d20s == 2 && o.dice.length >= 2) keptIndex = o.dice[0] == o.kept.first ? 0 : 1;
    final dimmed = d20s == 2 ? {1 - keptIndex} : <int>{};
    final glow = req.dice.isNotEmpty && req.dice.first == 20 && o.kept.first == 20 ? {keptIndex} : <int>{};
    return (dimmed, glow);
  }

  @override
  Widget build(BuildContext context) {
    final req = widget.req;
    final t = Theme.of(context).textTheme;
    final mod = req.modifier == 0 ? '' : (req.modifier > 0 ? ' + ${req.modifier}' : ' − ${-req.modifier}');
    final diceLabel = '${req.dice.length > 1 && req.dice.every((d) => d == req.dice.first) ? req.dice.length : ''}'
        '${req.dice.toSet().length == 1 ? 'd${req.dice.first}' : req.dice.map((d) => 'd$d').join(' + ')}$mod';
    final (dimmed, glow) = _highlights();
    final trayHeight = (MediaQuery.sizeOf(context).height * 0.36).clamp(220.0, 360.0);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Palette.line, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 16),
          Text('O MESTRE PEDE UMA ROLAGEM', textAlign: TextAlign.center, style: t.labelMedium?.copyWith(color: Palette.goldDim, letterSpacing: 2)),
          const SizedBox(height: 6),
          Text(req.label, textAlign: TextAlign.center, style: t.headlineMedium?.copyWith(fontSize: 26)),
          Text(req.whoName + (req.reason.isEmpty ? '' : ' · ${req.reason}'), textAlign: TextAlign.center, style: t.bodyMedium?.copyWith(color: Palette.textDim)),
          const SizedBox(height: 10),
          Wrap(alignment: WrapAlignment.center, spacing: 8, children: [
            _Chip(diceLabel),
            if (req.mode != 'normal') _Chip(req.mode == 'vantagem' ? 'Vantagem' : 'Desvantagem', color: req.mode == 'vantagem' ? Palette.success : Palette.failure),
            if (req.dc != null) _Chip('CD ${req.dc}', color: Palette.gold),
          ]),
          const SizedBox(height: 12),
          Semantics(
            label: _outcome == null ? 'Mesa de dados. Deslize ou toque para arremessar.' : 'Dados rolados',
            child: GestureDetector(
              onTap: () => _roll(),
              onPanStart: (_) => _drag = Offset.zero,
              onPanUpdate: (d) => _drag += d.delta,
              onPanEnd: (d) {
                // Direção e força pelo gesto: velocidade do "peteleco" ou, se lento, o próprio arrasto.
                final v = d.velocity.pixelsPerSecond;
                final g = v.distance >= 250 ? v : _drag * 6;
                if (g.distance < 40) {
                  _roll();
                } else {
                  _roll(dir: V3(g.dx, 0, g.dy), strength: (g.distance / 2600).clamp(0.3, 1.0));
                }
              },
              child: SizedBox(
                height: trayHeight,
                child: CustomPaint(
                  size: Size.infinite,
                  painter: DicePainter(recording: _rec, frame: _frame, colors: _dieColors, dimmed: dimmed, glow: glow),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          if (_outcome != null) _OutcomeBanner(outcome: _outcome!) else if (_error != null) Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Palette.failure)),
          const SizedBox(height: 12),
          if (_outcome == null)
            FilledButton.icon(
              onPressed: _rolling ? null : () => _roll(),
              icon: const Icon(Icons.casino_outlined),
              label: Text(_rolling ? 'Rolando…' : 'Rolar $diceLabel', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56), backgroundColor: Palette.ember, foregroundColor: Colors.white),
            )
          else
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
              child: const Text('Continuar', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            ),
          const SizedBox(height: 6),
          Text(_outcome == null ? 'Deslize na mesa para arremessar (ou toque em Rolar).' : 'O Mestre recebeu o resultado e vai narrar o que acontece.',
              textAlign: TextAlign.center, style: t.bodySmall?.copyWith(color: Palette.textDim)),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.text, {this.color = Palette.text});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(color: Palette.surfaceHigh, borderRadius: BorderRadius.circular(20), border: Border.all(color: color.withValues(alpha: 0.5))),
        child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
      );
}

class _OutcomeBanner extends StatelessWidget {
  const _OutcomeBanner({required this.outcome});
  final RollOutcome outcome;
  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (outcome.outcome) {
      'critico' => ('CRÍTICO!', Palette.gold),
      'sucesso' => ('SUCESSO', Palette.success),
      'falha_critica' => ('FALHA CRÍTICA', Palette.failure),
      'falha' => ('FALHA', Palette.failure),
      _ => ('RESULTADO', Palette.text),
    };
    final mod = outcome.modifier == 0 ? '' : (outcome.modifier > 0 ? ' + ${outcome.modifier}' : ' − ${-outcome.modifier}');
    return Column(children: [
      Text(label, style: displayStyle(size: 30, color: color).copyWith(letterSpacing: 2, fontWeight: FontWeight.w800)),
      Text('${outcome.kept.isEmpty ? outcome.dice.join(' + ') : outcome.kept.first}$mod = ${outcome.total}${outcome.dc != null ? ' vs ${outcome.dc}' : ''}',
          style: const TextStyle(fontSize: 16, color: Palette.textDim)),
    ]);
  }
}
