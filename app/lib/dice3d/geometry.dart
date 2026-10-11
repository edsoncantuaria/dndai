import 'dart:math';

import 'math3d.dart';

/// Poliedro de um dado: vértices (raio máximo 1), faces ordenadas no sentido anti-horário visto de fora.
class Solid {
  Solid(this.sides, this.verts, this.faces)
      : normals = [for (final f in faces) _faceNormal(verts, f)],
        centers = [for (final f in faces) _centroid(verts, f)];

  final int sides;
  final List<V3> verts;
  final List<List<int>> faces;
  final List<V3> normals;
  final List<V3> centers;

  /// No d4 o resultado é o número do vértice de cima (números nos cantos das faces).
  bool get vertexLabels => sides == 4;

  static V3 _centroid(List<V3> v, List<int> f) {
    var c = V3.zero;
    for (final i in f) {
      c = c + v[i];
    }
    return c * (1 / f.length);
  }

  static V3 _faceNormal(List<V3> v, List<int> f) => (v[f[1]] - v[f[0]]).cross(v[f[2]] - v[f[0]]).normalized;
}

final Map<int, Solid> _cache = {};

/// Sólido para o número de lados (d100 usa a forma do d10).
Solid solidFor(int sides) => _cache.putIfAbsent(sides, () => _build(sides == 100 ? 10 : sides, sides));

Solid _build(int shape, int sides) {
  const phi = 1.618033988749895;
  final List<V3> pts;
  switch (shape) {
    case 4:
      pts = const [V3(1, 1, 1), V3(1, -1, -1), V3(-1, 1, -1), V3(-1, -1, 1)];
    case 6:
      pts = [for (final x in [-1.0, 1.0]) for (final y in [-1.0, 1.0]) for (final z in [-1.0, 1.0]) V3(x, y, z)];
    case 8:
      pts = const [V3(1, 0, 0), V3(-1, 0, 0), V3(0, 1, 0), V3(0, -1, 0), V3(0, 0, 1), V3(0, 0, -1)];
    case 10:
      // Trapezoedro pentagonal: a altura do anel garante pipas planas (h = a·(1+cos36°)/(1−cos36°)).
      final c = cos(pi / 5);
      final a = (1 - c) / (1 + c);
      pts = [
        const V3(0, 1, 0),
        const V3(0, -1, 0),
        for (var k = 0; k < 10; k++) V3(cos(k * pi / 5), k.isEven ? a : -a, sin(k * pi / 5)),
      ];
    case 12:
      final p = 1 / phi;
      pts = [
        for (final x in [-1.0, 1.0]) for (final y in [-1.0, 1.0]) for (final z in [-1.0, 1.0]) V3(x, y, z),
        for (final a in [-p, p]) for (final b in [-phi, phi]) ...[V3(0, a, b), V3(a, b, 0), V3(b, 0, a)],
      ];
    case 20:
    default:
      pts = [
        for (final a in [-1.0, 1.0]) for (final b in [-phi, phi]) ...[V3(0, a, b), V3(a, b, 0), V3(b, 0, a)],
      ];
  }
  // Achata o d10 (forma realista); afim, mantém as faces planas.
  final shaped = shape == 10 ? [for (final p in pts) V3(p.x, p.y * 0.8, p.z)] : pts;
  final r = shaped.map((p) => p.length).reduce(max);
  final verts = [for (final p in shaped) p * (1 / r)];
  final faces = _hull(verts);
  final expected = {4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 20: 20}[shape];
  assert(faces.length == expected, 'd$shape: ${faces.length} faces');
  return Solid(sides, verts, faces);
}

/// Casco convexo por força bruta (poucos vértices): agrupa pontos coplanares em faces.
List<List<int>> _hull(List<V3> v) {
  const eps = 1e-6;
  final faces = <List<int>>[];
  final seen = <String>{};
  for (var i = 0; i < v.length; i++) {
    for (var j = i + 1; j < v.length; j++) {
      for (var k = j + 1; k < v.length; k++) {
        var n = (v[j] - v[i]).cross(v[k] - v[i]);
        if (n.length < eps) continue;
        n = n.normalized;
        var d = n.dot(v[i]);
        var above = 0, below = 0;
        for (final p in v) {
          final s = n.dot(p) - d;
          if (s > eps) above++;
          if (s < -eps) below++;
        }
        if (above > 0 && below > 0) continue;
        if (above > 0) {
          n = -n;
          d = -d;
        }
        // Inteiros: evita que -0.0 e 0.0 virem chaves diferentes.
        final key = '${(n.x * 1e4).round()},${(n.y * 1e4).round()},${(n.z * 1e4).round()}';
        if (!seen.add(key)) continue;
        final idx = [for (var m = 0; m < v.length; m++) if ((n.dot(v[m]) - d).abs() < 1e-5) m];
        // Ordena em volta do centro, anti-horário visto de fora (pela normal).
        var c = V3.zero;
        for (final m in idx) {
          c = c + v[m];
        }
        c = c * (1 / idx.length);
        final u = (v[idx.first] - c).normalized;
        final w = n.cross(u);
        idx.sort((a, b) => atan2((v[a] - c).dot(w), (v[a] - c).dot(u)).compareTo(atan2((v[b] - c).dot(w), (v[b] - c).dot(u))));
        faces.add(idx);
      }
    }
  }
  return faces;
}
