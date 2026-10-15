extends Control
## Subida de nível: o servidor diz o que escolher (subclasse, aumento de atributo, magias, maestria).

signal finished(done: bool)

var slug := ""
var needs: Dictionary = {}
var view: Dictionary = {}
var _body: VBoxContainer
var _error: Label
var _ok: Button
var c := {"hp": "average", "subclass": "", "asi_mode": "plus2", "asi_a": "", "asi_b": "", "feat": "", "cantrips": [], "prepared": [], "spellbook": [], "mastery": []}
var _mastery_opts: Array = []


func _init(s := "", v := {}) -> void:
	slug = s
	view = v


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.7)
	UI.fill(dim)
	add_child(dim)
	var panel := UI.panel(16)
	UI.fill(panel)
	panel.offset_left = 12
	panel.offset_right = -12
	panel.offset_top = 12
	panel.offset_bottom = -12
	if not UI.is_narrow(self):
		panel.anchor_left = 0.2
		panel.anchor_right = 0.8
		panel.offset_left = 0
		panel.offset_right = 0
	add_child(panel)
	var v := UI.vbox(8)
	panel.add_child(v)
	v.add_child(UI.heading("Subir de nível", 30))
	_body = UI.vbox(10)
	v.add_child(UI.scroll(_body))
	_error = UI.label("", 18, UI.RED)
	v.add_child(_error)
	var foot := UI.hbox()
	foot.add_child(UI.button("Agora não", func(): finished.emit(false)))
	_ok = UI.button("Confirmar", _submit)
	_ok.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	foot.add_child(_ok)
	v.add_child(foot)
	var r: Dictionary = await Api.get_json("/api/c/%s/level-up" % slug)
	if not r.ok:
		_error.text = str(r.data.get("error", "Erro."))
		return
	needs = r.data
	if needs.mastery != null:
		var n: Dictionary = (await Api.post_json("/api/creation/needs", {"class": view.pc.class_index, "background": "soldier", "species": "human"})).data
		_mastery_opts = n.mastery.from if n.get("mastery") != null else []
	_render()
	if OS.get_cmdline_user_args().has("--levelup-auto"):
		await _dev_auto()


## Só para testes: escolhe a primeira opção válida de tudo, como um jogador apressado, e confirma.
func _dev_auto() -> void:
	if needs.subclass != null:
		c["subclass"] = str(needs.subclass[0].index)
	if needs.asi != null:
		c["asi_mode"] = "plus1"
		c["asi_a"] = str(needs.asi.abilities[0])
		c["asi_b"] = str(needs.asi.abilities[1])
	if needs.epic_boon != null:
		c["feat"] = str(needs.epic_boon[0].index)
	if needs.spells != null:
		var sp: Dictionary = needs.spells
		for x in sp.cantrip_list:
			if c["cantrips"].size() < int(sp.cantrips) and not c["cantrips"].has(x.index):
				c["cantrips"].append(x.index)
		if sp.wizard:
			var want: int = c["spellbook"].size() + 2
			for x in sp.spell_list:
				if c["spellbook"].size() < want and not c["spellbook"].has(x.index):
					c["spellbook"].append(x.index)
		var pool: Array = c["spellbook"] if sp.wizard else sp.spell_list.map(func(x): return x.index)
		c["prepared"] = c["prepared"].filter(func(x): return pool.has(x)).slice(0, int(sp.prepared))
		for x in pool:
			if c["prepared"].size() < int(sp.prepared) and not c["prepared"].has(x):
				c["prepared"].append(x)
	if needs.mastery != null:
		for x in _mastery_opts:
			if c["mastery"].size() < int(needs.mastery.count):
				c["mastery"].append(x.index)
	await _submit()
	print("[levelup] ", "erro: " + _error.text if _error.text != "" else "ok", " nível ", int(needs.level))
	get_tree().quit()


func _checks(title: String, items: Array, selected: Array, limit: int, on_change := Callable()) -> VBoxContainer:
	var box := UI.vbox(4)
	var head := UI.label("%s (%d/%d)" % [title, selected.size(), limit], 20, UI.GOLD, UI.title_font())
	box.add_child(head)
	var g := GridContainer.new()
	g.columns = 2 if UI.is_narrow(self) else 3
	box.add_child(g)
	for it in items:
		var idx: String = str(it.index)
		var cb := CheckBox.new()
		cb.text = str(it.name)
		cb.button_pressed = selected.has(idx)
		cb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cb.toggled.connect(func(on: bool):
			if on:
				if selected.size() >= limit:
					cb.set_pressed_no_signal(false)
					return
				selected.append(idx)
			else:
				selected.erase(idx)
			head.text = "%s (%d/%d)" % [title, selected.size(), limit]
			if on_change.is_valid():
				on_change.call())
		g.add_child(cb)
	return box


func _option(items: Array, current: String, on_pick: Callable) -> OptionButton:
	var ob := OptionButton.new()
	ob.add_item("Escolha…")
	var sel := 0
	for i in range(items.size()):
		ob.add_item(str(items[i].name))
		if str(items[i].index) == current:
			sel = i + 1
	ob.selected = sel
	ob.item_selected.connect(func(ix: int): on_pick.call("" if ix == 0 else str(items[ix - 1].index)))
	return ob


func _render() -> void:
	UI.clear(_body)
	_body.add_child(UI.label("Nível %d" % int(needs.level), 24, UI.GOLD))
	if not needs.new_features.is_empty():
		_body.add_child(UI.label("Novas características: " + ", ".join(needs.new_features.map(func(f): return str(f.name))), 19))
	var hp := OptionButton.new()
	hp.add_item("PV: média fixa (%+d)" % (int(needs.hp_average) + int(needs.con_mod)), 0)
	hp.add_item("PV: rolar 1d%d (%+d de Constituição)" % [int(needs.hit_die), int(needs.con_mod)], 1)
	hp.item_selected.connect(func(i: int): c["hp"] = "average" if i == 0 else "roll")
	_body.add_child(hp)
	if needs.subclass != null:
		_body.add_child(UI.label("Subclasse", 20, UI.GOLD, UI.title_font()))
		_body.add_child(_option(needs.subclass, c["subclass"], func(v: String): c["subclass"] = v))
	if needs.asi != null:
		_body.add_child(UI.label("Aumento de Atributo ou Talento", 20, UI.GOLD, UI.title_font()))
		var mode := OptionButton.new()
		mode.add_item("+2 em um atributo", 0)
		mode.add_item("+1 em dois atributos", 1)
		mode.add_item("Talento geral", 2)
		var inner := UI.vbox(6)
		var abil: Array = needs.asi.abilities.map(func(a): return {"index": a, "name": str(a).to_upper()})
		var fill := func():
			UI.clear(inner)
			match c["asi_mode"]:
				"plus2":
					inner.add_child(_option(abil, c["asi_a"], func(v: String): c["asi_a"] = v))
				"plus1":
					inner.add_child(_option(abil, c["asi_a"], func(v: String): c["asi_a"] = v))
					inner.add_child(_option(abil, c["asi_b"], func(v: String): c["asi_b"] = v))
				"feat":
					inner.add_child(_option(needs.asi.feats, c["feat"], func(v: String): c["feat"] = v))
		mode.item_selected.connect(func(i: int):
			c["asi_mode"] = ["plus2", "plus1", "feat"][i]
			fill.call())
		_body.add_child(mode)
		_body.add_child(inner)
		fill.call()
	if needs.epic_boon != null:
		_body.add_child(UI.label("Dádiva Épica", 20, UI.GOLD, UI.title_font()))
		_body.add_child(_option(needs.epic_boon, c["feat"], func(v: String): c["feat"] = v))
	if needs.spells != null:
		var sp: Dictionary = needs.spells
		c["cantrips"] = sp.current.cantrips.duplicate()
		c["prepared"] = sp.current.prepared.duplicate()
		if sp.current.spellbook != null:
			c["spellbook"] = sp.current.spellbook.duplicate()
		_body.add_child(_checks("Truques", sp.cantrip_list, c["cantrips"], int(sp.cantrips)))
		if sp.wizard:
			var holder := UI.vbox(4)
			var redraw := func():
				UI.clear(holder)
				c["prepared"] = c["prepared"].filter(func(x): return c["spellbook"].has(x))
				holder.add_child(_checks("Preparadas", sp.spell_list.filter(func(s): return c["spellbook"].has(s.index)), c["prepared"], int(sp.prepared)))
			_body.add_child(_checks("Grimório (+2 por nível)", sp.spell_list, c["spellbook"], c["spellbook"].size() + 2, redraw))
			_body.add_child(holder)
			redraw.call()
		else:
			_body.add_child(_checks("Magias preparadas", sp.spell_list, c["prepared"], int(sp.prepared)))
	if needs.mastery != null:
		_body.add_child(_checks("Maestria com armas", _mastery_opts, c["mastery"], int(needs.mastery.count)))


func _payload() -> Dictionary:
	var p := {"hp": c["hp"]}
	if needs.subclass != null:
		p["subclass"] = c["subclass"]
	if needs.asi != null and c["asi_mode"] == "feat":
		p["asi"] = {"feat": c["feat"]}
	elif needs.asi != null:
		var plus := {}
		if c["asi_mode"] == "plus2":
			plus[c["asi_a"]] = 2
		else:
			plus[c["asi_a"]] = 1
			plus[c["asi_b"]] = int(plus.get(c["asi_b"], 0)) + 1
		p["asi"] = {"plus": plus}
	if needs.epic_boon != null:
		p["asi"] = {"feat": c["feat"]}
	if needs.spells != null:
		var s := {"cantrips": c["cantrips"], "prepared": c["prepared"]}
		if needs.spells.wizard:
			s["spellbook"] = c["spellbook"]
		p["spells"] = s
	if needs.mastery != null:
		p["mastery"] = c["mastery"]
	return p


func _submit() -> void:
	_ok.disabled = true
	var r: Dictionary = await Api.post_json("/api/c/%s/level-up" % slug, _payload())
	_ok.disabled = false
	if not r.ok:
		_error.text = str(r.data.get("error", "Erro."))
		return
	finished.emit(true)
