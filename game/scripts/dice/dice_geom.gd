class_name DiceGeom
extends RefCounted
## Geometria dos dados: sólidos convexos (d4, d6, d8, d10, d12, d20) com faces planas ordenadas.
## Cada face: {verts: PackedInt32Array (anti-horário visto de fora), normal: Vector3, center: Vector3}.

const PHI := 1.618033988749895


static func points(sides: int) -> PackedVector3Array:
	var p := PackedVector3Array()
	match sides:
		4:
			p = PackedVector3Array([Vector3(1, 1, 1), Vector3(1, -1, -1), Vector3(-1, 1, -1), Vector3(-1, -1, 1)])
		6:
			for x in [-1, 1]:
				for y in [-1, 1]:
					for z in [-1, 1]:
						p.append(Vector3(x, y, z))
		8:
			p = PackedVector3Array([Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, -1, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)])
		10:
			var h := 1.0
			var c36 := cos(PI / 5.0)
			var z0 := (1.0 - c36) / (1.0 + c36) * h
			p.append(Vector3(0, h, 0))
			p.append(Vector3(0, -h, 0))
			for k in range(10):
				var a := k * TAU / 10.0
				var y := -z0 if k % 2 == 0 else z0
				p.append(Vector3(cos(a), y, sin(a)))
		12:
			for x in [-1, 1]:
				for y in [-1, 1]:
					for z in [-1, 1]:
						p.append(Vector3(x, y, z))
			var i := 1.0 / PHI
			for s1 in [-1, 1]:
				for s2 in [-1, 1]:
					p.append(Vector3(0, s1 * i, s2 * PHI))
					p.append(Vector3(s1 * i, s2 * PHI, 0))
					p.append(Vector3(s2 * PHI, 0, s1 * i))
		20:
			for s1 in [-1, 1]:
				for s2 in [-1, 1]:
					p.append(Vector3(0, s1, s2 * PHI))
					p.append(Vector3(s1, s2 * PHI, 0))
					p.append(Vector3(s2 * PHI, 0, s1))
	# Normaliza para raio 1 (tamanhos parecidos entre os dados).
	var r := 0.0
	for v in p:
		r = max(r, v.length())
	for i in range(p.size()):
		p[i] = p[i] / r
	return p


## Faces do casco convexo (agrupa vértices coplanares).
static func faces(pts: PackedVector3Array) -> Array:
	var out: Array = []
	var n := pts.size()
	var seen: Array = []
	for i in range(n):
		for j in range(i + 1, n):
			for k in range(j + 1, n):
				var nrm := (pts[j] - pts[i]).cross(pts[k] - pts[i])
				if nrm.length() < 1e-6:
					continue
				nrm = nrm.normalized()
				var d := nrm.dot(pts[i])
				var pos := 0
				var neg := 0
				var on: Array = []
				for m in range(n):
					var s := nrm.dot(pts[m]) - d
					if s > 1e-4:
						pos += 1
					elif s < -1e-4:
						neg += 1
					else:
						on.append(m)
				if pos > 0 and neg > 0:
					continue
				if pos > 0:
					nrm = -nrm
					d = -d
				var key := ",".join(on.map(func(x): return str(x)))
				if seen.has(key):
					continue
				seen.append(key)
				var c := Vector3.ZERO
				for m in on:
					c += pts[m]
				c /= on.size()
				# Ordena em torno da normal (anti-horário visto de fora).
				var ref := (pts[on[0]] - c).normalized()
				var tangent := nrm.cross(ref)
				on.sort_custom(func(a, b):
					var va: Vector3 = pts[a] - c
					var vb: Vector3 = pts[b] - c
					return atan2(va.dot(tangent), va.dot(ref)) < atan2(vb.dot(tangent), vb.dot(ref)))
				out.append({"verts": PackedInt32Array(on), "normal": nrm, "center": c})
	return out


static func expected_faces(sides: int) -> int:
	return sides


## Malha com normais planas (uma por face), triangulada em leque.
static func mesh(pts: PackedVector3Array, fs: Array) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for f in fs:
		var v: PackedInt32Array = f.verts
		for t in range(1, v.size() - 1):
			for idx in [v[0], v[t], v[t + 1]]:
				st.set_normal(f.normal)
				st.add_vertex(pts[idx])
	return st.commit()


## Qual face está mais para cima, dada a rotação do dado.
static func top_face(fs: Array, basis: Basis) -> int:
	var best := -1
	var bd := -2.0
	for i in range(fs.size()):
		var d: float = (basis * (fs[i].normal as Vector3)).dot(Vector3.UP)
		if d > bd:
			bd = d
			best = i
	return best


## Rótulos iniciais das faces para um dado de `sides` lados (d10: 0–9; d100/dezenas: 00–90).
static func labels(sides: int, tens := false) -> Array:
	var out: Array = []
	if sides == 10:
		for i in range(10):
			out.append("%02d" % (i * 10) if tens else str(i))
	else:
		for i in range(sides):
			out.append(str(i + 1))
	return out


## Reatribui os rótulos para que a face de cima mostre `want`. Devolve a nova lista.
static func relabel_top(labels_in: Array, top: int, want: String) -> Array:
	var out := labels_in.duplicate()
	var j := out.find(want)
	if j >= 0 and j != top:
		var tmp = out[top]
		out[top] = out[j]
		out[j] = tmp
	elif j < 0:
		out[top] = want
	return out
