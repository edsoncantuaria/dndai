import 'package:flutter/material.dart';

import '../../theme.dart';

/// Chave de classe do motor (`guerreiro`, `mago`…) a partir da chave ou do rótulo.
String classKeyOf(String key, String label) {
  final raw = (key.isNotEmpty ? key : label).toLowerCase();
  final folded = raw.replaceAll(RegExp(r'[áàãâ]'), 'a').replaceAll(RegExp(r'[éê]'), 'e').replaceAll(RegExp(r'[íî]'), 'i').replaceAll(RegExp(r'[óôõ]'), 'o').replaceAll(RegExp(r'[úü]'), 'u').replaceAll(RegExp(r'[^a-z]'), '');
  const aliases = {
    'barbaro': 'barbaro', 'barbarian': 'barbaro',
    'bardo': 'bardo', 'bard': 'bardo',
    'bruxo': 'bruxo', 'warlock': 'bruxo',
    'clerigo': 'clerigo', 'cleric': 'clerigo',
    'druida': 'druida', 'druid': 'druida',
    'feiticeiro': 'feiticeiro', 'sorcerer': 'feiticeiro',
    'guerreiro': 'guerreiro', 'fighter': 'guerreiro',
    'ladino': 'ladino', 'rogue': 'ladino',
    'mago': 'mago', 'wizard': 'mago',
    'monge': 'monge', 'monk': 'monge',
    'paladino': 'paladino', 'paladin': 'paladino',
    'patrulheiro': 'patrulheiro', 'ranger': 'patrulheiro',
  };
  return aliases[folded] ?? 'outro';
}

class ClassSigil extends StatelessWidget {
  const ClassSigil({super.key, required this.classKey, this.label = '', this.size = 36, this.color = Palette.brass});
  final String classKey;
  final String label;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final key = classKeyOf(classKey, label);
    final name = label.isNotEmpty ? label : key;
    return Semantics(
      label: 'Classe $name',
      child: CustomPaint(size: Size.square(size), painter: _SigilPainter(key, color)),
    );
  }
}

class _SigilPainter extends CustomPainter {
  _SigilPainter(this.kind, this.color);
  final String kind;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.shortestSide * 0.08
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final w = size.width;
    final h = size.height;
    final c = Offset(w / 2, h / 2);
    switch (kind) {
      case 'guerreiro':
        canvas.drawLine(Offset(w * 0.5, h * 0.12), Offset(w * 0.5, h * 0.72), p);
        canvas.drawLine(Offset(w * 0.28, h * 0.28), Offset(w * 0.72, h * 0.28), p);
        canvas.drawLine(Offset(w * 0.38, h * 0.72), Offset(w * 0.62, h * 0.72), p);
        canvas.drawLine(Offset(w * 0.42, h * 0.72), Offset(w * 0.5, h * 0.9), p);
        canvas.drawLine(Offset(w * 0.58, h * 0.72), Offset(w * 0.5, h * 0.9), p);
      case 'mago':
        final path = Path()
          ..moveTo(w * 0.5, h * 0.08)
          ..lineTo(w * 0.58, h * 0.4)
          ..lineTo(w * 0.92, h * 0.4)
          ..lineTo(w * 0.64, h * 0.58)
          ..lineTo(w * 0.74, h * 0.92)
          ..lineTo(w * 0.5, h * 0.7)
          ..lineTo(w * 0.26, h * 0.92)
          ..lineTo(w * 0.36, h * 0.58)
          ..lineTo(w * 0.08, h * 0.4)
          ..lineTo(w * 0.42, h * 0.4)
          ..close();
        canvas.drawPath(path, p);
      case 'ladino':
        canvas.drawLine(Offset(w * 0.62, h * 0.12), Offset(w * 0.28, h * 0.78), p);
        canvas.drawLine(Offset(w * 0.22, h * 0.62), Offset(w * 0.42, h * 0.7), p);
        canvas.drawCircle(Offset(w * 0.3, h * 0.84), w * 0.06, fill);
      case 'clerigo':
        canvas.drawLine(Offset(w * 0.5, h * 0.1), Offset(w * 0.5, h * 0.9), p);
        canvas.drawLine(Offset(w * 0.22, h * 0.32), Offset(w * 0.78, h * 0.32), p);
      case 'patrulheiro':
        canvas.drawArc(Rect.fromCircle(center: Offset(w * 0.58, h * 0.5), radius: w * 0.32), 1.2, 3.8, false, p);
        canvas.drawLine(Offset(w * 0.3, h * 0.18), Offset(w * 0.3, h * 0.82), p);
      case 'paladino':
        final shield = Path()
          ..moveTo(w * 0.5, h * 0.08)
          ..lineTo(w * 0.86, h * 0.22)
          ..lineTo(w * 0.78, h * 0.62)
          ..lineTo(w * 0.5, h * 0.92)
          ..lineTo(w * 0.22, h * 0.62)
          ..lineTo(w * 0.14, h * 0.22)
          ..close();
        canvas.drawPath(shield, p);
        canvas.drawLine(Offset(w * 0.5, h * 0.28), Offset(w * 0.5, h * 0.7), p);
      case 'barbaro':
        canvas.drawLine(Offset(w * 0.18, h * 0.78), Offset(w * 0.72, h * 0.16), p);
        canvas.drawLine(Offset(w * 0.58, h * 0.12), Offset(w * 0.88, h * 0.28), p);
        canvas.drawLine(Offset(w * 0.62, h * 0.34), Offset(w * 0.86, h * 0.22), p);
      case 'bardo':
        canvas.drawCircle(Offset(w * 0.34, h * 0.62), w * 0.12, p);
        canvas.drawLine(Offset(w * 0.46, h * 0.58), Offset(w * 0.7, h * 0.18), p);
        canvas.drawLine(Offset(w * 0.7, h * 0.18), Offset(w * 0.78, h * 0.42), p);
      case 'druida':
        canvas.drawOval(Rect.fromCenter(center: c, width: w * 0.46, height: h * 0.72), p);
        canvas.drawLine(Offset(w * 0.5, h * 0.16), Offset(w * 0.5, h * 0.84), p);
      case 'feiticeiro':
        final flame = Path()
          ..moveTo(w * 0.5, h * 0.08)
          ..quadraticBezierTo(w * 0.86, h * 0.4, w * 0.62, h * 0.58)
          ..quadraticBezierTo(w * 0.9, h * 0.78, w * 0.5, h * 0.92)
          ..quadraticBezierTo(w * 0.1, h * 0.78, w * 0.38, h * 0.58)
          ..quadraticBezierTo(w * 0.14, h * 0.4, w * 0.5, h * 0.08);
        canvas.drawPath(flame, p);
      case 'bruxo':
        canvas.drawOval(Rect.fromCenter(center: c, width: w * 0.78, height: h * 0.42), p);
        canvas.drawCircle(c, w * 0.1, fill);
      case 'monge':
        canvas.drawCircle(c, w * 0.28, p);
        canvas.drawCircle(c, w * 0.08, fill);
      default:
        canvas.drawLine(Offset(w * 0.5, h * 0.12), Offset(w * 0.86, h * 0.5), p);
        canvas.drawLine(Offset(w * 0.86, h * 0.5), Offset(w * 0.5, h * 0.88), p);
        canvas.drawLine(Offset(w * 0.5, h * 0.88), Offset(w * 0.14, h * 0.5), p);
        canvas.drawLine(Offset(w * 0.14, h * 0.5), Offset(w * 0.5, h * 0.12), p);
    }
  }

  @override
  bool shouldRepaint(covariant _SigilPainter old) => old.kind != kind || old.color != color;
}

IconData conditionIcon(String condition) {
  final k = condition.toLowerCase().replaceAll(RegExp(r'[áàãâ]'), 'a').replaceAll(RegExp(r'[éê]'), 'e').replaceAll(RegExp(r'[íî]'), 'i').replaceAll(RegExp(r'[óôõ]'), 'o').replaceAll(RegExp(r'[^a-z]'), '');
  return switch (k) {
    'agarrado' => Icons.link,
    'amedrontado' => Icons.mood_bad_outlined,
    'atordoado' => Icons.stars_outlined,
    'caido' => Icons.arrow_downward,
    'cego' => Icons.visibility_off_outlined,
    'contido' => Icons.lock_outline,
    'enfeiticado' => Icons.auto_fix_high,
    'envenenado' => Icons.water_drop_outlined,
    'exausto' => Icons.bedtime_outlined,
    'impedido' => Icons.block,
    'incapacitado' => Icons.personal_injury_outlined,
    'inconsciente' => Icons.nights_stay_outlined,
    'invisivel' => Icons.blur_on,
    'paralisado' => Icons.flash_off_outlined,
    'petrificado' => Icons.landscape_outlined,
    'surdo' => Icons.hearing_disabled,
    _ => Icons.brightness_1_outlined,
  };
}

class ConditionChip extends StatelessWidget {
  const ConditionChip(this.condition, {super.key, this.onParchment = false});
  final String condition;
  final bool onParchment;

  @override
  Widget build(BuildContext context) {
    final color = onParchment ? Palette.ink : Palette.gold;
    return Semantics(
      label: 'Condição $condition',
      child: Container(
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        constraints: const BoxConstraints(minHeight: 32),
        decoration: BoxDecoration(
          color: (onParchment ? Palette.ink : Palette.ember).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.7)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(conditionIcon(condition), size: 16, color: color),
          const SizedBox(width: 4),
          Text(condition, style: TextStyle(fontFamily: 'EBGaramond', fontSize: 14, color: color)),
        ]),
      ),
    );
  }
}
