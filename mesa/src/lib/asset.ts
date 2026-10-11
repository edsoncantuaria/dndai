// O build usa `base: "./"` (servido pelo `dnd serve --static`). URLs absolutas a partir da página,
// porque o worker do dice-box (URL data:) não resolve caminhos relativos.
export const asset = (path: string) => new URL(import.meta.env.BASE_URL + path, window.location.href).href

/** Só o caminho (sem origem): o dice-box prefixa `location.origin` sozinho. */
export const assetPath = (path: string) => new URL(asset(path)).pathname
