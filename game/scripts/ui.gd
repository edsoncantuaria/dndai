class_name UI
extends RefCounted
## Tema e helpers de interface (tudo em código: sem editor, sem .tres para quebrar).

const BG := Color("14110e")
const PANEL := Color("1f1913")
const PANEL_HI := Color("2a2219")
const GOLD := Color("c9a45c")
const GOLD_DIM := Color("8a6d3b")
const TEXT := Color("e8dcc0")
const MUTED := Color("a89b7c")
const RED := Color("b0413e")
const GREEN := Color("6b9a55")
const BLUE := Color("5b86b0")

static var _title_font: Font
static var _body_font: Font
static var _italic_font: Font
static var _bold_font: Font


static func fonts() -> void:
	if _body_font:
		return
	_title_font = load("res://assets/fonts/Cinzel-SemiBold.ttf")
	_body_font = load("res://assets/fonts/EBGaramond-Regular.ttf")
	_italic_font = load("res://assets/fonts/EBGaramond-Italic.ttf")
	_bold_font = load("res://assets/fonts/EBGaramond-Bold.ttf")


static func title_font() -> Font:
	fonts()
	return _title_font


static func body_font() -> Font:
	fonts()
	return _body_font


static func italic_font() -> Font:
	fonts()
	return _italic_font


static func bold_font() -> Font:
	fonts()
	return _bold_font


static func box(bg: Color, border: Color = GOLD_DIM, radius := 6, border_w := 1, pad := 10) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(border_w)
	s.set_corner_radius_all(radius)
	s.set_content_margin_all(pad)
	s.anti_aliasing = true
	return s


static func make_theme() -> Theme:
	fonts()
	var t := Theme.new()
	t.default_font = _body_font
	t.default_font_size = 20
	# Rótulos
	t.set_color("font_color", "Label", TEXT)
	# Botões
	for state in ["normal", "hover", "pressed", "disabled", "focus"]:
		var bg := PANEL_HI
		var border := GOLD_DIM
		match state:
			"hover":
				bg = Color("33291d")
				border = GOLD
			"pressed":
				bg = Color("3d2f1f")
				border = GOLD
			"disabled":
				bg = Color("181410")
				border = Color("3a3025")
			"focus":
				bg = PANEL_HI
				border = GOLD
		t.set_stylebox(state, "Button", box(bg, border, 6, 1, 12))
	t.set_font("font", "Button", _title_font)
	t.set_font_size("font_size", "Button", 17)
	t.set_color("font_color", "Button", TEXT)
	t.set_color("font_hover_color", "Button", GOLD)
	t.set_color("font_pressed_color", "Button", GOLD)
	t.set_color("font_disabled_color", "Button", Color("6b604b"))
	# Campos
	t.set_stylebox("normal", "LineEdit", box(Color("0f0c09"), GOLD_DIM, 4, 1, 8))
	t.set_stylebox("focus", "LineEdit", box(Color("0f0c09"), GOLD, 4, 1, 8))
	t.set_stylebox("normal", "TextEdit", box(Color("0f0c09"), GOLD_DIM, 4, 1, 8))
	t.set_stylebox("focus", "TextEdit", box(Color("0f0c09"), GOLD, 4, 1, 8))
	t.set_color("font_color", "LineEdit", TEXT)
	t.set_color("font_placeholder_color", "LineEdit", Color("6b604b"))
	t.set_color("caret_color", "LineEdit", GOLD)
	t.set_color("font_color", "TextEdit", TEXT)
	# Painéis, abas, listas
	t.set_stylebox("panel", "PanelContainer", box(PANEL))
	t.set_stylebox("panel", "Panel", box(PANEL))
	t.set_stylebox("panel", "PopupMenu", box(PANEL))
	t.set_color("font_color", "OptionButton", TEXT)
	t.set_stylebox("normal", "OptionButton", box(PANEL_HI, GOLD_DIM, 6, 1, 10))
	t.set_stylebox("hover", "OptionButton", box(Color("33291d"), GOLD, 6, 1, 10))
	t.set_stylebox("pressed", "OptionButton", box(Color("3d2f1f"), GOLD, 6, 1, 10))
	t.set_stylebox("focus", "OptionButton", box(PANEL_HI, GOLD, 6, 1, 10))
	t.set_color("font_color", "CheckBox", TEXT)
	t.set_color("font_color", "RichTextLabel", TEXT)
	t.set_color("default_color", "RichTextLabel", TEXT)
	t.set_font("normal_font", "RichTextLabel", _body_font)
	t.set_font("italics_font", "RichTextLabel", _italic_font)
	t.set_font("bold_font", "RichTextLabel", _bold_font)
	t.set_font_size("normal_font_size", "RichTextLabel", 22)
	t.set_font_size("italics_font_size", "RichTextLabel", 22)
	t.set_font_size("bold_font_size", "RichTextLabel", 22)
	# Barras e scroll
	t.set_stylebox("background", "ProgressBar", box(Color("0f0c09"), GOLD_DIM, 4, 1, 0))
	t.set_stylebox("fill", "ProgressBar", box(RED, RED, 4, 0, 0))
	t.set_stylebox("scroll", "VScrollBar", box(Color("0f0c09"), Color("0f0c09"), 4, 0, 2))
	t.set_stylebox("grabber", "VScrollBar", box(GOLD_DIM, GOLD_DIM, 4, 0, 4))
	t.set_stylebox("grabber_highlight", "VScrollBar", box(GOLD, GOLD, 4, 0, 4))
	t.set_stylebox("grabber_pressed", "VScrollBar", box(GOLD, GOLD, 4, 0, 4))
	t.set_constant("separation", "VBoxContainer", 8)
	t.set_constant("separation", "HBoxContainer", 8)
	return t


# ---------- construtores ----------

static func label(text: String, size := 20, color := TEXT, font: Font = null) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if font:
		l.add_theme_font_override("font", font)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


static func heading(text: String, size := 28) -> Label:
	var l := label(text, size, GOLD, title_font())
	return l


static func muted(text: String, size := 17) -> Label:
	return label(text, size, MUTED)


static func button(text: String, cb: Callable = Callable(), min_h := 44) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, min_h)
	b.focus_mode = Control.FOCUS_NONE
	if cb.is_valid():
		b.pressed.connect(cb)
	return b


static func panel(inner_pad := 12, bg := PANEL) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", box(bg, GOLD_DIM, 8, 1, inner_pad))
	return p


static func vbox(sep := 8) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", sep)
	return v


static func hbox(sep := 8) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", sep)
	return h


static func margin(child: Control, px := 16) -> MarginContainer:
	var m := MarginContainer.new()
	for side in ["left", "right", "top", "bottom"]:
		m.add_theme_constant_override("margin_" + side, px)
	m.add_child(child)
	return m


static func scroll(child: Control) -> ScrollContainer:
	var s := ScrollContainer.new()
	s.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	s.size_flags_vertical = Control.SIZE_EXPAND_FILL
	child.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.add_child(child)
	return s


static func fill(c: Control) -> void:
	c.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)


static func clear(node: Node) -> void:
	for ch in node.get_children():
		node.remove_child(ch)
		ch.queue_free()


static func hp_bar(hp: int, max_hp: int, h := 14) -> ProgressBar:
	var b := ProgressBar.new()
	b.max_value = max(1, max_hp)
	b.value = hp
	b.show_percentage = false
	b.custom_minimum_size = Vector2(0, h)
	var ratio := float(hp) / float(max(1, max_hp))
	var col := GREEN if ratio > 0.5 else (Color("c9a02e") if ratio > 0.25 else RED)
	b.add_theme_stylebox_override("fill", box(col, col, 4, 0, 0))
	return b


static func fmt_mod(n: int) -> String:
	return "+%d" % n if n >= 0 else "%d" % n


static func money(cp: int) -> String:
	var gp := cp / 100
	var rest := cp % 100
	if rest == 0:
		return "%d PO" % gp
	return "%d PO %d PP" % [gp, rest / 10] if rest % 10 == 0 else "%d PO %d PC" % [gp, rest]


## Largura < 900 = layout de celular.
static func is_narrow(node: Node) -> bool:
	return node.get_viewport().get_visible_rect().size.x < 900.0
