import 'dart:math';

import 'package:dndai/dice3d/geometry.dart';
import 'package:dndai/dice3d/math3d.dart';
import 'package:dndai/dice3d/physics.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('sólidos têm o número certo de faces, todas planas e voltadas para fora', () {
    for (final (sides, faces) in [(4, 4), (6, 6), (8, 8), (10, 10), (12, 12), (20, 20), (100, 10)]) {
      final s = solidFor(sides);
      expect(s.faces.length, faces, reason: 'd$sides');
      for (var f = 0; f < s.faces.length; f++) {
        expect(s.normals[f].dot(s.centers[f]), greaterThan(0), reason: 'd$sides face $f para fora');
        final d = s.normals[f].dot(s.verts[s.faces[f].first]);
        for (final v in s.faces[f]) {
          expect((s.normals[f].dot(s.verts[v]) - d).abs(), lessThan(1e-6), reason: 'd$sides face $f plana');
        }
      }
    }
  });

  test('a face que cai para cima mostra exatamente o valor sorteado', () {
    final rng = Random(42);
    for (final sides in [4, 6, 8, 10, 12, 20, 100]) {
      for (var n = 0; n < 60; n++) {
        final value = rng.nextInt(sides) + 1;
        final rec = simulate([sides], values: [value], rng: rng);
        final spec = rec.dice.first;
        final pose = rec.frames.last.first;
        final solid = spec.solid;
        String shown;
        if (solid.vertexLabels) {
          var best = 0;
          for (var i = 1; i < solid.verts.length; i++) {
            if (pose.rot.rotate(solid.verts[i]).y > pose.rot.rotate(solid.verts[best]).y) best = i;
          }
          shown = spec.labels[best];
        } else {
          var best = 0;
          for (var i = 1; i < solid.normals.length; i++) {
            if (pose.rot.rotate(solid.normals[i]).y > pose.rot.rotate(solid.normals[best]).y) best = i;
          }
          // Assentado de verdade: a face de cima fica alinhada com o "para cima".
          expect(pose.rot.rotate(solid.normals[best]).y, greaterThan(0.999), reason: 'd$sides assentado');
          shown = spec.labels[best];
        }
        expect(shown, labelFor(sides, value), reason: 'd$sides valor $value');
        // Rótulos continuam únicos (exceto o d100, que mostra o valor no topo).
        if (sides != 100) expect(spec.labels.toSet().length, spec.labels.length, reason: 'd$sides rótulos únicos');
      }
    }
  });

  test('dados ficam dentro da mesa e apoiados no chão', () {
    final rng = Random(7);
    const tray = Tray();
    for (var n = 0; n < 40; n++) {
      final rec = simulate([20, 20, 8, 6], values: [1, 20, 5, 6], rng: rng, strength: 1);
      for (var i = 0; i < rec.dice.length; i++) {
        final pose = rec.frames.last[i];
        final size = rec.dice[i].size;
        expect(pose.pos.x.abs(), lessThan(tray.halfX + 0.01));
        expect(pose.pos.z.abs(), lessThan(tray.halfZ + 0.01));
        final lowest = rec.dice[i].solid.verts.map((v) => pose.rot.rotate(v * size).y + pose.pos.y).reduce(min);
        expect(lowest.abs(), lessThan(1e-6), reason: 'apoiado no chão');
      }
      expect(rec.frames.length, lessThan(5 * 60 + 20), reason: 'termina em até ~5 s');
    }
  });

  test('quaternion: fromTo leva um vetor ao outro', () {
    const a = V3(0.3, -0.8, 0.5);
    final q = Quat.fromTo(a, V3.up);
    final r = q.rotate(a.normalized);
    expect(r.y, closeTo(1, 1e-9));
  });
}
