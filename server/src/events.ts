// Barramento de eventos por campanha: o servidor HTTP/WS assina para empurrar mudanças ao cliente.
type Listener = (slug: string) => void
const listeners = new Set<Listener>()
export function onChange(fn: Listener): () => void { listeners.add(fn); return () => listeners.delete(fn) }
export function emit(slug: string): void { for (const l of listeners) l(slug) }
