// Skill do Mestre servida pelo conector em partes: o núcleo vai em toda conversa nova; seções que só
// valem em um momento (preparação antes do PC, jogo fora da mesa) vêm sob demanda. SKILL.md continua
// sendo o arquivo único (também instalado inteiro como skill no Shellby).
import { readFileSync } from "node:fs"
import { join } from "node:path"

/** Seções fora do núcleo, pelo início do título `## ...`. */
const ON_DEMAND: Record<string, string> = {
  preparacao: "Preparação",
  chat: "Uma campanha por chat",
}

function sections(): { head: string; parts: { title: string; text: string }[] } {
  const raw = readFileSync(join(import.meta.dirname, "..", "skill", "SKILL.md"), "utf8").replace(/^---\n[\s\S]*?\n---\n+/, "")
  const [head, ...rest] = raw.split(/^(?=## )/m)
  return { head, parts: rest.map((text) => ({ title: text.slice(3, text.indexOf("\n")).trim(), text })) }
}

export function skillText(which?: string): string {
  const { head, parts } = sections()
  if (which === "tudo") return [head, ...parts.map((p) => p.text)].join("").trim()
  if (which) {
    const title = ON_DEMAND[which]
    if (!title) throw new Error(`Seção "${which}" não existe. Use: ${Object.keys(ON_DEMAND).join(", ")} ou tudo.`)
    return parts.find((p) => p.title.startsWith(title))!.text.trim()
  }
  const core = parts.filter((p) => !Object.values(ON_DEMAND).some((t) => p.title.startsWith(t)))
  return [
    head,
    ...core.map((p) => p.text),
    "\n## Seções sob demanda\n\n- `skill preparacao`: antes de existir personagem (turno 0).\n- `skill chat`: jogo direto no chat, fora do Modo mesa.\n",
  ].join("").trim()
}
