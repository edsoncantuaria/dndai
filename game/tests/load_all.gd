extends Node
## Carrega todo script do projeto: erros de parse viram falha (saída 1).

func _ready() -> void:
	var failed := 0
	for path in _scripts("res://scripts"):
		var s = load(path)
		if s == null or (s is GDScript and not s.can_instantiate()):
			printerr("FALHA ao carregar ", path)
			failed += 1
	print("scripts verificados, falhas: ", failed)
	get_tree().quit(1 if failed > 0 else 0)


func _scripts(dir: String) -> Array:
	var out: Array = []
	for f in DirAccess.get_files_at(dir):
		if f.ends_with(".gd"):
			out.append(dir + "/" + f)
	for d in DirAccess.get_directories_at(dir):
		out.append_array(_scripts(dir + "/" + d))
	return out
