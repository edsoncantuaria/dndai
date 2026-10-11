import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'math3d.dart';
import 'physics.dart';

/// Desenha a mesa e os dados 3D de um quadro da gravação (projeção em perspectiva, faces iluminadas,
/// números no plano de cada face, sombras). Sem dependências: o mesmo no celular e na web.
class DicePainter extends CustomPainter {
  DicePainter({
    required this.recording,
    required this.frame,
    required this.colors,
    this.dimmed = const {},
    this.glow = const {},
    this.tray = const Tray(),
  });

  final Recording recording;
  final int frame;
  final List<Color> colors;
  final Set<int> dimmed;
  final Set<int> glow;
  final Tray tray;

  static const _eye = V3(0, 10.5, 7.6);
  static const _target = V3(0, 0, 0.35);
  static final _light = const V3(-0.45, 1, 0.55).normalized;

  late V3 _fwd, _right, _upc;
  late double _focal, _cx, _cy;

  void _camera(Size size) {
    _fwd = (_target - _eye).normalized;
    _right = _fwd.cross(V3.up).normalized;
    _upc = _right.cross(_fwd);
    _cx = size.width / 2;
    _cy = size.height * 0.52;
    // A mesa ocupa a largura (ou a altura) disponível.
    final depth = (_target - _eye).length;
    final byWidth = size.width * 0.47 * depth / tray.halfX;
    final byHeight = size.height * 0.46 * depth / (tray.halfZ * 1.35);
    _focal = min(byWidth, byHeight);
  }

  /// Projeta um ponto do mundo; retorna (posição na tela, profundidade).
  (Offset, double) _project(V3 p) {
    final d = p - _eye;
    final z = d.dot(_fwd);
    return (Offset(_cx + _focal * d.dot(_right) / z, _cy - _focal * d.dot(_upc) / z), z);
  }

  @override
  void paint(Canvas canvas, Size size) {
    _camera(size);
    _paintTray(canvas);
    final poses = recording.frames[frame.clamp(0, recording.frames.length - 1)];
    final order = List.generate(poses.length, (i) => i)..sort((a, b) => _project(poses[b].pos).$2.compareTo(_project(poses[a].pos).$2));
    for (final i in order) {
      _paintShadow(canvas, poses[i], recording.dice[i].size);
    }
    for (final i in order) {
      _paintDie(canvas, recording.dice[i], poses[i], colors[i % colors.length], dimmed.contains(i), glow.contains(i));
    }
  }

  void _paintTray(Canvas canvas) {
    final corners = [
      V3(-tray.halfX, 0, -tray.halfZ),
      V3(tray.halfX, 0, -tray.halfZ),
      V3(tray.halfX, 0, tray.halfZ),
      V3(-tray.halfX, 0, tray.halfZ),
    ].map((c) => _project(c).$1).toList();
    final path = Path()..addPolygon(corners, true);
    final bounds = path.getBounds();
    canvas.drawPath(
      path,
      Paint()
        ..shader = ui.Gradient.radial(bounds.center, bounds.longestSide * 0.6, const [Color(0xFF3B1E1A), Color(0xFF1B0F0D)]),
    );
    // Borda de madeira com filete dourado.
    canvas.drawPath(path, Paint()..style = PaintingStyle.stroke..strokeWidth = 10..color = const Color(0xFF2A1A10));
    canvas.drawPath(path, Paint()..style = PaintingStyle.stroke..strokeWidth = 1.5..color = const Color(0xFF8C7246));
  }

  void _paintShadow(Canvas canvas, Pose pose, double size) {
    final (c, _) = _project(V3(pose.pos.x, 0, pose.pos.z));
    final h = pose.pos.y;
    final (edge, _) = _project(V3(pose.pos.x + size, 0, pose.pos.z));
    final r = (edge - c).distance * (1 + h * 0.15);
    canvas.drawOval(
      Rect.fromCenter(center: c, width: r * 2.1, height: r * 1.3),
      Paint()
        ..color = Colors.black.withValues(alpha: (0.5 - h * 0.08).clamp(0.08, 0.5))
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, 4 + h * 3),
    );
  }

  void _paintDie(Canvas canvas, DieSpec spec, Pose pose, Color base, bool dim, bool glow) {
    final solid = spec.solid;
    final world = [for (final v in solid.verts) pose.pos + pose.rot.rotate(v * spec.size)];
    final screen = [for (final w in world) _project(w).$1];
    final faces = <(int, double)>[];
    for (var f = 0; f < solid.faces.length; f++) {
      final n = pose.rot.rotate(solid.normals[f]);
      final c = pose.pos + pose.rot.rotate(solid.centers[f] * spec.size);
      if (n.dot(_eye - c) <= 0) continue; // face de costas
      faces.add((f, _project(c).$2));
    }
    faces.sort((a, b) => b.$2.compareTo(a.$2));
    final alpha = dim ? 0.38 : 1.0;
    if (glow) {
      final (c, _) = _project(pose.pos);
      canvas.drawCircle(c, _focal * spec.size / _project(pose.pos).$2 * 1.6,
          Paint()..color = const Color(0xFFD8B26A).withValues(alpha: 0.35)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18));
    }
    for (final (f, _) in faces) {
      final idx = solid.faces[f];
      final path = Path()..addPolygon([for (final i in idx) screen[i]], true);
      final n = pose.rot.rotate(solid.normals[f]);
      final lambert = max(0.0, n.dot(_light));
      final view = (_eye - pose.pos).normalized;
      final spec2 = pow(max(0.0, (_light + view).normalized.dot(n)), 24).toDouble();
      final shade = Color.lerp(Color.lerp(base, Colors.black, 0.62)!, base, 0.25 + 0.75 * lambert)!;
      final lit = Color.lerp(shade, Colors.white, spec2 * 0.55)!;
      canvas.drawPath(path, Paint()..color = lit.withValues(alpha: alpha));
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..strokeJoin = StrokeJoin.round
          ..color = Color.lerp(base, Colors.black, 0.55)!.withValues(alpha: alpha),
      );
      _paintLabels(canvas, spec, pose, f, alpha);
    }
  }

  void _paintLabels(Canvas canvas, DieSpec spec, Pose pose, int f, double alpha) {
    final solid = spec.solid;
    final n = pose.rot.rotate(solid.normals[f]);
    final center = pose.pos + pose.rot.rotate(solid.centers[f] * spec.size);
    final idx = solid.faces[f];
    // Raio interno aproximado da face (distância do centro ao meio da aresta mais próxima).
    var inner = double.infinity;
    for (var k = 0; k < idx.length; k++) {
      final a = pose.pos + pose.rot.rotate(solid.verts[idx[k]] * spec.size);
      final b = pose.pos + pose.rot.rotate(solid.verts[idx[(k + 1) % idx.length]] * spec.size);
      inner = min(inner, ((a + b) * 0.5 - center).length);
    }
    if (solid.vertexLabels) {
      // d4: o número de cada vértice perto do canto correspondente, "em pé" apontando para o vértice.
      for (final vi in idx) {
        final vw = pose.pos + pose.rot.rotate(solid.verts[vi] * spec.size);
        final toward = (vw - center).normalized;
        _text(canvas, spec.labels[vi], center + toward * (inner * 1.05), toward, n, inner * 0.55, alpha);
      }
      return;
    }
    // "Para cima" do texto: direção do centro ao primeiro vértice da face.
    final first = pose.pos + pose.rot.rotate(solid.verts[idx.first] * spec.size);
    final up = (first - center).normalized;
    final scale = switch (solid.faces.length) { 6 => 1.0, 20 => 0.95, 12 => 0.9, _ => 0.85 } * inner;
    _text(canvas, spec.labels[f], center, up, n, scale, alpha);
  }

  /// Desenha `text` no plano definido por `up` e pela normal `n`, centrado em `at`, com altura `height` (mundo).
  void _text(Canvas canvas, String text, V3 at, V3 up, V3 n, double height, double alpha) {
    final right = up.cross(n).normalized;
    final (o, _) = _project(at);
    final (px, _) = _project(at + right * height);
    final (py, _) = _project(at - up * height);
    const font = 64.0;
    final ex = (px - o) / font, ey = (py - o) / font;
    final tp = TextPainter(
      text: TextSpan(text: text, style: TextStyle(fontSize: font, fontWeight: FontWeight.w800, color: Colors.white.withValues(alpha: 0.95 * alpha), fontFamily: 'serif')),
      textDirection: TextDirection.ltr,
    )..layout();
    canvas.save();
    canvas.transform(Float64List.fromList([ex.dx, ex.dy, 0, 0, ey.dx, ey.dy, 0, 0, 0, 0, 1, 0, o.dx, o.dy, 0, 1]));
    tp.paint(canvas, Offset(-tp.width / 2, -tp.height / 2));
    canvas.restore();
  }

  @override
  bool shouldRepaint(DicePainter old) => old.frame != frame || old.recording != recording || old.dimmed != dimmed || old.glow != glow;
}
