extends Node
## Geometria dos dados: nº de faces, planaridade, normais para fora, regra "face de cima = valor do servidor".

var failures := 0


func check(cond: bool, msg: String) -> void:
	if not cond:
		failures += 1
		printerr("FALHA: ", msg)


func _ready() -> void:
	for sides in [4, 6, 8, 10, 12, 20]:
		var pts := DiceGeom.points(sides)
		var fs := DiceGeom.faces(pts)
		check(fs.size() == sides, "d%d deveria ter %d faces, tem %d" % [sides, sides, fs.size()])
		for f in fs:
			check((f.normal as Vector3).dot(f.center) > 0.0, "d%d: normal aponta para dentro" % sides)
			for v in f.verts:
				check(abs((f.normal as Vector3).dot(pts[v] - f.center)) < 1e-3, "d%d: face não planar" % sides)
		check(DiceGeom.mesh(pts, fs).get_surface_count() == 1, "d%d: malha" % sides)
	# Face de cima = valor do servidor, para qualquer rotação.
	var fs20 := DiceGeom.faces(DiceGeom.points(20))
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for _i in range(200):
		var b := Basis(Quaternion(Vector3(rng.randf() - .5, rng.randf() - .5, rng.randf() - .5).normalized(), rng.randf() * TAU))
		var top := DiceGeom.top_face(fs20, b)
		var want := str(rng.randi_range(1, 20))
		var labels := DiceGeom.relabel_top(DiceGeom.labels(20), top, want)
		check(labels[top] == want, "face de cima não mostra %s" % want)
		check(labels.size() == 20 and labels.duplicate().size() == 20, "rótulos")
		var uniq := {}
		for l in labels:
			uniq[l] = true
		check(uniq.size() == 20, "rótulos repetidos após troca")
	print("dados: falhas = ", failures)
	get_tree().quit(1 if failures > 0 else 0)
