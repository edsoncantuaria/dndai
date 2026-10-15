class_name Drawers
extends RefCounted
## Painéis do jogo (ficha, bolsa, grimório, pessoas, diário, mapa). Funções puras: view → Control.

const ABIL_ORDER := ["str", "dex", "con", "int", "wis", "cha"]


static func _kv(k: String, v: String, color := UI.TEXT) -> HBoxContainer:
	var h := UI.hbox(6)
	var a := UI.label(k, 18, UI.MUTED)
	a.autowrap_mode = TextServer.AUTOWRAP_OFF
	var b := UI.label(v, 18, color)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	h.add_child(a)
	h.add_child(b)
	return h


static func _section(title: String) -> Label:
	return UI.label(title, 20, UI.GOLD, UI.title_font())


static func sheet(view: Dictionary) -> Control:
	var pc: Dictionary = view.pc
	var v := UI.vbox(10)
	v.add_child(UI.heading(str(pc.name), 30))
	var sub := "%s %s %d" % [pc.species, pc.class, int(pc.level)]
	if pc.subclass != null:
		sub += " (%s)" % pc.subclass
	v.add_child(UI.label("%s · %s" % [sub, pc.background], 20, UI.MUTED))
	var hp := UI.hp_bar(int(pc.hp), int(pc.max_hp), 20)
	v.add_child(hp)
	var temp := (" +%d temp" % int(pc.temp_hp)) if int(pc.temp_hp) > 0 else ""
	v.add_child(UI.label("PV %d/%d%s   ·   CA %d   ·   Deslocamento %d ft.   ·   Prof. %s" % [int(pc.hp), int(pc.max_hp), temp, int(pc.ac), int(pc.speed), UI.fmt_mod(int(pc.prof))], 19))
	if pc.xp_next != null:
		v.add_child(UI.label("XP %d / %d%s" % [int(pc.xp), int(pc.xp_next), "   ⬆ subida de nível disponível" if pc.can_level_up else ""], 18, UI.GOLD if pc.can_level_up else UI.MUTED))
	if not pc.conditions.is_empty():
		v.add_child(UI.label("Condições: " + ", ".join(pc.conditions), 18, UI.RED))
	v.add_child(_section("Atributos"))
	var g := GridContainer.new()
	g.columns = 3
	g.add_theme_constant_override("h_separation", 8)
	g.add_theme_constant_override("v_separation", 8)
	for a in ABIL_ORDER:
		var ab: Dictionary = pc.abilities[a]
		var card := UI.panel(8, UI.PANEL_HI)
		card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var cv := UI.vbox(0)
		card.add_child(cv)
		var n := UI.label(str(ab.name), 16, UI.MUTED)
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		n.autowrap_mode = TextServer.AUTOWRAP_OFF
		var m := UI.label(UI.fmt_mod(int(ab.mod)), 30, UI.GOLD, UI.title_font())
		m.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		var s := UI.label("%d · salv. %s%s" % [int(ab.score), UI.fmt_mod(int(ab.save)), "*" if ab.save_proficient else ""], 15, UI.TEXT)
		s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		s.autowrap_mode = TextServer.AUTOWRAP_OFF
		cv.add_child(n)
		cv.add_child(m)
		cv.add_child(s)
		g.add_child(card)
	v.add_child(g)
	v.add_child(_section("Perícias"))
	var sg := GridContainer.new()
	sg.columns = 2
	sg.add_theme_constant_override("h_separation", 24)
	for sk in pc.skills:
		var mark := "●" if sk.proficient else "○"
		if sk.expertise:
			mark = "◆"
		var row := _kv("%s %s" % [mark, sk.name], UI.fmt_mod(int(sk.bonus)), UI.GOLD if sk.proficient else UI.TEXT)
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		sg.add_child(row)
	v.add_child(sg)
	v.add_child(_kv("Iniciativa", UI.fmt_mod(int(pc.initiative))))
	v.add_child(_kv("Percepção passiva", str(int(pc.passive_perception))))
	v.add_child(_kv("Dados de vida", "%d/%d d%d" % [int(pc.hit_dice.left), int(pc.hit_dice.max), int(pc.hit_dice.die)]))
	if not pc.resources.is_empty():
		v.add_child(_section("Recursos"))
		for r in pc.resources:
			v.add_child(_kv(str(r.key).replace("_", " ").capitalize(), "%d/%d" % [int(r.left), int(r.max)]))
	if not pc.slots.is_empty():
		v.add_child(_section("Espaços de magia"))
		for s in pc.slots:
			v.add_child(_kv("Nível %d" % int(s.level), "●".repeat(int(s.max) - int(s.used)) + "○".repeat(int(s.used))))
	v.add_child(_section("Características"))
	v.add_child(UI.label(", ".join(pc.features.map(func(f): return str(f.name))), 18))
	if not pc.feats.is_empty():
		v.add_child(_section("Talentos"))
		v.add_child(UI.label(", ".join(pc.feats.map(func(f): return str(f.name))), 18))
	v.add_child(_section("Traços da espécie"))
	v.add_child(UI.label(", ".join(pc.traits.map(func(f): return str(f.name))), 18))
	v.add_child(_section("Idiomas"))
	v.add_child(UI.label(", ".join(pc.languages), 18))
	return v


## `on_item(action, id)` é chamado pelos botões da bolsa.
static func bag(view: Dictionary, on_item: Callable) -> Control:
	var v := UI.vbox(10)
	v.add_child(UI.heading("Bolsa", 28))
	v.add_child(UI.label("Dinheiro: %s" % UI.money(int(view.pc.money_cp)), 20, UI.GOLD))
	v.add_child(_section("Ataques"))
	for a in view.attacks:
		v.add_child(_kv(str(a.name), "%s · %s %s" % [UI.fmt_mod(int(a.bonus)), a.damage, a.damageType]))
	v.add_child(_section("Itens"))
	if view.items.is_empty():
		v.add_child(UI.muted("Nada na bolsa."))
	for it in view.items:
		var p := UI.panel(8, UI.PANEL_HI)
		var row := UI.hbox()
		p.add_child(row)
		var name := "%s%s%s" % ["%d× " % int(it.qty) if int(it.qty) > 1 else "", it.name, "  ✓ equipado" if it.equipped else ""]
		var l := UI.label(name, 20, UI.GOLD if it.equipped else UI.TEXT)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(l)
		for act in it.actions:
			var id: String = it.id
			var action: String = act
			row.add_child(UI.button(action.capitalize(), func(): on_item.call(action, id), 40))
		v.add_child(p)
	return v


## `on_spell(index)` abre a descrição da magia.
static func spells(view: Dictionary, on_spell: Callable) -> Control:
	var v := UI.vbox(10)
	v.add_child(UI.heading("Grimório", 28))
	var sp = view.pc.spell
	if sp == null:
		v.add_child(UI.muted("Seu personagem não conjura magias."))
		return v
	v.add_child(UI.label("CD %d · ataque %s · atributo %s" % [int(sp.dc), UI.fmt_mod(int(sp.attack)), str(sp.ability).to_upper()], 20, UI.GOLD))
	for s in view.pc.slots:
		v.add_child(_kv("Espaços de nível %d" % int(s.level), "●".repeat(int(s.max) - int(s.used)) + "○".repeat(int(s.used))))
	v.add_child(_section("Truques"))
	for c in sp.cantrips:
		var idx: String = c.index
		v.add_child(UI.button(str(c.name), func(): on_spell.call(idx), 40))
	v.add_child(_section("Preparadas"))
	for c in sp.prepared:
		var idx: String = c.index
		v.add_child(UI.button("%s  (nível %d)" % [c.name, int(c.level)], func(): on_spell.call(idx), 40))
	return v


static func attitude_label(a: int) -> String:
	if a <= -60:
		return "hostil"
	if a <= -20:
		return "desconfiado"
	if a < 20:
		return "neutro"
	if a < 60:
		return "amigável"
	return "devoto"


static func people(view: Dictionary) -> Control:
	var v := UI.vbox(10)
	v.add_child(UI.heading("Pessoas aqui", 28))
	if view.present.is_empty():
		v.add_child(UI.muted("Ninguém além de você."))
	for n in view.present:
		var p := UI.panel(10, UI.PANEL_HI)
		var cv := UI.vbox(4)
		p.add_child(cv)
		var head := UI.hbox()
		var name := UI.label(str(n.name), 22, UI.RED if n.kind == "monster" else UI.TEXT, UI.title_font())
		name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		head.add_child(name)
		var tag := Drawers.attitude_label(int(n.attitude))
		if n.companion:
			tag = "companheiro"
		head.add_child(UI.label(tag, 17, UI.MUTED))
		cv.add_child(head)
		cv.add_child(UI.label(str(n.summary), 18, UI.MUTED))
		if n.kind == "monster" or int(n.hp) < int(n.max_hp):
			cv.add_child(UI.hp_bar(int(n.hp), int(n.max_hp), 10))
		if n.status != "vivo":
			cv.add_child(UI.label(str(n.status).to_upper(), 16, UI.RED))
		v.add_child(p)
	return v


static func journal(view: Dictionary) -> Control:
	var v := UI.vbox(10)
	v.add_child(UI.heading("Diário", 28))
	v.add_child(_section("Missões"))
	var any := false
	for q in view.quests:
		any = true
		var p := UI.panel(10, UI.PANEL_HI)
		var cv := UI.vbox(4)
		p.add_child(cv)
		var status := str(q.status)
		cv.add_child(UI.label("%s%s" % [q.title, "" if status == "ativa" else "  (%s)" % status], 21, UI.GOLD if status == "ativa" else UI.MUTED, UI.title_font()))
		cv.add_child(UI.label(str(q.summary), 18))
		for o in q.objectives:
			cv.add_child(UI.label("• " + str(o), 17, UI.MUTED))
		v.add_child(p)
	if not any:
		v.add_child(UI.muted("Nenhuma missão ainda."))
	return v


## `on_go(place_id)` pede o movimento ao Mestre ("Vou para X").
static func map(view: Dictionary, on_go: Callable) -> Control:
	var v := UI.vbox(10)
	v.add_child(UI.heading("Mapa", 28))
	if view.place == null:
		return v
	v.add_child(UI.label("Você está em: %s" % view.place.name, 22, UI.GOLD))
	v.add_child(UI.label(str(view.place.summary), 18, UI.MUTED))
	v.add_child(_section("Saídas"))
	if view.exits.is_empty():
		v.add_child(UI.muted("Nenhuma saída conhecida."))
	for e in view.exits:
		var nm: String = str(e.name)
		var label := "%s — %d min%s" % [nm, int(e.minutes), "" if int(e.visited) == 1 else "  (inexplorado)"]
		v.add_child(UI.button(label, func(): on_go.call(nm), 44))
	return v
