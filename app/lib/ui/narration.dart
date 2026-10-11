import 'dart:async';

import 'package:flutter/material.dart';

import '../theme.dart';

/// Remove marcas de voz ({m}/{f}) usadas pelo TTS.
String cleanNarration(String text) => text.replaceAll(RegExp(r'\{[mf]\}\s?'), '');

/// Markdown leve (parágrafos, **negrito**, *itálico*) sem HTML.
List<InlineSpan> _inline(String text, TextStyle base) {
  final spans = <InlineSpan>[];
  final re = RegExp(r'\*\*(.+?)\*\*|\*(.+?)\*');
  var i = 0;
  for (final m in re.allMatches(text)) {
    if (m.start > i) spans.add(TextSpan(text: text.substring(i, m.start)));
    if (m.group(1) != null) {
      spans.add(TextSpan(text: m.group(1), style: base.copyWith(fontWeight: FontWeight.w700, color: Palette.inkEmph)));
    } else {
      spans.add(TextSpan(text: m.group(2), style: base.copyWith(fontStyle: FontStyle.italic)));
    }
    i = m.end;
  }
  if (i < text.length) spans.add(TextSpan(text: text.substring(i)));
  return spans;
}

/// Narração com efeito de máquina de escrever. Toque para mostrar tudo.
class Narration extends StatefulWidget {
  const Narration({super.key, required this.text, this.animate = true});
  final String text;
  final bool animate;

  @override
  State<Narration> createState() => _NarrationState();
}

class _NarrationState extends State<Narration> {
  int _shown = 0;
  Timer? _timer;

  String get _clean => cleanNarration(widget.text);

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void didUpdateWidget(Narration old) {
    super.didUpdateWidget(old);
    if (old.text != widget.text) _start();
  }

  void _start() {
    _timer?.cancel();
    final total = _clean.length;
    if (!widget.animate || total == 0) {
      _shown = total;
      return;
    }
    _shown = 0;
    // ~45 caracteres/s, sem passar de ~12 s em textos longos.
    final step = (total / (12 * 30)).ceil().clamp(1, 20);
    _timer = Timer.periodic(const Duration(milliseconds: 33), (t) {
      if (!mounted) return t.cancel();
      setState(() => _shown = (_shown + step).clamp(0, total));
      if (_shown >= total) t.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final style = narrationStyle(context);
    final visible = _clean.substring(0, _shown.clamp(0, _clean.length));
    final paragraphs = visible.split(RegExp(r'\n\s*\n'));
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => setState(() {
        _timer?.cancel();
        _shown = _clean.length;
      }),
      child: Semantics(
        label: _clean,
        child: ExcludeSemantics(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final p in paragraphs)
                Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Text.rich(TextSpan(style: style, children: _inline(p.trim(), style))),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
