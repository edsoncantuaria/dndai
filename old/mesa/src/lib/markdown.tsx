import type { ReactNode } from "react"

// Markdown leve da narração do Mestre: parágrafos (linha em branco), quebras de linha, **negrito** e *itálico*/_itálico_.
// Sem HTML cru: o texto vem do ChatGPT e é renderizado só como texto do React.

type Segment = { text: string; bold: boolean; italic: boolean }
type Paragraph = Segment[]

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g

/** Tira as marcas de voz do Mestre (`— {f} fala`, `“{m}fala”`): servem só para o TTS escolher Alex/Dora. */
export function stripVoiceTags(text: string): string {
  return text.replace(/\{[mf]\}\s*/g, "")
}

function parse(text: string): Paragraph[] {
  return stripVoiceTags(text)
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      p.split(INLINE).filter(Boolean).map((part): Segment => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return { text: part.slice(2, -2), bold: true, italic: false }
        if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_")))
          return { text: part.slice(1, -1), bold: false, italic: true }
        return { text: part, bold: false, italic: false }
      }),
    )
}

/** Texto sem marcação (para voz, leitores de tela e contagem da digitação). */
export function plainText(text: string): string {
  return parse(text)
    .map((p) => p.map((s) => s.text).join(""))
    .join("\n\n")
}

/** Renderiza a narração mostrando só os primeiros `limit` caracteres de `plainText` (efeito de digitação). */
export function renderLight(text: string, limit = Infinity, paragraphClass = ""): ReactNode[] {
  let left = limit
  const out: ReactNode[] = []
  parse(text).forEach((para, pi) => {
    if (left <= 0) return
    if (pi > 0) left -= 2 // o "\n\n" entre parágrafos conta na digitação
    const nodes: ReactNode[] = []
    para.forEach((seg, si) => {
      if (left <= 0) return
      const shown = seg.text.slice(0, Math.max(0, left))
      left -= seg.text.length
      const lines = shown.split("\n").flatMap((line, li) => (li ? [<br key={`br${li}`} />, line] : [line]))
      nodes.push(
        seg.bold ? (
          <strong key={si} className="font-semibold text-dnd-gold-bright">
            {lines}
          </strong>
        ) : seg.italic ? (
          <em key={si}>{lines}</em>
        ) : (
          <span key={si}>{lines}</span>
        ),
      )
    })
    out.push(
      <p key={pi} className={paragraphClass}>
        {nodes}
      </p>,
    )
  })
  return out
}
