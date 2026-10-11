import { useEffect, useState } from "react"
import { config, ttsUrl } from "../api/client"

// Voz da narração gerada no servidor (`dnd serve` → GET /api/tts → Kokoro pt-BR), tocada em streaming.
// Um único <audio> para a mesa inteira: uma narração nova corta a anterior.
export const voiceAvailable = !config.mock

export type VoiceStatus = "parado" | "carregando" | "falando" | "erro"

const audio = typeof Audio !== "undefined" ? new Audio() : null
let status: VoiceStatus = "parado"
const listeners = new Set<(s: VoiceStatus) => void>()

function set(next: VoiceStatus) {
  status = next
  listeners.forEach((l) => l(next))
}

if (audio) {
  audio.preload = "auto"
  audio.addEventListener("playing", () => set("falando"))
  audio.addEventListener("waiting", () => set("carregando"))
  audio.addEventListener("ended", () => set("parado"))
  audio.addEventListener("error", () => {
    if (audio.getAttribute("src")) set("erro")
  })
}

export function speak(key: string) {
  if (!audio || !voiceAvailable) return
  audio.src = ttsUrl(key)
  set("carregando")
  // Autoplay bloqueado (página sem interação ainda): volta ao botão "Ouvir".
  audio.play().catch((error: DOMException) => {
    if (error.name !== "AbortError") set(error.name === "NotAllowedError" ? "parado" : "erro")
  })
}

export function stopSpeaking() {
  if (!audio) return
  audio.pause()
  audio.removeAttribute("src") // fecha a conexão: o servidor cancela a síntese
  audio.load()
  set("parado")
}

export function useVoiceStatus(): VoiceStatus {
  const [value, setValue] = useState(status)
  useEffect(() => {
    listeners.add(setValue)
    return () => void listeners.delete(setValue)
  }, [])
  return value
}
