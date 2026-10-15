import 'package:flutter/material.dart';

import '../../theme.dart';
import 'sigils.dart';

class LeatherBackdrop extends StatelessWidget {
  const LeatherBackdrop({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Material(
        color: Colors.transparent,
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(0, -0.6),
              radius: 1.3,
              colors: [
                Color(0xFF160B0E), // Toque ember sutil
                Color(0xFF09090C),
                Palette.obsidian,
              ],
            ),
          ),
          child: child,
        ),
      );
}

class Parchment extends StatelessWidget {
  const Parchment({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.color});
  final Widget child;
  final EdgeInsets padding;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final edge = color ?? const Color(0x40D4AF37);
    return Material(
      color: Palette.parchment,
      elevation: 6,
      shadowColor: Colors.black.withValues(alpha: 0.7),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: edge, width: 1.2),
      ),
      child: Padding(
        padding: padding,
        child: DefaultTextStyle.merge(
          style: const TextStyle(fontFamily: 'EBGaramond', color: Palette.ink, fontSize: 16.5, height: 1.5),
          child: IconTheme.merge(data: const IconThemeData(color: Palette.gold), child: child),
        ),
      ),
    );
  }
}

class SectionHeading extends StatelessWidget {
  const SectionHeading(this.text, {super.key, this.onParchment = true});
  final String text;
  final bool onParchment;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 16, 0, 8),
        child: Text(
          text.toUpperCase(),
          style: TextStyle(
            fontFamily: 'Cinzel',
            fontSize: 13,
            letterSpacing: 1.6,
            fontWeight: FontWeight.w600,
            color: Palette.goldBright,
          ),
        ),
      );
}

class EmptyNote extends StatelessWidget {
  const EmptyNote(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Text(text, style: const TextStyle(color: Palette.inkSoft, fontFamily: 'EBGaramond', fontSize: 16)),
      );
}

String? portraitUrl(String? portrait, String? base) {
  if (portrait == null || portrait.isEmpty) return null;
  final uri = Uri.tryParse(portrait);
  if (uri != null && uri.hasScheme && (uri.scheme == 'http' || uri.scheme == 'https')) return portrait;
  if (base == null || base.isEmpty || portrait.contains('://')) return null;
  final root = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
  return '$root${portrait.startsWith('/') ? portrait : '/$portrait'}';
}

class PortraitFace extends StatelessWidget {
  const PortraitFace({super.key, required this.name, this.url, this.classKey = '', this.classLabel = '', this.size = 48, this.ring = Palette.brass});
  final String name;
  final String? url;
  final String classKey;
  final String classLabel;
  final double size;
  final Color ring;

  @override
  Widget build(BuildContext context) {
    final initial = name.isEmpty ? '?' : name.characters.first.toUpperCase();
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: ring, width: 2),
        color: Palette.parchmentDeep,
        boxShadow: const [
          BoxShadow(color: Color(0x40000000), blurRadius: 4, offset: Offset(0, 2)),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(fit: StackFit.expand, children: [
        Center(
          child: classKey.isNotEmpty || classLabel.isNotEmpty
              ? ClassSigil(classKey: classKey, label: classLabel, size: size * 0.62, color: Palette.goldBright)
              : Text(initial, style: TextStyle(fontFamily: 'Cinzel', fontSize: size * 0.38, color: Palette.goldBright, fontWeight: FontWeight.w600)),
        ),
        if (url != null)
          Image.network(
            url!,
            fit: BoxFit.cover,
            cacheWidth: (size * 2).round(),
            errorBuilder: (_, _, _) => const SizedBox.shrink(),
            frameBuilder: (context, child, frame, _) => frame == null ? const SizedBox.shrink() : child,
          ),
      ]),
    );
  }
}

Future<void> openDrawer(BuildContext context, {required String title, required Widget Function(ScrollController scroll) body}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    useSafeArea: true,
    builder: (ctx) => DraggableScrollableSheet(
      initialChildSize: 0.84,
      minChildSize: 0.36,
      maxChildSize: 0.96,
      snap: true,
      builder: (ctx, scroll) => Material(
        color: Palette.obsidianRaised,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
          side: BorderSide(color: Color(0x60D4AF37), width: 1.2),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(children: [
          const SizedBox(height: 10),
          Container(width: 44, height: 4, decoration: BoxDecoration(color: Palette.goldDim, borderRadius: BorderRadius.circular(2))),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
            child: Text(title, style: displayStyle(size: 20)),
          ),
          const Divider(height: 1, color: Color(0x30D4AF37)),
          Expanded(child: body(scroll)),
        ]),
      ),
    ),
  );
}

String signed(int n) => n >= 0 ? '+$n' : '$n';

const abilityOrder = ['for', 'des', 'con', 'int', 'sab', 'car'];
const abilityShort = {'for': 'FOR', 'des': 'DES', 'con': 'CON', 'int': 'INT', 'sab': 'SAB', 'car': 'CAR'};

const itemActionLabels = {
  'usar': 'Usar',
  'equipar': 'Equipar',
  'guardar': 'Guardar',
  'empunhar': 'Empunhar',
  'embainhar': 'Embainhar',
  'largar': 'Largar',
};
