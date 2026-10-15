extends Control
## A mesa: narração, ação livre e sugestões, estado do herói e painéis. Mobile first; ≥ 900 px ganha coluna lateral.

var slug := ""
var view: Dictionary = {}
var _loading := false
var _reload := false
var _started := false
var _rendered: Dictionary = {}
var _drawer_kind := ""
var _speaking_turn := -1
var _last_roll_id := -1
var _pending_action := ""

var _voice: Node
var _top_place: Label
var _top_pc: Label
var _hp: ProgressBar
var _nav: HBoxContainer
var _narr: VBoxContainer
var _scroll: ScrollContainer
var _status: Label
var _options: HFlowContainer
var _input: LineEdit
var _send: Button
var _side: PanelContainer
var _side_box: VBoxContainer
var _drawer: PanelContainer
var _drawer_body: VBoxContainer
var _drawer_title: Label
var _death: Button
var _voice_btn: Button
var _dice: Control


func _init(s := "") -> void:
	slug = s


func _ready() -> void:
	_voice = preload("res://scripts/voice.gd").new()
	add_child(_voice)
	_build()
	Api.changed.connect(func(_v: int): _request_load())
	Api.connection.connect(func(ok: bool): _status.text = "" if ok else "Reconectando…")
	Api.watch(slug)
	get_viewport().size_changed.connect(_relayout)
	_relayout()
	await _request_load()
	# Só para testes visuais: --act="texto" envia uma ação ao abrir.
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--act="):
			_send_action(a.substr(6))
		elif a == "--drawers=all":
			await _cycle_drawers()
		elif a == "--levelup":
			_level_up()
		elif a.begins_with("--drawer="):
			open_drawer(a.substr(9))


## Só para testes: abre cada gaveta (e a subida de nível, se houver) e sai; erros de script aparecem no log.
func _cycle_drawers() -> void:
	for kind in ["sheet", "bag", "spells", "journal", "people", "map"]:
		open_drawer(kind)
		await get_tree().process_frame
		await get_tree().process_frame
	close_drawer()
	if view.pc.can_level_up:
		_level_up()
		await get_tree().create_timer(5.0).timeout  # com --levelup-auto o formulário se preenche, confirma e sai
	print("[drawers] ok ", slug, " nível ", int(view.pc.level))
	get_tree().quit()


func _exit_tree() -> void:
	if _voice:
		_voice.stop()


# ---------- construção ----------

func _build() -> void:
	var root := UI.vbox(8)
	var m := UI.margin(root, 12)
	UI.fill(m)
	add_child(m)

	# Topo: lugar, PV e menu
	var top := UI.hbox(10)
	var left := UI.vbox(2)
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_top_place = UI.label("", 24, UI.GOLD, UI.title_font())
	_top_place.autowrap_mode = TextServer.AUTOWRAP_OFF
	_top_place.clip_text = true
	_top_pc = UI.label("", 17, UI.MUTED)
	_top_pc.autowrap_mode = TextServer.AUTOWRAP_OFF
	left.add_child(_top_place)
	left.add_child(_top_pc)
	top.add_child(left)
	_voice_btn = UI.button("🔊", _toggle_voice, 44)
	_voice_btn.custom_minimum_size.x = 56
	top.add_child(_voice_btn)
	top.add_child(UI.button("☰", _menu, 44))
	root.add_child(top)
	_hp = UI.hp_bar(1, 1, 10)
	root.add_child(_hp)

	# Navegação rápida
	var nav_scroll := ScrollContainer.new()
	nav_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	nav_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	nav_scroll.custom_minimum_size.y = 52
	_nav = UI.hbox(6)
	for p in [["Ficha", "sheet"], ["Bolsa", "bag"], ["Grimório", "spells"], ["Diário", "journal"], ["Pessoas", "people"], ["Mapa", "map"]]:
		var kind: String = p[1]
		_nav.add_child(UI.button(p[0], func(): open_drawer(kind), 44))
	nav_scroll.add_child(_nav)
	root.add_child(nav_scroll)

	# Corpo: lateral (largo) + centro
	var body := UI.hbox(12)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_side = UI.panel(12)
	_side.custom_minimum_size.x = 300
	_side_box = UI.vbox(6)
	_side.add_child(UI.scroll(_side_box))
	body.add_child(_side)
	var center := UI.vbox(8)
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_narr = UI.vbox(18)
	_scroll = UI.scroll(_narr)
	center.add_child(_scroll)
	_status = UI.label("", 18, UI.MUTED)
	center.add_child(_status)
	_options = HFlowContainer.new()
	_options.add_theme_constant_override("h_separation", 8)
	_options.add_theme_constant_override("v_separation", 8)
	center.add_child(_options)
	_death = UI.button("Rolar salvaguarda contra a morte", _death_save)
	_death.visible = false
	center.add_child(_death)
	var inrow := UI.hbox()
	_input = LineEdit.new()
	_input.placeholder_text = "O que você faz?"
	_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_input.custom_minimum_size.y = 48
	_input.text_submitted.connect(func(_t: String): _submit())
	_send = UI.button("Agir", _submit, 48)
	inrow.add_child(_input)
	inrow.add_child(_send)
	center.add_child(inrow)
	body.add_child(center)
	root.add_child(body)

	# Gaveta (overlay)
	_drawer = UI.panel(14)
	_drawer.visible = false
	_drawer.z_index = 20
	var dv := UI.vbox(8)
	_drawer.add_child(dv)
	var dh := UI.hbox()
	_drawer_title = UI.label("", 22, UI.GOLD, UI.title_font())
	_drawer_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dh.add_child(_drawer_title)
	dh.add_child(UI.button("Fechar", close_drawer, 40))
	dv.add_child(dh)
	_drawer_body = UI.vbox(8)
	dv.add_child(UI.scroll(_drawer_body))
	add_child(_drawer)


func _relayout() -> void:
	var wide := not UI.is_narrow(self)
	_side.visible = wide
	var sz := get_viewport_rect().size
	if wide:
		_drawer.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
		_drawer.offset_left = -min(460.0, sz.x * 0.45)
		_drawer.offset_right = -12
		_drawer.offset_top = 12
		_drawer.offset_bottom = -12
	else:
		UI.fill(_drawer)
		_drawer.offset_left = 8
		_drawer.offset_right = -8
		_drawer.offset_top = 8
		_drawer.offset_bottom = -8


# ---------- dados do servidor ----------

func _request_load() -> void:
	if _loading:
		_reload = true
		return
	_loading = true
	while true:
		_reload = false
		var r: Dictionary = await Api.get_json("/api/c/%s/view" % slug)
		if r.ok:
			view = r.data
			if view.get("creation_needed", false):
				get_parent().open_creation(slug)
				return
			_apply()
		else:
			_status.text = "✗ " + str(r.data.get("error", "erro"))
		if not _reload:
			break
	_loading = false


func _apply() -> void:
	var pc: Dictionary = view.pc
	_top_place.text = str(view.place.name) if view.place != null else "—"
	_top_pc.text = "%s · %s · PV %d/%d · CA %d" % [view.campaign.when, pc.name, int(pc.hp), int(pc.max_hp), int(pc.ac)]
	_hp.max_value = max(1, int(pc.max_hp))
	_hp.value = int(pc.hp)
	_render_side()
	_render_narration()
	_render_options()
	_render_master()
	_death.visible = pc.status == "inconsciente"
	_maybe_roll()
	if _drawer.visible:
		_fill_drawer()
	_started = true


func _render_side() -> void:
	UI.clear(_side_box)
	var pc: Dictionary = view.pc
	_side_box.add_child(UI.heading(str(pc.name), 24))
	_side_box.add_child(UI.label("%s %s %d" % [pc.species, pc.class, int(pc.level)], 18, UI.MUTED))
	_side_box.add_child(UI.hp_bar(int(pc.hp), int(pc.max_hp), 16))
	_side_box.add_child(UI.label("PV %d/%d · CA %d" % [int(pc.hp), int(pc.max_hp), int(pc.ac)], 18))
	if not pc.conditions.is_empty():
		_side_box.add_child(UI.label(", ".join(pc.conditions), 16, UI.RED))
	if pc.raging:
		_side_box.add_child(UI.label("🔥 Em Fúria", 17, UI.RED))
	if pc.concentration != null:
		_side_box.add_child(UI.label("◎ Concentrando: %s" % str(pc.concentration).replace("-", " "), 16, UI.BLUE))
	if pc.can_level_up:
		_side_box.add_child(UI.button("⬆ Subir de nível", _level_up, 40))
	if view.combat != null:
		_side_box.add_child(UI.label("⚔ Combate — rodada %d" % int(view.combat.round), 20, UI.RED, UI.title_font()))
		for i in range(view.combat.order.size()):
			var o: Dictionary = view.combat.order[i]
			var mark := "▶ " if i == int(view.combat.turn) else "   "
			_side_box.add_child(UI.label("%s%s  %d/%d" % [mark, o.name, int(o.hp), int(o.max_hp)], 17, UI.GOLD if i == int(view.combat.turn) else UI.TEXT))
	_side_box.add_child(UI.label("Aqui", 18, UI.GOLD, UI.title_font()))
	for n in view.present:
		_side_box.add_child(UI.label("• %s%s" % [n.name, " ☠" if n.status == "morto" else ""], 17, UI.RED if n.kind == "monster" else UI.TEXT))
	if view.present.is_empty():
		_side_box.add_child(UI.muted("Ninguém."))


func _render_narration() -> void:
	var entries: Array = view.journal
	var newest := -1
	for e in entries:
		if not _rendered.has(int(e.turn)):
			newest = int(e.turn)
	for e in entries:
		var t := int(e.turn)
		if _rendered.has(t):
			continue
		var block := _make_block(str(e.action), str(e.text), _started and t == newest)
		_rendered[t] = block
		_narr.add_child(block)
		# O turno pendente (otimista) some quando o Mestre responde.
		if _pending_node and is_instance_valid(_pending_node):
			_pending_node.queue_free()
			_pending_node = null
		if _started and t == newest:
			_pending_action = ""
			if _voice_enabled():
				_voice.speak(slug, t)
	_scroll_down()


var _pending_node: Control


func _make_block(action: String, text: String, animate: bool) -> Control:
	var v := UI.vbox(6)
	if action != "" and not action.begins_with("("):
		var a := UI.label("› " + action, 19, UI.GOLD_DIM, UI.italic_font())
		v.add_child(a)
	var rt := RichTextLabel.new()
	rt.bbcode_enabled = true
	rt.fit_content = true
	rt.scroll_active = false
	rt.selection_enabled = true
	rt.text = TextFx.to_bbcode(text)
	rt.add_theme_font_size_override("normal_font_size", 23)
	rt.add_theme_font_size_override("bold_font_size", 23)
	rt.add_theme_font_size_override("italics_font_size", 23)
	rt.add_theme_constant_override("line_separation", 6)
	v.add_child(rt)
	if animate:
		rt.visible_ratio = 0.0
		var dur: float = clamp(text.length() * 0.016, 0.8, 12.0)
		var tw := create_tween()
		tw.tween_property(rt, "visible_ratio", 1.0, dur)
		tw.parallel().tween_method(func(_x: float): _scroll_down(), 0.0, 1.0, dur)
		rt.gui_input.connect(func(ev: InputEvent):
			if ev is InputEventMouseButton and ev.pressed:
				tw.kill()
				rt.visible_ratio = 1.0)
	return v


func _scroll_down() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	_scroll.scroll_vertical = int(_scroll.get_v_scroll_bar().max_value)


func _render_options() -> void:
	UI.clear(_options)
	var thinking: bool = view.master.status != "ocioso"
	if thinking:
		return
	for o in view.options:
		var txt: String = str(o)
		_options.add_child(UI.button(txt, func(): _send_action(txt), 44))


func _render_master() -> void:
	var m: Dictionary = view.master
	var busy: bool = m.status == "pensando" or m.status == "na_fila"
	_input.editable = not busy and view.pc.status != "morto"
	_send.disabled = busy
	match m.status:
		"pensando":
			_status.text = "O Mestre está pensando… " + ("" if m.activity == null else str(m.activity))
			_status.add_theme_color_override("font_color", UI.GOLD_DIM)
		"na_fila":
			_status.text = "Na fila do Mestre…"
		"erro":
			_status.text = "✗ " + str(m.error if m.error != null else "O Mestre falhou. Tente de novo.")
			_status.add_theme_color_override("font_color", UI.RED)
		_:
			_status.text = ""
	if view.pc.status == "morto":
		_status.text = "Seu personagem morreu. A campanha termina aqui."


# ---------- ações ----------

func _submit() -> void:
	var t := _input.text.strip_edges()
	if t == "":
		return
	_input.text = ""
	_send_action(t)


func _send_action(text: String) -> void:
	_voice.stop()
	var r: Dictionary = await Api.post_json("/api/c/%s/act" % slug, {"text": text})
	if not r.ok:
		get_parent().toast(str(r.data.get("error", "Não foi possível enviar.")))
		return
	_pending_action = text
	_options_clear_pending(text)
	_request_load()


func _options_clear_pending(text: String) -> void:
	UI.clear(_options)
	var v := UI.vbox(6)
	v.add_child(UI.label("› " + text, 19, UI.GOLD_DIM, UI.italic_font()))
	_narr.add_child(v)
	_pending_node = v
	_scroll_down()


func _death_save() -> void:
	var r: Dictionary = await Api.post_json("/api/c/%s/death-save" % slug, {})
	if r.ok:
		get_parent().toast(str(r.data.text))
		view = r.data.view
		_request_load()
	else:
		get_parent().toast(str(r.data.get("error", "Erro.")))


func _level_up() -> void:
	var lu: Control = preload("res://scripts/screens/levelup.gd").new(slug, view)
	lu.z_index = 60
	UI.fill(lu)
	add_child(lu)
	lu.finished.connect(func(done: bool):
		lu.queue_free()
		if done:
			get_parent().toast("Você subiu de nível!")
			_request_load())


func _toggle_voice() -> void:
	_voice.enabled = not _voice.enabled
	_voice_btn.text = "🔊" if _voice.enabled else "🔇"
	if not _voice.enabled:
		_voice.stop()


func _voice_enabled() -> bool:
	return _voice.enabled


func _menu() -> void:
	var pm := PopupMenu.new()
	if view.pc.can_level_up:
		pm.add_item("⬆ Subir de nível", 4)
	pm.add_item("Descanso curto", 0)
	pm.add_item("Descanso longo", 1)
	pm.add_item("Desfazer última jogada", 2)
	pm.add_item("Trocar de campanha", 3)
	add_child(pm)
	pm.id_pressed.connect(func(id: int):
		match id:
			0: _rest("short")
			1: _rest("long")
			2: _undo()
			3: get_parent().open_campaigns()
			4: _level_up()
		pm.queue_free())
	pm.popup_centered(Vector2i(320, 220))


func _rest(kind: String) -> void:
	var r: Dictionary = await Api.post_json("/api/c/%s/rest" % slug, {"kind": kind, "dice": 0})
	get_parent().toast(str(r.data.get("text", r.data.get("error", ""))))
	_request_load()


func _undo() -> void:
	var r: Dictionary = await Api.post_json("/api/c/%s/undo" % slug, {})
	get_parent().toast("Desfeito: %s" % str(r.data.get("undone")) if r.ok and r.data.undone != null else "Nada para desfazer.")
	for ch in _narr.get_children():
		ch.queue_free()
	_rendered.clear()
	_started = false
	_request_load()


# ---------- gaveta ----------

func open_drawer(kind: String) -> void:
	_drawer_kind = kind
	_drawer.visible = true
	_fill_drawer()


func close_drawer() -> void:
	_drawer.visible = false
	_drawer_kind = ""


func _fill_drawer() -> void:
	UI.clear(_drawer_body)
	_drawer_title.text = {"sheet": "Ficha", "bag": "Bolsa", "spells": "Grimório", "journal": "Diário", "people": "Pessoas", "map": "Mapa"}.get(_drawer_kind, "")
	var c: Control
	match _drawer_kind:
		"sheet": c = Drawers.sheet(view)
		"bag": c = Drawers.bag(view, _on_item)
		"spells": c = Drawers.spells(view, _on_spell)
		"journal": c = Drawers.journal(view)
		"people": c = Drawers.people(view)
		"map": c = Drawers.map(view, _on_go)
	if c:
		_drawer_body.add_child(c)


func _on_item(action: String, id: String) -> void:
	var r: Dictionary = await Api.post_json("/api/c/%s/item" % slug, {"action": action, "item": id})
	if not r.ok:
		get_parent().toast(str(r.data.get("error", "Erro.")))
	_request_load()


func _on_go(place_name: String) -> void:
	close_drawer()
	_send_action("Vou para %s." % place_name)


func _on_spell(index: String) -> void:
	var r: Dictionary = await Api.get_json("/api/srd/spells/%s" % index)
	if not r.ok:
		return
	var s: Dictionary = r.data
	var d := AcceptDialog.new()
	d.title = str(s.name)
	d.dialog_text = "%s · nível %d\nTempo de conjuração: %s · Alcance: %s · Duração: %s\n\n%s" % [s.school.name, int(s.level), s.casting_time, s.range, s.duration, str(s.description)]
	d.min_size = Vector2i(560, 360)
	d.dialog_autowrap = true
	add_child(d)
	d.popup_centered()
	d.confirmed.connect(d.queue_free)


# ---------- dados ----------

func _maybe_roll() -> void:
	var rolls: Array = view.rolls
	if rolls.is_empty():
		return
	var newest: Dictionary = rolls.back()
	if _last_roll_id < 0:
		_last_roll_id = int(newest.id)
		return
	var fresh: Array = rolls.filter(func(r): return int(r.id) > _last_roll_id)
	if fresh.is_empty():
		return
	_last_roll_id = int(newest.id)
	_show_rolls(fresh)


func _show_rolls(fresh: Array) -> void:
	if _dice and is_instance_valid(_dice):
		_dice.queue_free()
	_dice = preload("res://scripts/dice/dice_tray.gd").new()
	_dice.z_index = 50
	UI.fill(_dice)
	add_child(_dice)
	_dice.play(fresh)
