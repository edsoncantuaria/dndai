extends Control
## Bandeja de dados 3D. Física real (RigidBody3D); o valor vem do servidor: quando o dado para,
## os números das faces são trocados para a face de cima mostrar exatamente esse valor.

const FLOOR_Y := 0.0
const DIE_SCALE := 0.75

var _rolls: Array = []
var _viewport: SubViewport
var _world: Node3D
var _banner: PanelContainer
var _banner_title: Label
var _banner_total: Label
var _banner_sub: Label
var _dice: Array = []  # [{body, faces, labels, label_nodes, want, kept}]
var _skip := false
var _done := false


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	UI.fill(dim)
	dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(dim)
	var svc := SubViewportContainer.new()
	svc.stretch = true
	UI.fill(svc)
	svc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(svc)
	_viewport = SubViewport.new()
	_viewport.own_world_3d = true
	_viewport.transparent_bg = true
	_viewport.msaa_3d = Viewport.MSAA_4X
	_viewport.size = Vector2i(get_viewport_rect().size)
	svc.add_child(_viewport)
	_build_world()

	_banner = UI.panel(14, Color(0.08, 0.06, 0.04, 0.92))
	_banner.anchor_left = 0.5
	_banner.anchor_right = 0.5
	_banner.anchor_top = 1.0
	_banner.anchor_bottom = 1.0
	_banner.offset_left = -220
	_banner.offset_right = 220
	_banner.offset_top = -230
	_banner.offset_bottom = -50
	_banner.visible = false
	var bv := UI.vbox(2)
	_banner.add_child(bv)
	_banner_title = UI.label("", 20, UI.MUTED)
	_banner_title.autowrap_mode = TextServer.AUTOWRAP_OFF
	_banner_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner_total = UI.label("", 56, UI.GOLD, UI.title_font())
	_banner_total.autowrap_mode = TextServer.AUTOWRAP_OFF
	_banner_total.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner_sub = UI.label("", 22, UI.TEXT)
	_banner_sub.autowrap_mode = TextServer.AUTOWRAP_OFF
	_banner_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bv.add_child(_banner_title)
	bv.add_child(_banner_total)
	bv.add_child(_banner_sub)
	add_child(_banner)


func _gui_input(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and ev.pressed:
		_skip = true


func _build_world() -> void:
	_world = Node3D.new()
	_viewport.add_child(_world)
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.85, 0.8, 0.7)
	env.ambient_light_energy = 0.55
	var we := WorldEnvironment.new()
	we.environment = env
	_world.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-60, 25, 0)
	sun.light_energy = 1.3
	sun.shadow_enabled = true
	_world.add_child(sun)
	var cam := Camera3D.new()
	cam.position = Vector3(0, 6.6, 3.8)
	cam.fov = 45
	_world.add_child(cam)
	cam.look_at(Vector3(0, 0, 0.3), Vector3.UP)
	# Chão e paredes invisíveis
	var floor_body := StaticBody3D.new()
	var fshape := CollisionShape3D.new()
	var plane := WorldBoundaryShape3D.new()
	fshape.shape = plane
	floor_body.add_child(fshape)
	floor_body.physics_material_override = _mat(0.35, 0.8)
	_world.add_child(floor_body)
	for w in [[Vector3(4.2, 0, 0), Vector3(-1, 0, 0)], [Vector3(-4.2, 0, 0), Vector3(1, 0, 0)], [Vector3(0, 0, 3.0), Vector3(0, 0, -1)], [Vector3(0, 0, -3.4), Vector3(0, 0, 1)]]:
		var wall := StaticBody3D.new()
		var ws := CollisionShape3D.new()
		var wp := WorldBoundaryShape3D.new()
		wp.plane = Plane(w[1], 0.0)
		ws.shape = wp
		wall.add_child(ws)
		wall.position = w[0]
		wall.physics_material_override = _mat(0.4, 0.5)
		_world.add_child(wall)
	# Só a sombra dos dados no fundo (sem desenhar o chão).
	var shadow := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(12.0, 9.0)
	shadow.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color.BLACK
	fm.shadow_to_opacity = true
	shadow.material_override = fm
	shadow.position = Vector3(0, 0.0, 0.2)
	_world.add_child(shadow)


func _mat(bounce: float, friction: float) -> PhysicsMaterial:
	var m := PhysicsMaterial.new()
	m.bounce = bounce
	m.friction = friction
	return m


## Toca as rolagens em sequência.
func play(rolls: Array) -> void:
	_rolls = rolls
	for r in _rolls:
		await _play_one(r)
		if not is_inside_tree():
			return
	queue_free()


func _play_one(roll: Dictionary) -> void:
	_skip = false
	_banner.visible = false
	for d in _dice:
		d.body.queue_free()
	_dice.clear()
	var faces: Array = roll.get("faces", [])
	var specs: Array = []
	for f in faces:
		var sides := int(f.sides)
		var value := int(f.value)
		if sides == 100:
			specs.append({"sides": 10, "tens": true, "want": "%02d" % ((value % 100) / 10 * 10), "kept": f.kept})
			specs.append({"sides": 10, "tens": false, "want": str(value % 10), "kept": f.kept})
		elif sides == 10:
			specs.append({"sides": 10, "tens": false, "want": str(value % 10), "kept": f.kept})
		elif sides in [4, 6, 8, 12, 20]:
			specs.append({"sides": sides, "tens": false, "want": str(value), "kept": f.kept})
	if specs.is_empty():
		_show_banner(roll)
		await _wait(2.0)
		return
	var n := specs.size()
	for i in range(n):
		_dice.append(_spawn(specs[i], i, n))
	# Rola até parar (ou o jogador tocar para pular).
	var t := 0.0
	var still := 0.0
	while t < 5.0 and still < 0.45 and not _skip:
		await get_tree().physics_frame
		t += get_physics_process_delta_time()
		var moving := false
		for d in _dice:
			var b: RigidBody3D = d.body
			if b.linear_velocity.length() > 0.08 or b.angular_velocity.length() > 0.25:
				moving = true
		still = 0.0 if moving else still + get_physics_process_delta_time()
	_settle()
	_show_banner(roll)
	var hold := 0.0
	_skip = false
	while hold < 2.4 and not _skip:
		await get_tree().process_frame
		hold += get_process_delta_time()


func _wait(sec: float) -> void:
	var t := 0.0
	while t < sec and not _skip:
		await get_tree().process_frame
		t += get_process_delta_time()


func _spawn(spec: Dictionary, i: int, n: int) -> Dictionary:
	var sides: int = spec.sides
	var pts := DiceGeom.points(sides)
	var fs := DiceGeom.faces(pts)
	var body := RigidBody3D.new()
	body.physics_material_override = _mat(0.35, 0.7)
	body.linear_damp = 0.25
	body.angular_damp = 0.55
	body.mass = 1.0
	var mi := MeshInstance3D.new()
	mi.mesh = DiceGeom.mesh(pts, fs)
	var mat := StandardMaterial3D.new()
	var kept: bool = spec.kept
	mat.albedo_color = Color("7b1f1f") if kept else Color("4a3a3a")
	mat.metallic = 0.25
	mat.roughness = 0.35
	mi.material_override = mat
	mi.scale = Vector3.ONE * DIE_SCALE
	body.add_child(mi)
	var cs := CollisionShape3D.new()
	var shape := ConvexPolygonShape3D.new()
	var scaled := PackedVector3Array()
	for p in pts:
		scaled.append(p * DIE_SCALE)
	shape.points = scaled
	cs.shape = shape
	body.add_child(cs)
	var labels := DiceGeom.labels(sides, spec.tens)
	var nodes: Array = []
	for fi in range(fs.size()):
		var f: Dictionary = fs[fi]
		var l := Label3D.new()
		l.text = labels[fi]
		l.font = UI.title_font()
		l.font_size = 72
		l.pixel_size = 0.0042 * (0.9 if sides == 20 else 1.1)
		l.modulate = Color("f0d9a0")
		l.outline_size = 8
		l.outline_modulate = Color("2a0a0a")
		l.double_sided = false
		l.no_depth_test = false
		var nrm: Vector3 = f.normal
		var up := Vector3.UP if abs(nrm.dot(Vector3.UP)) < 0.9 else Vector3.FORWARD
		l.transform = Transform3D(Basis.looking_at(-nrm, up), (f.center as Vector3) * DIE_SCALE + nrm * 0.012)
		body.add_child(l)
		nodes.append(l)
	var spread: float = (i - (n - 1) / 2.0) * 1.1
	body.position = Vector3(spread - 3.0, 2.4 + 0.35 * i, 1.6 - 0.2 * i)
	body.rotation = Vector3(randf() * TAU, randf() * TAU, randf() * TAU)
	_world.add_child(body)
	body.linear_velocity = Vector3(randf_range(4.0, 6.0), randf_range(-1.5, -0.5), randf_range(-2.8, -1.0))
	body.angular_velocity = Vector3(randf_range(-14, 14), randf_range(-14, 14), randf_range(-14, 14))
	return {"body": body, "faces": fs, "labels": labels, "nodes": nodes, "want": spec.want}


func _settle() -> void:
	for d in _dice:
		var b: RigidBody3D = d.body
		b.freeze = true
		var top := DiceGeom.top_face(d.faces, b.global_transform.basis)
		var labels := DiceGeom.relabel_top(d.labels, top, d.want)
		for i in range(labels.size()):
			(d.nodes[i] as Label3D).text = labels[i]
		d.labels = labels


func _show_banner(roll: Dictionary) -> void:
	_banner_title.text = str(roll.get("label", "Rolagem"))
	_banner_total.text = str(int(roll.total))
	var sub := ""
	if roll.get("dc") != null:
		sub = "contra %d — %s" % [int(roll.dc), "SUCESSO" if roll.get("success") == true else "falha"]
	if str(roll.get("crit", "")) == "acerto":
		sub = "ACERTO CRÍTICO!"
	elif str(roll.get("crit", "")) == "falha":
		sub = "Erro crítico"
	_banner_sub.text = sub
	_banner_sub.add_theme_color_override("font_color", UI.GREEN if roll.get("success") == true else (UI.RED if roll.get("success") == false else UI.TEXT))
	_banner.visible = true
