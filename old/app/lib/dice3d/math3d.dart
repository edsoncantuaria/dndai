import 'dart:math';

/// Vetor 3D imutável (y para cima).
class V3 {
  const V3(this.x, this.y, this.z);
  final double x, y, z;
  static const zero = V3(0, 0, 0);
  static const up = V3(0, 1, 0);

  V3 operator +(V3 o) => V3(x + o.x, y + o.y, z + o.z);
  V3 operator -(V3 o) => V3(x - o.x, y - o.y, z - o.z);
  V3 operator *(double s) => V3(x * s, y * s, z * s);
  V3 operator -() => V3(-x, -y, -z);
  double dot(V3 o) => x * o.x + y * o.y + z * o.z;
  V3 cross(V3 o) => V3(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x);
  double get length => sqrt(x * x + y * y + z * z);
  V3 get normalized {
    final l = length;
    return l < 1e-12 ? this : this * (1 / l);
  }
}

/// Quaternion unitário para orientação.
class Quat {
  const Quat(this.w, this.x, this.y, this.z);
  final double w, x, y, z;
  static const identity = Quat(1, 0, 0, 0);

  factory Quat.axisAngle(V3 axis, double angle) {
    final a = axis.normalized;
    final s = sin(angle / 2);
    return Quat(cos(angle / 2), a.x * s, a.y * s, a.z * s);
  }

  /// Menor rotação que leva a direção `a` até `b`.
  factory Quat.fromTo(V3 a, V3 b) {
    final u = a.normalized, v = b.normalized;
    final d = u.dot(v);
    if (d < -0.999999) {
      var axis = const V3(1, 0, 0).cross(u);
      if (axis.length < 1e-6) axis = const V3(0, 0, 1).cross(u);
      return Quat.axisAngle(axis, pi);
    }
    final c = u.cross(v);
    return Quat(1 + d, c.x, c.y, c.z).normalized;
  }

  Quat operator *(Quat o) => Quat(
        w * o.w - x * o.x - y * o.y - z * o.z,
        w * o.x + x * o.w + y * o.z - z * o.y,
        w * o.y - x * o.z + y * o.w + z * o.x,
        w * o.z + x * o.y - y * o.x + z * o.w,
      );

  Quat get normalized {
    final l = sqrt(w * w + x * x + y * y + z * z);
    return Quat(w / l, x / l, y / l, z / l);
  }

  V3 rotate(V3 v) {
    final q = V3(x, y, z);
    final t = q.cross(v) * 2;
    return v + t * w + q.cross(t);
  }

  /// Integra a velocidade angular `omega` (rad/s, espaço do mundo) por `dt`.
  Quat integrate(V3 omega, double dt) {
    final dq = Quat(0, omega.x, omega.y, omega.z) * this;
    return Quat(w + 0.5 * dt * dq.w, x + 0.5 * dt * dq.x, y + 0.5 * dt * dq.y, z + 0.5 * dt * dq.z).normalized;
  }

  /// Interpolação normalizada (suficiente para os ajustes finais curtos).
  Quat nlerp(Quat b, double t) {
    final sign = (w * b.w + x * b.x + y * b.y + z * b.z) < 0 ? -1.0 : 1.0;
    return Quat(
      w + (b.w * sign - w) * t,
      x + (b.x * sign - x) * t,
      y + (b.y * sign - y) * t,
      z + (b.z * sign - z) * t,
    ).normalized;
  }
}
