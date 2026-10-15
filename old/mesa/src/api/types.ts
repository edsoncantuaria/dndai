// Espelho literal dos tipos de engine/API.md (contrato do `dnd serve`).
// Ao mudar o contrato, atualize este arquivo para ficar idêntico ao API.md.

export type Ability = "for" | "des" | "con" | "int" | "sab" | "car"

export interface CampaignSummary {
  slug: string
  name: string
  current: boolean
}

export interface GameView {
  version: number
  campaign: { slug: string; name: string; premise: string; tone: string }
  clock: { day: number; time: string; period: "madrugada" | "manhã" | "tarde" | "noite"; minutes: number }
  turn: { n: number; open: boolean; action: string | null }
  pc: PcView | null
  location: LocationView | null
  present: NpcView[]
  combat: CombatView | null
  quests: QuestView[]
  facts: { id: number; text: string; about: string | null; day: number }[]
  journal: TurnView[]
  map: { places: MapPlace[]; links: { from: string; to: string; minutes: number; via: string }[] }
  pendingRolls: RollRequest[]
  lastRolls: RollOutcome[]
  intents: { id: number; text: string; status: "pendente" | "lida" }[]
  /** Conversa jogador ⇄ Mestre (últimas 100): a fonte da narração na tela. */
  chat: ChatMessage[]
  master: { status: "ocioso" | "na_fila" | "pensando" | "erro"; activity: string | null; error: string | null }
}

export interface ChatMessage {
  id: number
  /** sistema = aviso automático da mesa (ex.: rolagem resolvida). */
  role: "jogador" | "sistema" | "mestre"
  /** Em "mestre": a narração (markdown leve). */
  text: string
  status: "fila" | "enviando" | "aguardando" | "entregue" | "erro"
  error: string
  at: string
}

export interface PcView {
  id: string
  name: string
  race: string
  class: string
  classLabel: string
  subclass: string
  background: string
  level: number
  xp: number
  nextLevelXp: number | null
  levelUpReady: boolean
  hp: number
  maxHp: number
  tempHp: number
  ac: number
  speed: number
  initiative: number
  profBonus: number
  status: "vivo" | "inconsciente" | "morto" | "desaparecido"
  abilities: Record<Ability, { score: number; mod: number; save: number; proficientSave: boolean }>
  skills: { key: string; label: string; ability: Ability; bonus: number; proficient: boolean; expertise: boolean }[]
  passivePerception: number
  conditions: string[]
  death: { success: number; fail: number }
  hitDice: { die: number; max: number; used: number }
  spellcasting: null | {
    ability: Ability
    abilityLabel: string
    saveDc: number
    attackBonus: number
    slots: { level: number; max: number; used: number }[]
    spells: string[]
  }
  money: { po: number; pp: number; pc: number }
  inventory: ItemView[]
  features: string[]
  featureDetails: { id: string; name: string; description: string; source: "race" | "class" | "subclass" | "feat" }[]
  resources: { id: string; name: string; max: number; used: number; resets_on: "short" | "long"; effect: string; unlimited?: boolean; available: boolean }[]
  pendingChoices: { id: string; name: string; choose: number; options: { id: string; name: string }[] }[]
  portrait: string | null
}

export type ItemAction = "usar" | "equipar" | "guardar" | "empunhar" | "embainhar" | "largar"

export interface ItemView {
  id: string
  name: string
  qty: number
  kind: string
  equipped: boolean
  notes: string
  props: Record<string, unknown>
  /** Ações válidas agora (o motor decide; a mesa só desenha os botões). */
  actions: ItemAction[]
  /** Arma em punho, visível para todos. */
  drawn: boolean
  /** Resumo do efeito, ex.: "Cura 2d4+2 PV", "CA +2". */
  effect: string | null
}

export interface LocationView {
  id: string
  name: string
  kind: string
  summary: string
  details: string
  parent: { id: string; name: string } | null
  exits: { id: string; name: string; minutes: number; via: string }[]
  items: ItemView[]
}

export interface NpcView {
  id: string
  name: string
  summary: string
  status: string
  attitude: number
  attitudeLabel: "hostil" | "desconfiado" | "neutro" | "amigável" | "leal"
  companion: boolean
  hp?: number
  maxHp?: number
  portrait: string | null
  /** Reação momentânea visível, ex.: "com medo da sua arma". */
  reaction: string | null
}

export interface CombatView {
  round: number
  order: {
    id: string
    name: string
    initiative: number
    hp: number
    maxHp: number
    status: string
    current: boolean
    isPc: boolean
  }[]
}

export interface QuestView {
  id: string
  title: string
  summary: string
  status: "ativa" | "concluida" | "falhou" | "abandonada"
  giver: string | null
  objectives: { text: string; done: boolean }[]
}

export interface TurnView {
  n: number
  day: number
  time: string
  action: string
  summary: string
  narration: string
}

export interface MapPlace {
  id: string
  name: string
  kind: string
  parent: string | null
  visited: boolean
  current: boolean
}

export interface RollRequest {
  id: number
  who: string
  whoName: string
  kind: "pericia" | "atributo" | "resistencia" | "ataque" | "dano" | "livre"
  label: string
  /** Em ataques: o(s) d20 primeiro, depois os dados de dano. A mesa envia os valores nesta ordem. */
  dice: { sides: number }[]
  mode: "normal" | "vantagem" | "desvantagem"
  modifier: number
  /** CD do teste; null em ataques (a CA do alvo fica oculta até o resultado). */
  dc: number | null
  reason: string
  createdTurn: number
}

export interface RollOutcome {
  id: number
  label: string
  whoName: string
  dice: number[]
  kept: number[]
  modifier: number
  total: number
  dc: number | null
  outcome: "sucesso" | "falha" | "critico" | "falha_critica" | null
  source: "mesa" | "motor" | "manual"
  at: string
}

/** Corpo de erro padrão do servidor. */
export interface ApiErrorBody {
  error: string
}
