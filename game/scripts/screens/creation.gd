extends Control
## Criador de personagem 2024 (Classe + Espécie + Antecedente). Todas as listas e regras vêm do servidor (SRD).

const STEPS := ["Classe", "Espécie", "Antecedente", "Atributos", "Perícias", "Equipamento", "Resumo"]
const ABILS := ["str", "dex", "con", "int", "wis", "cha"]
const ABIL_PT := {"str": "Força", "dex": "Destreza", "con": "Constituição", "int": "Inteligência", "wis": "Sabedoria", "cha": "Carisma"}
const POINT_COST := {8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9}

var slug := ""
var opts: Dictionary = {}
var needs: Dictionary = {}
var step := 0
var ch := {
	"name": "", "class": "", "species": "", "subspecies": "", "background": "", "method": "standard",
	"scores": {}, "bonus_mode": "21", "plus2": "", "plus1": "",
	"classSkills": [], "classTools": [], "mastery": [], "languages": [],
	"classEquipment": 0, "backgroundEquipment": 0, "equipmentPicks": [],
	"size": "", "spSkill": "", "spFeat": "",
	"cantrips": [], "prepared": [], "spellbook": [], "rollToken": "", "rolled": [],
}

var _title: Label
var _body: VBoxContainer
var _back: Button
var _next: Button
var _bar: HBoxContainer
var _error: Label


func _init(s := "") -> void:
	slug = s


func _ready() -> void:
	var root := UI.vbox(10)
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var m := UI.margin(root, 16)
	UI.fill(m)
	add_child(m)
	_title = UI.heading("Criar personagem", 32)
	root.add_child(_title)
	_bar = UI.hbox(6)
	root.add_child(_bar)
	_body = UI.vbox(10)
	root.add_child(UI.scroll(_body))
	_error = UI.label("", 18, UI.RED)
	root.add_child(_error)
	var foot := UI.hbox()
	_back = UI.button("Voltar", _go_back)
	_next = UI.button("Avançar", _go_next)
	_next.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	foot.add_child(_back)
	foot.add_child(_next)
	root.add_child(foot)
	var r: Dictionary = await Api.get_json("/api/creation/options")
	if not r.ok:
		_error.text = str(r.data.get("error", "Erro ao carregar opções."))
		return
	opts = r.data
	await _dev_preset()
	_render()


## Só para testes visuais: --preset=fighter|wizard --step=N preenche as escolhas.
func _dev_preset() -> void:
	var args := {}
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--") and a.contains("="):
			var kv := a.substr(2).split("=", true, 1)
			args[kv[0]] = kv[1]
	var preset: String = args.get("preset", "")
	if preset == "":
		return
	ch["name"] = "Brann" if preset == "fighter" else "Ilyra"
	ch["scores"] = {"str": 15, "dex": 13, "con": 14, "int": 8, "wis": 10, "cha": 12} if preset == "fighter" else {"str": 8, "dex": 14, "con": 14, "int": 15, "wis": 12, "cha": 10}
	if preset == "fighter":
		ch.merge({"class": "fighter", "species": "human", "background": "soldier", "plus2": "str", "plus1": "con", "classSkills": ["acrobatics", "history"], "mastery": ["greatsword", "flail", "javelin"], "languages": ["dwarvish", "elvish"], "spSkill": "perception", "spFeat": "alert"}, true)
	else:
		ch.merge({"class": "wizard", "species": "elf", "subspecies": "elven-lineage-high-elf", "background": "sage", "plus2": "int", "plus1": "con", "classSkills": ["investigation", "medicine"], "languages": ["dwarvish", "elvish"], "spSkill": "insight", "cantrips": ["light", "mage-hand", "ray-of-frost"], "spellbook": ["magic-missile", "shield", "mage-armor", "sleep", "detect-magic", "identify"], "prepared": ["magic-missile", "shield", "mage-armor", "sleep"]}, true)
	step = int(args.get("step", "0"))
	if step >= 4:
		await _fetch_needs()


# ---------- navegação ----------

func _go_back() -> void:
	if step == 0:
		get_parent().open_campaigns()
		return
	step -= 1
	_render()


func _go_next() -> void:
	_error.text = ""
	var err := _validate()
	if err != "":
		_error.text = err
		return
	if step == STEPS.size() - 1:
		_submit()
		return
	step += 1
	if step >= 4:
		await _fetch_needs()
	_render()


func _fetch_needs() -> void:
	var r: Dictionary = await Api.post_json("/api/creation/needs", {
		"class": ch["class"], "background": ch["background"], "species": ch["species"],
		"subspecies": ch["subspecies"] if ch["subspecies"] != "" else null,
		"classEquipment": ch["classEquipment"], "backgroundEquipment": ch["backgroundEquipment"],
	})
	if r.ok:
		needs = r.data
	else:
		_error.text = str(r.data.get("error", "Erro."))


func _by_index(list: Array, index: String) -> Dictionary:
	for x in list:
		if x.index == index:
			return x
	return {}


func _validate() -> String:
	match step:
		0:
			if str(ch["name"]).strip_edges() == "":
				return "Dê um nome ao personagem."
			if ch["class"] == "":
				return "Escolha uma classe."
		1:
			if ch["species"] == "":
				return "Escolha uma espécie."
			var sp := _by_index(opts.species, ch["species"])
			if not sp.subspecies.is_empty() and ch["subspecies"] == "":
				return "Escolha a linhagem/ancestralidade."
		2:
			if ch["background"] == "":
				return "Escolha um antecedente."
			if ch["bonus_mode"] == "21" and (ch["plus2"] == "" or ch["plus1"] == "" or ch["plus2"] == ch["plus1"]):
				return "Escolha dois atributos diferentes para +2 e +1."
		3:
			return _validate_scores()
		4:
			if needs.is_empty():
				return "Carregando..."
			if ch["classSkills"].size() != int(needs.skills.choose):
				return "Escolha %d perícia(s) da classe." % int(needs.skills.choose)
			if needs.tools != null and ch["classTools"].size() != int(needs.tools.choose):
				return "Escolha %d ferramenta(s)/instrumento(s)." % int(needs.tools.choose)
			if needs.mastery != null and ch["mastery"].size() != int(needs.mastery.count):
				return "Escolha %d arma(s) para Maestria." % int(needs.mastery.count)
			if ch["languages"].size() != 2:
				return "Escolha 2 idiomas."
			var sc: Dictionary = needs.speciesChoices
			if sc.size != null and ch["size"] == "":
				return "Escolha o tamanho."
			if sc.skill != null and ch["spSkill"] == "":
				return "Escolha a perícia da espécie."
			if sc.feat != null and ch["spFeat"] == "":
				return "Escolha o talento da espécie."
		5:
			if needs.spells != null:
				var sp: Dictionary = needs.spells
				if ch["cantrips"].size() != int(sp.cantrips):
					return "Escolha %d truque(s)." % int(sp.cantrips)
				if int(sp.spellbook) > 0 and ch["spellbook"].size() != int(sp.spellbook):
					return "Escolha %d magias para o grimório." % int(sp.spellbook)
				if ch["prepared"].size() != int(sp.prepared):
					return "Escolha %d magia(s) preparada(s)." % int(sp.prepared)
			for i in range(needs.equipmentPicks.size()):
				if i >= ch["equipmentPicks"].size() or ch["equipmentPicks"][i] == "":
					return "Escolha o item: %s." % needs.equipmentPicks[i].label
	return ""


func _validate_scores() -> String:
	var scores: Dictionary = ch["scores"]
	for a in ABILS:
		if not scores.has(a):
			return "Atribua um valor a cada atributo."
	if ch["method"] == "standard":
		var vals: Array = []
		for a in ABILS:
			vals.append(int(scores[a]))
		vals.sort()
		if vals != [8, 10, 12, 13, 14, 15]:
			return "Use cada valor do array padrão uma vez (15, 14, 13, 12, 10, 8)."
	elif ch["method"] == "pointbuy":
		if _points_spent() > 27:
			return "Você gastou mais de 27 pontos."
	elif ch["method"] == "roll":
		if ch["rollToken"] == "":
			return "Role os atributos."
		var vals: Array = []
		for a in ABILS:
			vals.append(int(scores[a]))
		vals.sort()
		var rolled: Array = ch["rolled"].duplicate()
		rolled.sort()
		if vals != rolled:
			return "Use cada valor rolado uma vez."
	return ""


func _points_spent() -> int:
	var total := 0
	for a in ABILS:
		total += int(POINT_COST.get(int(ch["scores"].get(a, 8)), 99))
	return total


# ---------- renderização ----------

func _render() -> void:
	UI.clear(_body)
	UI.clear(_bar)
	_title.text = "%d · %s" % [step + 1, STEPS[step]]
	for i in range(STEPS.size()):
		var seg := ColorRect.new()
		seg.custom_minimum_size = Vector2(0, 5)
		seg.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		seg.color = UI.GOLD if i <= step else Color("3a3025")
		_bar.add_child(seg)
	_back.text = "Voltar" if step > 0 else "Cancelar"
	_next.text = "Criar personagem" if step == STEPS.size() - 1 else "Avançar"
	match step:
		0: _step_class()
		1: _step_species()
		2: _step_background()
		3: _step_scores()
		4: _step_skills()
		5: _step_equipment()
		6: _step_summary()


func _pick_grid(items: Array, selected: String, on_pick: Callable, cols := 3) -> GridContainer:
	var g := GridContainer.new()
	g.columns = cols if not UI.is_narrow(self) else 2
	g.add_theme_constant_override("h_separation", 8)
	g.add_theme_constant_override("v_separation", 8)
	var group := ButtonGroup.new()
	for it in items:
		var b := UI.button(str(it.name), Callable())
		b.toggle_mode = true
		b.button_group = group
		b.button_pressed = it.index == selected
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(func(): on_pick.call(str(it.index)))
		g.add_child(b)
	return g


func _kv(k: String, v: String) -> Label:
	var l := UI.label("%s: %s" % [k, v], 19)
	return l


func _step_class() -> void:
	var name_in := LineEdit.new()
	name_in.placeholder_text = "Nome do personagem"
	name_in.text = ch["name"]
	name_in.text_changed.connect(func(t: String): ch["name"] = t)
	_body.add_child(UI.label("Nome", 20, UI.GOLD, UI.title_font()))
	_body.add_child(name_in)
	_body.add_child(UI.label("Classe", 20, UI.GOLD, UI.title_font()))
	var info := UI.panel()
	var info_box := UI.vbox(4)
	info.add_child(info_box)
	var show := func(idx: String):
		UI.clear(info_box)
		var c := _by_index(opts.classes, idx)
		if c.is_empty():
			info_box.add_child(UI.muted("Escolha uma classe para ver os detalhes."))
			return
		info_box.add_child(UI.label(str(c.name), 24, UI.GOLD, UI.title_font()))
		info_box.add_child(_kv("Dado de vida", "d%d" % int(c.hitDie)))
		info_box.add_child(_kv("Atributo principal", str(c.primary).replace("Strength", "Força").replace("Dexterity", "Destreza").replace("Constitution", "Constituição").replace("Intelligence", "Inteligência").replace("Wisdom", "Sabedoria").replace("Charisma", "Carisma").replace(" and ", " e ")))
		var saves: Array = []
		for s in c.saves:
			saves.append(ABIL_PT.get(s, s))
		info_box.add_child(_kv("Salvaguardas", ", ".join(saves)))
		info_box.add_child(_kv("Conjuração", "sim (%s)" % ABIL_PT.get(c.spellcasting.ability, "") if c.spellcasting != null else "não no nível 1"))
	_body.add_child(_pick_grid(opts.classes, ch["class"], func(i: String):
		ch["class"] = i
		show.call(i), 4))
	_body.add_child(info)
	show.call(ch["class"])


func _step_species() -> void:
	var sub_box := UI.vbox(6)
	var info := UI.panel()
	var info_box := UI.vbox(4)
	info.add_child(info_box)
	var show := func(idx: String):
		UI.clear(info_box)
		UI.clear(sub_box)
		var sp := _by_index(opts.species, idx)
		if sp.is_empty():
			info_box.add_child(UI.muted("Escolha uma espécie."))
			return
		info_box.add_child(UI.label(str(sp.name), 24, UI.GOLD, UI.title_font()))
		info_box.add_child(_kv("Tamanho", str(sp.size) if sp.size != null else "Pequeno ou Médio (você escolhe)"))
		info_box.add_child(_kv("Deslocamento", "%d ft." % int(sp.speed)))
		var tr: Array = []
		for t in sp.traits:
			tr.append(str(t.name))
		info_box.add_child(_kv("Traços", ", ".join(tr)))
		if not sp.subspecies.is_empty():
			sub_box.add_child(UI.label("Linhagem / ancestralidade", 20, UI.GOLD, UI.title_font()))
			sub_box.add_child(_pick_grid(sp.subspecies, ch["subspecies"], func(i: String): ch["subspecies"] = i, 2))
	_body.add_child(_pick_grid(opts.species, ch["species"], func(i: String):
		ch["species"] = i
		ch["subspecies"] = ""
		show.call(i), 3))
	_body.add_child(info)
	_body.add_child(sub_box)
	show.call(ch["species"])


func _step_background() -> void:
	var info := UI.panel()
	var info_box := UI.vbox(4)
	info.add_child(info_box)
	var bonus_box := UI.vbox(6)
	var show := func(idx: String):
		UI.clear(info_box)
		UI.clear(bonus_box)
		var b := _by_index(opts.backgrounds, idx)
		if b.is_empty():
			info_box.add_child(UI.muted("Escolha um antecedente."))
			return
		info_box.add_child(UI.label(str(b.name), 24, UI.GOLD, UI.title_font()))
		var abs: Array = []
		for a in b.abilities:
			abs.append(ABIL_PT.get(a, a))
		info_box.add_child(_kv("Atributos do antecedente", ", ".join(abs)))
		info_box.add_child(_kv("Talento de origem", str(b.featName)))
		var sk: Array = []
		for s in b.skills:
			sk.append(_skill_name(s))
		info_box.add_child(_kv("Perícias", ", ".join(sk)))
		bonus_box.add_child(UI.label("Bônus de atributo", 20, UI.GOLD, UI.title_font()))
		var mode := OptionButton.new()
		mode.add_item("+2 em um e +1 em outro", 0)
		mode.add_item("+1 nos três", 1)
		mode.selected = 0 if ch["bonus_mode"] == "21" else 1
		bonus_box.add_child(mode)
		var pick := UI.hbox()
		var p2 := OptionButton.new()
		var p1 := OptionButton.new()
		p2.add_item("+2 em…", -1)
		p1.add_item("+1 em…", -1)
		for i in range(b.abilities.size()):
			p2.add_item(ABIL_PT.get(b.abilities[i], b.abilities[i]), i)
			p1.add_item(ABIL_PT.get(b.abilities[i], b.abilities[i]), i)
		p2.item_selected.connect(func(ix: int): ch["plus2"] = "" if ix == 0 else b.abilities[ix - 1])
		p1.item_selected.connect(func(ix: int): ch["plus1"] = "" if ix == 0 else b.abilities[ix - 1])
		p2.selected = (b.abilities.find(ch["plus2"]) + 1) if ch["plus2"] != "" else 0
		p1.selected = (b.abilities.find(ch["plus1"]) + 1) if ch["plus1"] != "" else 0
		pick.add_child(p2)
		pick.add_child(p1)
		bonus_box.add_child(pick)
		pick.visible = ch["bonus_mode"] == "21"
		mode.item_selected.connect(func(ix: int):
			ch["bonus_mode"] = "21" if ix == 0 else "111"
			pick.visible = ix == 0)
	_body.add_child(_pick_grid(opts.backgrounds, ch["background"], func(i: String):
		ch["background"] = i
		ch["plus2"] = ""
		ch["plus1"] = ""
		show.call(i), 4))
	_body.add_child(info)
	_body.add_child(bonus_box)
	show.call(ch["background"])


func _skill_name(idx: String) -> String:
	return str(_by_index(opts.skills, idx).get("name", idx))


func _bonus_for(a: String) -> int:
	var b := _by_index(opts.backgrounds, ch["background"])
	if b.is_empty():
		return 0
	if ch["bonus_mode"] == "111":
		return 1 if b.abilities.has(a) else 0
	return 2 if ch["plus2"] == a else (1 if ch["plus1"] == a else 0)


func _step_scores() -> void:
	var method := OptionButton.new()
	method.add_item("Array padrão (15, 14, 13, 12, 10, 8)", 0)
	method.add_item("Compra de pontos (27)", 1)
	method.add_item("Rolar 4d6 (o servidor rola)", 2)
	method.selected = ["standard", "pointbuy", "roll"].find(ch["method"])
	_body.add_child(method)
	var area := UI.vbox(8)
	_body.add_child(area)
	var redraw := func():
		UI.clear(area)
		_scores_area(area)
	method.item_selected.connect(func(ix: int):
		ch["method"] = ["standard", "pointbuy", "roll"][ix]
		ch["scores"] = {}
		if ch["method"] == "pointbuy":
			for a in ABILS:
				ch["scores"][a] = 8
		redraw.call())
	if ch["method"] == "pointbuy" and ch["scores"].is_empty():
		for a in ABILS:
			ch["scores"][a] = 8
	redraw.call()


func _scores_area(area: VBoxContainer) -> void:
	var values: Array = []
	if ch["method"] == "standard":
		values = [15, 14, 13, 12, 10, 8]
	elif ch["method"] == "roll":
		var rb := UI.button("Rolar os atributos" if ch["rollToken"] == "" else "Rolado (não dá para rolar de novo)", func():
			var r: Dictionary = await Api.post_json("/api/c/%s/roll-abilities" % slug, {})
			if r.ok:
				ch["rollToken"] = r.data.token
				ch["rolled"] = r.data.scores
				ch["scores"] = {}
				UI.clear(area)
				_scores_area(area))
		rb.disabled = ch["rollToken"] != ""
		area.add_child(rb)
		if ch["rollToken"] == "":
			return
		values = ch["rolled"]
		area.add_child(UI.muted("Valores rolados: %s" % ", ".join(values.map(func(v): return str(int(v))))))
	if ch["method"] == "pointbuy":
		var left := UI.label("", 20, UI.GOLD)
		area.add_child(left)
		var rows: Dictionary = {}
		var refresh := func():
			left.text = "Pontos restantes: %d" % (27 - _points_spent())
			for a in ABILS:
				var fin := int(ch["scores"][a]) + _bonus_for(a)
				rows[a].text = "%d  →  %d (%s)" % [int(ch["scores"][a]), fin, UI.fmt_mod(int(floor((fin - 10) / 2.0)))]
		for a in ABILS:
			var row := UI.hbox()
			var n := UI.label(ABIL_PT[a], 20)
			n.custom_minimum_size.x = 150
			n.autowrap_mode = TextServer.AUTOWRAP_OFF
			row.add_child(n)
			row.add_child(UI.button("−", func():
				if int(ch["scores"][a]) > 8:
					ch["scores"][a] = int(ch["scores"][a]) - 1
					refresh.call(), 44))
			var v := UI.label("", 20, UI.TEXT)
			v.autowrap_mode = TextServer.AUTOWRAP_OFF
			v.custom_minimum_size.x = 170
			rows[a] = v
			row.add_child(v)
			row.add_child(UI.button("+", func():
				if int(ch["scores"][a]) < 15:
					ch["scores"][a] = int(ch["scores"][a]) + 1
					if _points_spent() > 27:
						ch["scores"][a] = int(ch["scores"][a]) - 1
					refresh.call(), 44))
			area.add_child(row)
		refresh.call()
		return
	for a in ABILS:
		var row := UI.hbox()
		var n := UI.label(ABIL_PT[a], 20)
		n.custom_minimum_size.x = 150
		row.add_child(n)
		var ob := OptionButton.new()
		ob.add_item("—", -1)
		for v in values:
			ob.add_item(str(int(v)))
		var cur: int = int(ch["scores"].get(a, -1))
		for i in range(ob.item_count):
			if ob.get_item_text(i) == str(cur):
				ob.selected = i
		var fin := UI.label("", 19, UI.MUTED)
		fin.autowrap_mode = TextServer.AUTOWRAP_OFF
		ob.custom_minimum_size.x = 150
		n.autowrap_mode = TextServer.AUTOWRAP_OFF
		ob.item_selected.connect(func(ix: int):
			if ix == 0:
				ch["scores"].erase(a)
				fin.text = ""
			else:
				ch["scores"][a] = int(ob.get_item_text(ix))
				var f: int = int(ch["scores"][a]) + _bonus_for(a)
				fin.text = "→ %d (%s)" % [f, UI.fmt_mod(int(floor((f - 10) / 2.0)))])
		row.add_child(ob)
		row.add_child(fin)
		area.add_child(row)
		if cur > 0:
			var f := cur + _bonus_for(a)
			fin.text = "→ %d (%s)" % [f, UI.fmt_mod(int(floor((f - 10) / 2.0)))]


func _checks(title: String, items: Array, selected: Array, limit: int, on_change: Callable = Callable()) -> VBoxContainer:
	## items: [{index, name}] ou [String]. selected é alterado no lugar.
	var box := UI.vbox(4)
	var head := UI.label("%s (%d/%d)" % [title, selected.size(), limit], 20, UI.GOLD, UI.title_font())
	box.add_child(head)
	var g := GridContainer.new()
	g.columns = 2 if UI.is_narrow(self) else 3
	box.add_child(g)
	var boxes: Array = []
	for it in items:
		var idx: String = it.index if it is Dictionary else str(it)
		var nm: String = str(it.name) if it is Dictionary else _skill_name(idx)
		var cb := CheckBox.new()
		cb.text = nm
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
		boxes.append(cb)
	return box


func _option(items: Array, current: String, on_pick: Callable, placeholder := "Escolha…") -> OptionButton:
	var ob := OptionButton.new()
	ob.add_item(placeholder, -1)
	var sel := 0
	for i in range(items.size()):
		var it = items[i]
		ob.add_item(str(it.name) if it is Dictionary else _skill_name(str(it)))
		if (it.index if it is Dictionary else str(it)) == current:
			sel = i + 1
	ob.selected = sel
	ob.item_selected.connect(func(ix: int): on_pick.call("" if ix == 0 else (items[ix - 1].index if items[ix - 1] is Dictionary else str(items[ix - 1]))))
	return ob


func _step_skills() -> void:
	if needs.is_empty():
		_body.add_child(UI.muted("Carregando..."))
		return
	_body.add_child(_checks("Perícias da classe", needs.skills.from, ch["classSkills"], int(needs.skills.choose)))
	if needs.tools != null:
		_body.add_child(_checks("Ferramentas / instrumentos", needs.tools.from, ch["classTools"], int(needs.tools.choose)))
	if needs.mastery != null:
		_body.add_child(_checks("Maestria com armas", needs.mastery.from, ch["mastery"], int(needs.mastery.count)))
	_body.add_child(_checks("Idiomas (além do Comum)", needs.languages.from, ch["languages"], 2))
	var sc: Dictionary = needs.speciesChoices
	if sc.size != null:
		_body.add_child(UI.label("Tamanho", 20, UI.GOLD, UI.title_font()))
		_body.add_child(_option(sc.size.map(func(s): return {"index": s, "name": "Pequeno" if s == "Small" else "Médio"}), ch["size"], func(v: String): ch["size"] = v))
	if sc.skill != null:
		_body.add_child(UI.label("Perícia da espécie", 20, UI.GOLD, UI.title_font()))
		var taken: Array = ch["classSkills"].duplicate()
		var bg := _by_index(opts.backgrounds, ch["background"])
		taken.append_array(bg.skills)
		_body.add_child(_option(sc.skill.filter(func(s): return not taken.has(s)), ch["spSkill"], func(v: String): ch["spSkill"] = v))
	if sc.feat != null:
		_body.add_child(UI.label("Talento de origem da espécie", 20, UI.GOLD, UI.title_font()))
		_body.add_child(_option(sc.feat, ch["spFeat"], func(v: String): ch["spFeat"] = v))


func _step_equipment() -> void:
	if needs.is_empty():
		_body.add_child(UI.muted("Carregando..."))
		return
	var cls := _by_index(opts.classes, ch["class"])
	var bg := _by_index(opts.backgrounds, ch["background"])
	var picks_box := UI.vbox(6)
	var refresh_picks := func():
		await _fetch_needs()
		UI.clear(picks_box)
		ch["equipmentPicks"].resize(needs.equipmentPicks.size())
		for i in range(needs.equipmentPicks.size()):
			if ch["equipmentPicks"][i] == null:
				ch["equipmentPicks"][i] = ""
			var p: Dictionary = needs.equipmentPicks[i]
			picks_box.add_child(UI.label(str(p.label), 19, UI.TEXT))
			var items: Array = p.from.map(func(e): return {"index": e, "name": str(e).replace("-", " ").capitalize()})
			var idx := i
			picks_box.add_child(_option(items, str(ch["equipmentPicks"][i]), func(v: String): ch["equipmentPicks"][idx] = v))
	_body.add_child(UI.label("Equipamento da classe", 20, UI.GOLD, UI.title_font()))
	_body.add_child(_radio(cls.equipment, int(ch["classEquipment"]), func(i: int):
		ch["classEquipment"] = i
		ch["equipmentPicks"] = []
		refresh_picks.call()))
	_body.add_child(UI.label("Equipamento do antecedente", 20, UI.GOLD, UI.title_font()))
	_body.add_child(_radio(bg.equipment, int(ch["backgroundEquipment"]), func(i: int):
		ch["backgroundEquipment"] = i
		ch["equipmentPicks"] = []
		refresh_picks.call()))
	_body.add_child(picks_box)
	ch["equipmentPicks"].resize(needs.equipmentPicks.size())
	for i in range(needs.equipmentPicks.size()):
		if ch["equipmentPicks"][i] == null:
			ch["equipmentPicks"][i] = ""
		var p: Dictionary = needs.equipmentPicks[i]
		picks_box.add_child(UI.label(str(p.label), 19, UI.TEXT))
		var items: Array = p.from.map(func(e): return {"index": e, "name": str(e).replace("-", " ").capitalize()})
		var idx := i
		picks_box.add_child(_option(items, str(ch["equipmentPicks"][i]), func(v: String): ch["equipmentPicks"][idx] = v))
	if needs.spells != null:
		var sp: Dictionary = needs.spells
		_body.add_child(UI.label("Magias", 22, UI.GOLD, UI.title_font()))
		_body.add_child(_checks("Truques", sp.cantripList, ch["cantrips"], int(sp.cantrips)))
		if int(sp.spellbook) > 0:
			var prepared_holder := UI.vbox(4)
			var redraw := func():
				UI.clear(prepared_holder)
				ch["prepared"] = ch["prepared"].filter(func(x): return ch["spellbook"].has(x))
				var book: Array = sp.levelOneList.filter(func(s): return ch["spellbook"].has(s.index))
				prepared_holder.add_child(_checks("Preparadas (do grimório)", book, ch["prepared"], int(sp.prepared)))
			_body.add_child(_checks("Grimório (nível 1)", sp.levelOneList, ch["spellbook"], int(sp.spellbook), redraw))
			_body.add_child(prepared_holder)
			redraw.call()
		else:
			_body.add_child(_checks("Magias preparadas (nível 1)", sp.levelOneList, ch["prepared"], int(sp.prepared)))


func _radio(options: Array, selected: int, on_pick: Callable) -> VBoxContainer:
	var box := UI.vbox(6)
	var group := ButtonGroup.new()
	for i in range(options.size()):
		var b := Button.new()
		b.toggle_mode = true
		b.button_group = group
		b.text = ("%s) %s" % [char(65 + i), str(options[i])])
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b.focus_mode = Control.FOCUS_NONE
		b.button_pressed = i == selected
		var idx := i
		b.pressed.connect(func(): on_pick.call(idx))
		box.add_child(b)
	return box


func _step_summary() -> void:
	var cls := _by_index(opts.classes, ch["class"])
	var sp := _by_index(opts.species, ch["species"])
	var bg := _by_index(opts.backgrounds, ch["background"])
	var p := UI.panel(16)
	var v := UI.vbox(6)
	p.add_child(v)
	v.add_child(UI.heading(str(ch["name"]), 30))
	v.add_child(UI.label("%s %s · %s" % [sp.name, cls.name, bg.name], 22))
	var line := ""
	for a in ABILS:
		var f := int(ch["scores"][a]) + _bonus_for(a)
		line += "%s %d (%s)   " % [ABIL_PT[a].substr(0, 3).to_upper(), f, UI.fmt_mod(int(floor((f - 10) / 2.0)))]
	v.add_child(UI.label(line, 20, UI.GOLD))
	var sk: Array = []
	for s in ch["classSkills"]:
		sk.append(_skill_name(s))
	v.add_child(_kv("Perícias da classe", ", ".join(sk)))
	v.add_child(_kv("Equipamento", "%s / %s" % [cls.equipment[int(ch["classEquipment"])], bg.equipment[int(ch["backgroundEquipment"])]]))
	_body.add_child(p)
	_body.add_child(UI.muted("O servidor confere todas as regras do SRD ao criar."))


func _choices() -> Dictionary:
	var c := {
		"name": str(ch["name"]).strip_edges(), "class": ch["class"], "species": ch["species"], "background": ch["background"],
		"method": ch["method"], "scores": ch["scores"].duplicate(),
		"classSkills": ch["classSkills"], "classEquipment": ch["classEquipment"], "backgroundEquipment": ch["backgroundEquipment"],
		"languages": ch["languages"], "equipmentPicks": ch["equipmentPicks"],
	}
	if ch["subspecies"] != "":
		c["subspecies"] = ch["subspecies"]
	if ch["bonus_mode"] == "111":
		c["bonus"] = {"plus1x3": true}
	else:
		c["bonus"] = {"plus2": ch["plus2"], "plus1": ch["plus1"]}
	if not ch["classTools"].is_empty():
		c["classTools"] = ch["classTools"]
	if not ch["mastery"].is_empty():
		c["mastery"] = ch["mastery"]
	var sc := {}
	if ch["size"] != "":
		sc["size"] = ch["size"]
	if ch["spSkill"] != "":
		sc["skill"] = ch["spSkill"]
	if ch["spFeat"] != "":
		sc["feat"] = ch["spFeat"]
	if not sc.is_empty():
		c["speciesChoices"] = sc
	if ch["method"] == "roll":
		c["rollToken"] = ch["rollToken"]
	if needs.get("spells") != null:
		var s := {"cantrips": ch["cantrips"], "prepared": ch["prepared"]}
		if not ch["spellbook"].is_empty():
			s["spellbook"] = ch["spellbook"]
		c["spells"] = s
	return c


func _submit() -> void:
	_next.disabled = true
	var r: Dictionary = await Api.post_json("/api/c/%s/character" % slug, _choices())
	_next.disabled = false
	if not r.ok:
		_error.text = str(r.data.get("error", "Erro ao criar."))
		return
	get_parent().open_table(slug)
