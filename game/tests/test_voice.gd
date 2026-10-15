extends Node
## Voz: o servidor entrega MP3 e o Godot o decodifica (usa DNDAI_URL e a campanha DNDAI_SLUG).

func _ready() -> void:
	var slug := OS.get_environment("DNDAI_SLUG")
	var bytes: PackedByteArray = await Api.get_bytes("/api/c/%s/tts?key=turn-1" % slug)
	var ok := bytes.size() > 1000
	var mp3 := AudioStreamMP3.new()
	mp3.data = bytes
	var secs := mp3.get_length()
	print("mp3: %d bytes, %.1f s" % [bytes.size(), secs])
	get_tree().quit(0 if ok and secs > 1.0 else 1)
