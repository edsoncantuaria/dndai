extends Node
## Cliente do servidor dndai: HTTP JSON + WebSocket de "mudou". Autoload `Api`.

signal changed(version: int)
signal connection(ok: bool)

const SETTINGS := "user://settings.cfg"

var base := "http://127.0.0.1:8790"
var token := ""
var last_slug := ""

var _ws := WebSocketPeer.new()
var _ws_slug := ""
var _ws_open := false
var _retry := 0.0


func _ready() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SETTINGS) == OK:
		base = cfg.get_value("server", "base", base)
		token = cfg.get_value("server", "token", "")
		last_slug = cfg.get_value("server", "slug", "")
	# Web: o cliente é servido pelo próprio servidor (mesma origem); o token vem em ?token= na primeira abertura.
	if OS.has_feature("web"):
		base = str(JavaScriptBridge.eval("window.location.origin"))
		var t := str(JavaScriptBridge.eval("new URLSearchParams(location.search).get('token') || ''"))
		if t != "":
			token = t
			save_settings()
	# Variáveis de ambiente têm prioridade (testes, execução de desenvolvimento).
	if OS.get_environment("DNDAI_URL") != "":
		base = OS.get_environment("DNDAI_URL")
	if OS.get_environment("DNDAI_TOKEN") != "":
		token = OS.get_environment("DNDAI_TOKEN")


func save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("server", "base", base)
	cfg.set_value("server", "token", token)
	cfg.set_value("server", "slug", last_slug)
	cfg.save(SETTINGS)


## Chamada HTTP. Devolve {ok, status, data}; `data` é o JSON (ou {error}).
func call_api(method: HTTPClient.Method, path: String, body: Variant = null) -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = 30.0
	add_child(http)
	var headers := PackedStringArray(["Content-Type: application/json"])
	if token != "":
		headers.append("Authorization: Bearer " + token)
	var payload := "" if body == null else JSON.stringify(body)
	var err := http.request(base + path, headers, method, payload)
	if err != OK:
		http.queue_free()
		return {"ok": false, "status": 0, "data": {"error": "Não foi possível iniciar a requisição (%d)." % err}}
	var res: Array = await http.request_completed
	http.queue_free()
	var code: int = res[1]
	var text: String = (res[3] as PackedByteArray).get_string_from_utf8()
	var parsed: Variant = JSON.parse_string(text) if text != "" else {}
	if code == 0 or res[0] != HTTPRequest.RESULT_SUCCESS:
		return {"ok": false, "status": 0, "data": {"error": "Servidor indisponível em %s." % base}}
	if parsed == null:
		parsed = {"error": text.left(200)}
	return {"ok": code >= 200 and code < 300, "status": code, "data": parsed}


func get_json(path: String) -> Dictionary:
	return await call_api(HTTPClient.METHOD_GET, path)


func post_json(path: String, body: Variant = {}) -> Dictionary:
	return await call_api(HTTPClient.METHOD_POST, path, body)


## Binário (voz): devolve os bytes do MP3 ou vazio.
func get_bytes(path: String) -> PackedByteArray:
	var http := HTTPRequest.new()
	http.timeout = 60.0
	add_child(http)
	var headers := PackedStringArray()
	if token != "":
		headers.append("Authorization: Bearer " + token)
	if http.request(base + path, headers) != OK:
		http.queue_free()
		return PackedByteArray()
	var res: Array = await http.request_completed
	http.queue_free()
	if res[0] != HTTPRequest.RESULT_SUCCESS or res[1] != 200:
		return PackedByteArray()
	return res[3]


func watch(slug: String) -> void:
	_ws_slug = slug
	_connect_ws()


func unwatch() -> void:
	_ws_slug = ""
	if _ws_open:
		_ws.close()


func _ws_url() -> String:
	var u := base.replace("https://", "wss://").replace("http://", "ws://")
	return "%s/ws?campaign=%s&token=%s" % [u, _ws_slug, token.uri_encode()]


func _connect_ws() -> void:
	if _ws_slug == "":
		return
	_ws = WebSocketPeer.new()
	_ws.connect_to_url(_ws_url())
	_retry = 0.0


func _process(delta: float) -> void:
	if _ws_slug == "":
		return
	_ws.poll()
	match _ws.get_ready_state():
		WebSocketPeer.STATE_OPEN:
			if not _ws_open:
				_ws_open = true
				connection.emit(true)
			while _ws.get_available_packet_count() > 0:
				var msg: Variant = JSON.parse_string(_ws.get_packet().get_string_from_utf8())
				if msg is Dictionary and msg.get("type", "") == "changed":
					changed.emit(int(msg.get("version", 0)))
		WebSocketPeer.STATE_CLOSED:
			if _ws_open:
				_ws_open = false
				connection.emit(false)
			_retry += delta
			if _retry > 2.0:
				_connect_ws()
