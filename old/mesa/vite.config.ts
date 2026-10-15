import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  // Caminhos relativos: o build é servido pelo `dnd serve --static ../mesa/dist`.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { port: 5180 },
  // Os chunks grandes são o motor físico do @3d-dice/dice-box, carregado sob demanda na primeira rolagem.
  build: { chunkSizeWarningLimit: 1600 },
})
