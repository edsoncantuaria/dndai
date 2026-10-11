// Avisos curtos estilo BG3 ("+12 po", "Item recebido"), exibidos pelo componente Notices.
export type NoticeTone = "gold" | "success" | "ember" | "muted" | "arcane"
export interface Notice {
  id: number
  title: string
  detail?: string
  tone: NoticeTone
}

let nextId = 1
const listeners = new Set<(n: Notice) => void>()

export function notify(title: string, tone: NoticeTone = "gold", detail?: string) {
  const notice = { id: nextId++, title, detail, tone }
  listeners.forEach((fn) => fn(notice))
}

export function onNotice(fn: (n: Notice) => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
