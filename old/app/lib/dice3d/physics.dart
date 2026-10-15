import 'dart:math';

import 'geometry.dart';
import 'math3d.dart';

/// Pose de um dado num quadro.
class Pose {
  const Pose(this.pos, this.rot);
  final V3 pos;
  final Quat rot;
}

/// Um dado da rolagem: forma, tamanho, rótulos (por face, ou por vértice no d4) e o índice que ficou para cima.
class DieSpec {
  DieSpec(this.solid, this.size, this.labels);
  final Solid solid;
  final double size;
  final List<String> labels;
  int resultIndex = -1;
}

/// Rolagem gravada a 60 quadros/s, pronta para tocar.
class Recording {
  Recording(this.dice, this.frames, this.impacts);
  final List<DieSpec> dice;
  final List<List<Pose>> frames;
  /// Quadros com batida forte (para vibração/som).
  final Set<int> impacts;
}

/// Mesa: chão em y=0, bordas em ±halfX e ±halfZ.
class Tray {
  const Tray({this.halfX = 3.4, this.halfZ = 2.4});
  final double halfX, halfZ;
}

class _Body {
  _Body(this.spec, this.pos, this.vel, this.omega, this.rot);
  final DieSpec spec;
  V3 pos, vel, omega;
  Quat rot;
}

const _gravity = 32.0;
const _dt = 1 / 240;
const _restitution = 0.38;
const _friction = 0.55;

double sizeFor(int sides) => switch (sides) { 4 => 0.62, 6 => 0.56, 20 => 0.72, _ => 0.64 };

List<String> defaultLabels(int sides) {
  if (sides == 100) return [for (var i = 0; i < 10; i++) '${i * 10}'.padLeft(2, '0')];
  if (sides == 10) return [for (var i = 0; i < 10; i++) '$i'];
  return [for (var i = 1; i <= sides; i++) (sides >= 8 && (i == 6 || i == 9)) ? '$i.' : '$i'];
}

String labelFor(int sides, int value) {
  if (sides == 100) return '$value';
  if (sides == 10) return '${value % 10}';
  return (sides >= 8 && (value == 6 || value == 9)) ? '$value.' : '$value';
}

/// Simula o arremesso. Se `values` vier, renumera as faces para que a face que cair para cima mostre cada valor.
/// [throwDir] (x,z) e [strength] (0..1) vêm do gesto do jogador.
Recording simulate(List<int> sides, {List<int>? values, required Random rng, Tray tray = const Tray(), V3? throwDir, double strength = 0.7}) {
  final specs = [
    for (final s in sides) DieSpec(solidFor(s), sizeFor(s), [...(solidFor(s).vertexLabels ? const ['1', '2', '3', '4'] : defaultLabels(s))]),
  ];
  final dir = (throwDir ?? V3(rng.nextDouble() * 2 - 1, 0, -(0.6 + rng.nextDouble() * 0.4))).normalized;
  final speed = 7 + 9 * strength.clamp(0.0, 1.0);
  final bodies = <_Body>[];
  for (var i = 0; i < specs.length; i++) {
    // Entram pelo lado oposto à direção do arremesso, espaçados.
    final lateral = V3(-dir.z, 0, dir.x) * ((i - (specs.length - 1) / 2) * 1.1);
    final start = V3(-dir.x * tray.halfX * 0.75, 2.2 + rng.nextDouble(), -dir.z * tray.halfZ * 0.75) + lateral;
    final jitter = V3(rng.nextDouble() - 0.5, 0, rng.nextDouble() - 0.5) * 2;
    final axis = V3(rng.nextDouble() - 0.5, rng.nextDouble() - 0.5, rng.nextDouble() - 0.5);
    bodies.add(_Body(
      specs[i],
      start,
      dir * speed + jitter + const V3(0, 2, 0),
      axis.normalized * (12 + rng.nextDouble() * 14),
      Quat.axisAngle(axis.length < 1e-6 ? V3.up : axis, rng.nextDouble() * pi * 2),
    ));
  }

  final frames = <List<Pose>>[];
  final impacts = <int>{};
  var still = 0.0;
  var t = 0.0;
  var step = 0;
  while (true) {
    var hardHit = false;
    for (final b in bodies) {
      b.vel = b.vel + const V3(0, -_gravity, 0) * _dt;
      b.pos = b.pos + b.vel * _dt;
      b.rot = b.rot.integrate(b.omega, _dt);
      if (_collide(b, tray)) hardHit = true;
    }
    _separate(bodies);
    t += _dt;
    step++;
    if (step % 4 == 0) {
      frames.add([for (final b in bodies) Pose(b.pos, b.rot)]);
      if (hardHit) impacts.add(frames.length - 1);
    }
    final resting = bodies.every((b) => b.vel.length < 0.08 && b.omega.length < 0.25 && b.pos.y < b.spec.size * 1.2);
    still = resting ? still + _dt : 0;
    if ((t > 0.5 && still > 0.3) || t > 5) break;
  }

  // Assenta cada dado numa face (evita parar "em pé" numa aresta) e lê o resultado.
  final settled = <Pose>[];
  for (final b in bodies) {
    final solid = b.spec.solid;
    Quat target;
    if (solid.vertexLabels) {
      final down = _argmax(solid.normals.length, (i) => -b.rot.rotate(solid.normals[i]).y);
      target = Quat.fromTo(b.rot.rotate(solid.normals[down]), const V3(0, -1, 0)) * b.rot;
      b.spec.resultIndex = _argmax(solid.verts.length, (i) => target.rotate(solid.verts[i]).y);
    } else {
      final top = _argmax(solid.normals.length, (i) => b.rot.rotate(solid.normals[i]).y);
      target = Quat.fromTo(b.rot.rotate(solid.normals[top]), V3.up) * b.rot;
      b.spec.resultIndex = top;
    }
    final lowest = solid.verts.map((v) => target.rotate(v * b.spec.size).y).reduce(min);
    settled.add(Pose(V3(b.pos.x, -lowest, b.pos.z), target));
  }
  final last = frames.isEmpty ? [for (final b in bodies) Pose(b.pos, b.rot)] : frames.last;
  for (var f = 1; f <= 12; f++) {
    final k = _easeOut(f / 12);
    frames.add([
      for (var i = 0; i < bodies.length; i++)
        Pose(last[i].pos + (settled[i].pos - last[i].pos) * k, last[i].rot.nlerp(settled[i].rot, k)),
    ]);
  }

  // Renumera: o rótulo do valor sorteado vai para a face (ou vértice) que ficou para cima.
  if (values != null) {
    for (var i = 0; i < specs.length && i < values.length; i++) {
      final spec = specs[i];
      final want = spec.solid.vertexLabels ? '${values[i]}' : labelFor(sides[i], values[i]);
      final labels = spec.labels;
      final at = labels.indexOf(want);
      if (at >= 0) {
        labels[at] = labels[spec.resultIndex];
      }
      labels[spec.resultIndex] = want;
    }
  }
  return Recording(specs, frames, impacts);
}

int _argmax(int n, double Function(int) f) {
  var best = 0;
  var bestV = double.negativeInfinity;
  for (var i = 0; i < n; i++) {
    final v = f(i);
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  }
  return best;
}

/// Contato por vértice contra o chão e as bordas (impulso com quique e atrito). Retorna true em batida forte.
bool _collide(_Body b, Tray tray) {
  final planes = [
    (const V3(0, 1, 0), 0.0),
    (const V3(1, 0, 0), -tray.halfX),
    (const V3(-1, 0, 0), -tray.halfX),
    (const V3(0, 0, 1), -tray.halfZ),
    (const V3(0, 0, -1), -tray.halfZ),
  ];
  final invMass = 1.0;
  final invI = 1 / (0.4 * b.spec.size * b.spec.size);
  var hard = false;
  for (final (n, d) in planes) {
    var deepest = 0.0;
    for (final v in b.spec.solid.verts) {
      final r = b.rot.rotate(v * b.spec.size);
      final p = b.pos + r;
      final pen = d - n.dot(p);
      if (pen <= 0) continue;
      deepest = max(deepest, pen);
      final vel = b.vel + b.omega.cross(r);
      final vn = vel.dot(n);
      if (vn >= 0) continue;
      if (vn < -3) hard = true;
      final e = vn < -1.2 ? _restitution : 0.0;
      final rn = r.cross(n);
      final j = -(1 + e) * vn / (invMass + invI * rn.dot(rn));
      b.vel = b.vel + n * (j * invMass);
      b.omega = b.omega + r.cross(n * j) * invI;
      // Atrito de Coulomb no ponto de contato.
      final v2 = b.vel + b.omega.cross(r);
      final vt = v2 - n * v2.dot(n);
      final vtLen = vt.length;
      if (vtLen > 1e-5) {
        final tdir = vt * (1 / vtLen);
        final rt = r.cross(tdir);
        final jt = min(vtLen / (invMass + invI * rt.dot(rt)), _friction * j);
        b.vel = b.vel - tdir * (jt * invMass);
        b.omega = b.omega - r.cross(tdir * jt) * invI;
      }
    }
    if (deepest > 0) b.pos = b.pos + n * deepest;
  }
  if (b.pos.y < b.spec.size * 1.1) {
    // Rolamento: perda leve de energia em contato com o feltro.
    b.omega = b.omega * 0.995;
    b.vel = V3(b.vel.x * 0.998, b.vel.y, b.vel.z * 0.998);
  }
  return hard;
}

/// Dados não se atravessam (aproximação por esferas).
void _separate(List<_Body> bodies) {
  for (var i = 0; i < bodies.length; i++) {
    for (var j = i + 1; j < bodies.length; j++) {
      final a = bodies[i], b = bodies[j];
      final delta = b.pos - a.pos;
      final dist = delta.length;
      final minDist = (a.spec.size + b.spec.size) * 0.85;
      if (dist >= minDist || dist < 1e-6) continue;
      final n = delta * (1 / dist);
      final push = (minDist - dist) / 2;
      a.pos = a.pos - n * push;
      b.pos = b.pos + n * push;
      final rel = (b.vel - a.vel).dot(n);
      if (rel < 0) {
        final j = -(1 + 0.3) * rel / 2;
        a.vel = a.vel - n * j;
        b.vel = b.vel + n * j;
      }
    }
  }
}

/// Suavização usada no assentamento final.
double _easeOut(double t) => 1 - pow(1 - t, 3).toDouble();
