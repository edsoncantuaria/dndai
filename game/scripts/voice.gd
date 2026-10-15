extends Node
## Voz da narração: baixa o MP3 do servidor (Kokoro, 3 vozes) e toca. Um áudio por vez.

signal state_changed(speaking: bool)

var enabled := true
var _player: AudioStreamPlayer
var _serial := 0


func _ready() -> void:
	_player = AudioStreamPlayer.new()
	add_child(_player)
	_player.finished.connect(func(): state_changed.emit(false))


func speak(slug: String, turn: int) -> void:
	stop()
	_serial += 1
	var mine := _serial
	var bytes: PackedByteArray = await Api.get_bytes("/api/c/%s/tts?key=turn-%d" % [slug, turn])
	if mine != _serial or bytes.is_empty():
		return
	var mp3 := AudioStreamMP3.new()
	mp3.data = bytes
	_player.stream = mp3
	_player.play()
	state_changed.emit(true)


func stop() -> void:
	_serial += 1
	if _player and _player.playing:
		_player.stop()
	state_changed.emit(false)


func is_speaking() -> bool:
	return _player != null and _player.playing
