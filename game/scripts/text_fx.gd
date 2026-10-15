class_name TextFx
extends RefCounted
## Tratamento do texto da narração: marcas de voz, markdown leve → BBCode.

static var _voice := RegEx.create_from_string("\\{[mf]\\}\\s*")
static var _bold := RegEx.create_from_string("\\*\\*(.+?)\\*\\*")
static var _ital := RegEx.create_from_string("(?<![\\*\\w])\\*(?!\\s)(.+?)(?<!\\s)\\*(?![\\*\\w])")


## Remove as marcas {m}/{f} (só servem à voz).
static func strip_voice(t: String) -> String:
	return _voice.sub(t, "", true)


static func escape_bb(t: String) -> String:
	return t.replace("[", "[lb]")


## Narração → BBCode (negrito, itálico, falas com travessão em destaque suave).
static func to_bbcode(t: String) -> String:
	var s := escape_bb(strip_voice(t)).strip_edges()
	s = _bold.sub(s, "[b]$1[/b]", true)
	s = _ital.sub(s, "[i]$1[/i]", true)
	var lines := s.split("\n")
	var out: PackedStringArray = []
	for l in lines:
		var tl := l.strip_edges()
		if tl.begins_with("—") or tl.begins_with("–") or tl.begins_with("“") or tl.begins_with("«"):
			out.append("[color=#f0d9a0]%s[/color]" % l)
		else:
			out.append(l)
	return "\n".join(out)
