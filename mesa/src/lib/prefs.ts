import { useCallback, useState } from "react"

// Preferências por navegador (voz, som). Tudo em try/catch: storage pode estar bloqueado.
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`mesa:${key}`)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function usePref<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback))
  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(`mesa:${key}`, JSON.stringify(next))
      } catch {
        /* sem storage: vale só nesta aba */
      }
    },
    [key],
  )
  return [value, update] as const
}
