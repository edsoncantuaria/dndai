extends Control
## Lista de campanhas, conexão com o servidor e criação de campanha nova.

var _list: VBoxContainer
var _status: Label
var _url: LineEdit
var _token: LineEdit
var _name: LineEdit
var _premise: TextEdit
var _tone: LineEdit


func _ready() -> void:
	var root := UI.vbox(14)
	var center := CenterContainer.new()
	UI.fill(center)
	add_child(center)
	var col := UI.vbox(14)
	col.custom_minimum_size = Vector2(min(720.0, get_viewport_rect().size.x - 32.0), 0)
	var wrap := UI.margin(UI.scroll(root), 0)
	wrap.custom_minimum_size = Vector2(col.custom_minimum_size.x, get_viewport_rect().size.y - 40.0)
	center.add_child(wrap)
	root.custom_minimum_size.x = col.custom_minimum_size.x

	root.add_child(UI.heading("Crônicas", 40))
	root.add_child(UI.muted("Uma mesa de D&D 2024 narrada por um Mestre de IA."))

	var srv := UI.panel()
	var sv := UI.vbox(8)
	srv.add_child(sv)
	sv.add_child(UI.label("Servidor", 20, UI.GOLD, UI.title_font()))
	_url = LineEdit.new()
	_url.text = Api.base
	_url.placeholder_text = "http://127.0.0.1:8790"
	sv.add_child(_url)
	_token = LineEdit.new()
	_token.text = Api.token
	_token.secret = true
	_token.placeholder_text = "token (se o servidor exigir)"
	sv.add_child(_token)
	var row := UI.hbox()
	row.add_child(UI.button("Conectar", _connect))
	_status = UI.muted("")
	_status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(_status)
	sv.add_child(row)
	root.add_child(srv)

	root.add_child(UI.label("Campanhas", 24, UI.GOLD, UI.title_font()))
	_list = UI.vbox(8)
	root.add_child(_list)

	var np := UI.panel()
	var nv := UI.vbox(8)
	np.add_child(nv)
	nv.add_child(UI.label("Nova campanha", 20, UI.GOLD, UI.title_font()))
	_name = LineEdit.new()
	_name.placeholder_text = "Nome da campanha"
	nv.add_child(_name)
	_premise = TextEdit.new()
	_premise.placeholder_text = "Premissa (ex.: uma vila isolada esconde um culto)"
	_premise.custom_minimum_size = Vector2(0, 90)
	_premise.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	nv.add_child(_premise)
	_tone = LineEdit.new()
	_tone.placeholder_text = "Tom (ex.: sombrio, esperança teimosa)"
	nv.add_child(_tone)
	nv.add_child(UI.button("Criar e escolher personagem", _create))
	root.add_child(np)
	_refresh()


func _connect() -> void:
	Api.base = _url.text.strip_edges().trim_suffix("/")
	Api.token = _token.text.strip_edges()
	Api.save_settings()
	_refresh()


func _refresh() -> void:
	_status.text = "Conectando..."
	UI.clear(_list)
	var r: Dictionary = await Api.get_json("/api/campaigns")
	if not r.ok:
		_status.text = "✗ " + str(r.data.get("error", "erro"))
		_status.add_theme_color_override("font_color", UI.RED)
		return
	_status.text = "✓ conectado"
	_status.add_theme_color_override("font_color", UI.GREEN)
	var items: Array = r.data
	if items.is_empty():
		_list.add_child(UI.muted("Nenhuma campanha ainda. Crie a primeira abaixo."))
	for c in items:
		var row := UI.hbox()
		var l := UI.label(str(c.name), 22)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(l)
		row.add_child(UI.button("Jogar", func(): _play(str(c.slug))))
		var p := UI.panel(8)
		p.add_child(row)
		_list.add_child(p)


func _app() -> Node:
	return get_parent()


func _play(slug: String) -> void:
	var v: Dictionary = await Api.get_json("/api/c/%s/view" % slug)
	if v.ok and v.data.get("creation_needed", false):
		_app().open_creation(slug)
	else:
		_app().open_table(slug)


func _create() -> void:
	var name := _name.text.strip_edges()
	if name == "":
		_app().toast("Dê um nome à campanha.")
		return
	var r: Dictionary = await Api.post_json("/api/campaigns", {"name": name, "premise": _premise.text.strip_edges(), "tone": _tone.text.strip_edges()})
	if not r.ok:
		_app().toast(str(r.data.get("error", "Erro ao criar.")))
		return
	_app().open_creation(str(r.data.slug))
