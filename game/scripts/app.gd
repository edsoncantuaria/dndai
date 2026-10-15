extends Control
## Raiz do cliente: tema, troca de telas e utilitários de captura (--shot) para teste visual.

var _screen: Control
var _toast: Label
var _toast_t := 0.0


func _ready() -> void:
	theme = UI.make_theme()
	var bg := ColorRect.new()
	bg.color = UI.BG
	UI.fill(bg)
	add_child(bg)
	_toast = UI.label("", 18, UI.GOLD)
	_toast.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_toast.position.y -= 24
	_toast.z_index = 100
	_toast.visible = false
	add_child(_toast)
	var args := _args()
	if args.has("slug"):
		Api.last_slug = args["slug"]
	if args.has("slug") and not args.has("screen"):
		open_table(args["slug"])
	else:
		match args.get("screen", "campaigns"):
			"creation":
				open_creation(args.get("slug", Api.last_slug))
			_:
				open_campaigns()
	if args.has("shot"):
		_shoot(args["shot"], float(args.get("delay", "2.0")))


func _args() -> Dictionary:
	var out := {}
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--") and a.contains("="):
			var kv := a.substr(2).split("=", true, 1)
			out[kv[0]] = kv[1]
	return out


func _shoot(path: String, delay: float) -> void:
	await get_tree().create_timer(delay).timeout
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(path)
	print("[shot] ", path, " ", img.get_size())
	get_tree().quit()


func set_screen(s: Control) -> void:
	if _screen:
		_screen.queue_free()
	_screen = s
	UI.fill(s)
	add_child(s)
	move_child(s, 1)


func open_campaigns() -> void:
	Api.unwatch()
	set_screen(preload("res://scripts/screens/campaigns.gd").new())


func open_creation(slug: String) -> void:
	set_screen(preload("res://scripts/screens/creation.gd").new(slug))


func open_table(slug: String) -> void:
	Api.last_slug = slug
	Api.save_settings()
	set_screen(preload("res://scripts/screens/table.gd").new(slug))


func toast(text: String) -> void:
	_toast.text = text
	_toast.visible = true
	_toast_t = 3.5


func _process(delta: float) -> void:
	if _toast_t > 0.0:
		_toast_t -= delta
		if _toast_t <= 0.0:
			_toast.visible = false
