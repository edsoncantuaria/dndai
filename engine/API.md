# Contrato HTTP do motor (`dnd serve`)

> Multiverso: todas as campanhas compartilham o mesmo mundo (atlas). Locais, NPCs e facções de outras crônicas aparecem normalmente em `map`, `present` etc.; NPCs com resumo "aventureiro(a) da crônica X" são heróis de outros jogadores.

Servidor local sem dependências (`node:http`), padrão `http://127.0.0.1:8790`.
Consumido pela mesa visual (`mesa/`). **Tudo que a mesa recebe é visão do jogador: nunca contém segredos do Mestre.**
CORS liberado para `http://localhost:*` e `http://127.0.0.1:*`.

Fluxo: o jogador conversa com o ChatGPT (Mestre, via Shellby). O ChatGPT altera o mundo com a CLI `dnd`.
A mesa mostra o estado, a narração de cada turno e as rolagens pedidas pelo Mestre. O jogador rola os dados 3D na mesa.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/campaigns` | `[{ slug, name, current }]` |
| GET | `/api/state?campaign=<slug>` | `GameView` (abaixo). `campaign` é obrigatório (não há campanha global; cada chat do Mestre é uma campanha), exceto se o servidor rodar com `DND_CAMPAIGN` definido. A mesa deve escolher a campanha em `/api/campaigns` e mantê-la na URL (`?campaign=`). |
| GET | `/api/events?campaign=<slug>` | SSE. Emite `event: change` / `data: {"version": N, "chat": M}` quando o mundo ou a conversa muda. Refaça o GET /api/state. Heartbeat a cada 15s (`: ping`). |
| GET | `/api/tts?campaign=<slug>&key=chat-<id>\|turn-<n>` | Voz da narração (`audio/mpeg` em streaming, frase a frase). `key` é a fala do Mestre no `chat` ou a narração de um turno do `journal`. Gerada pelo serviço local `engine/tts` (Kokoro pt-BR): o narrador usa a voz Santa, e as falas marcadas `{m}`/`{f}` usam Alex/Dora. Para tocar num `<audio>`, mande o token por `?token=`. 404 narração inexistente; 503 TTS desligado. Repetições saem do cache. |
| POST | `/api/rolls/:id?campaign=<slug>` | Body `{ "dice": [12, 7] }`: valores naturais rolados na mesa, um por dado de `RollRequest.dice`. Retorna `RollOutcome`. 409 se já resolvida. 400 se a quantidade ou o intervalo dos dados for inválido. |
| POST | `/api/messages?campaign=<slug>` | Body `{ "text": "..." }`: mensagem do jogador para o Mestre (ChatGPT). O servidor entrega via MCP `dndai-mestre` → Shellby. Retorna 202 `{ id }`. 503 se o Mestre estiver offline. A resposta chega depois em `chat` (acompanhe pelo SSE). |
| POST | `/api/actions?campaign=<slug>` | Body `{ "action": "usar"\|"equipar"\|"guardar"\|"empunhar"\|"embainhar"\|"largar", "item": "<id>" }`. O motor aplica a regra numa transação (poção rola a cura e consome; armadura/escudo recalculam a CA; empunhar provoca reações em cena) e, com o Mestre conectado, avisa-o para narrar. 200 `{ text }`; 400 ação/body inválido; 404 item que o PC não tem; 409 ação impossível agora (ex.: inconsciente). Use só as ações listadas em `ItemView.actions`. |
| POST | `/api/intents?campaign=<slug>` | Body `{ "text": "..." }`: intenção do jogador digitada na mesa. Aparece no `dnd context` do Mestre. Retorna `{ id }`. |

Erros: `{ "error": "mensagem PT-BR" }` com status 4xx/5xx (404 campanha inexistente, 401 token).

Autenticação: se o servidor tiver token (`--token`/`DNDAI_TOKEN`, obrigatório fora do loopback), envie `Authorization: Bearer <token>` ou `?token=<token>` (o SSE via `EventSource` precisa do query param). A mesa lê o token de `?token=` na própria URL e o guarda em `sessionStorage`.

Implantação: `dnd serve --static ../mesa/dist` serve a mesa e a API na mesma origem (sem CORS).

## Tipos (TypeScript)

```ts
type Ability = "for" | "des" | "con" | "int" | "sab" | "car"

interface GameView {
  version: number                      // contador monotônico de mudanças
  campaign: { slug: string; name: string; premise: string; tone: string }
  clock: { day: number; time: string; period: "madrugada" | "manhã" | "tarde" | "noite"; minutes: number }   // minutos desde o dia 1, 00:00
  turn: { n: number; open: boolean; action: string | null }
  pc: PcView | null
  location: LocationView | null
  present: NpcView[]                   // NPCs não mortos no local do PC (companheiros primeiro)
  combat: CombatView | null
  quests: QuestView[]
  facts: { id: number; text: string; about: string | null; day: number }[]   // só fatos conhecidos pelo jogador
  journal: TurnView[]                  // últimos 50 turnos, do mais antigo ao mais novo
  map: { places: MapPlace[]; links: { from: string; to: string; minutes: number; via: string }[] }
  pendingRolls: RollRequest[]
  lastRolls: RollOutcome[]             // últimas 10 rolagens resolvidas
  intents: { id: number; text: string; status: "pendente" | "lida" }[]
  chat: ChatMessage[]                  // conversa jogador ⇄ Mestre (últimas 100), a fonte da narração na tela
  master: { status: "ocioso" | "na_fila" | "pensando" | "erro"; activity: string | null; error: string | null }
}

interface ChatMessage {
  id: number
  role: "jogador" | "sistema" | "mestre"   // sistema = aviso automático da mesa (ex.: rolagem resolvida)
  text: string                              // em "mestre": a narração (markdown leve)
  status: "fila" | "enviando" | "aguardando" | "entregue" | "erro"
  error: string
  at: string                                // ISO
}

interface PcView {
  id: string; name: string; race: string; class: string; classLabel: string; subclass: string; background: string
  level: number; xp: number; nextLevelXp: number | null; levelUpReady: boolean
  hp: number; maxHp: number; tempHp: number; ac: number; speed: number; initiative: number; profBonus: number
  status: "vivo" | "inconsciente" | "morto" | "desaparecido"
  abilities: Record<Ability, { score: number; mod: number; save: number; proficientSave: boolean }>
  skills: { key: string; label: string; ability: Ability; bonus: number; proficient: boolean; expertise: boolean }[]
  passivePerception: number
  conditions: string[]
  death: { success: number; fail: number }
  hitDice: { die: number; max: number; used: number }
  spellcasting: null | { ability: Ability; abilityLabel: string; saveDc: number; attackBonus: number; slots: { level: number; max: number; used: number }[]; spells: string[] }
  money: { po: number; pp: number; pc: number }   // ouro, prata, cobre
  inventory: ItemView[]
  features: string[]
  portrait: string | null              // URL/caminho opcional
}

interface ItemView {
  id: string; name: string; qty: number; kind: string; equipped: boolean; notes: string; props: Record<string, unknown>
  actions: ("usar" | "equipar" | "guardar" | "empunhar" | "embainhar" | "largar")[]   // válidas agora (vazio no chão ou se o PC não pode agir)
  drawn: boolean                       // arma em punho (visível a todos em cena)
  effect: string | null                // ex.: "Cura 2d4+2 PV", "Dano 1d8 cortante", "CA 12 + Des", "CA +2"
}

interface LocationView {
  id: string; name: string; kind: string; summary: string; details: string
  parent: { id: string; name: string } | null
  exits: { id: string; name: string; minutes: number; via: string }[]
  items: ItemView[]
}

interface NpcView {
  id: string; name: string; summary: string; status: string
  attitude: number; attitudeLabel: "hostil" | "desconfiado" | "neutro" | "amigável" | "leal"
  companion: boolean
  hp?: number; maxHp?: number          // só em combate ou para companheiros
  portrait: string | null
  reaction: string | null              // reação do momento (ex.: "com medo da sua arma"); some ao embainhar ou sair do local
}

interface CombatView {
  round: number
  order: { id: string; name: string; initiative: number; hp: number; maxHp: number; status: string; current: boolean; isPc: boolean }[]
}

interface QuestView { id: string; title: string; summary: string; status: "ativa" | "concluida" | "falhou" | "abandonada"; giver: string | null; objectives: { text: string; done: boolean }[] }

interface TurnView { n: number; day: number; time: string; action: string; summary: string; narration: string }

interface MapPlace { id: string; name: string; kind: string; parent: string | null; visited: boolean; current: boolean }

interface RollRequest {
  id: number
  who: string; whoName: string
  kind: "pericia" | "atributo" | "resistencia" | "ataque" | "dano" | "livre"
  label: string                        // ex.: "Percepção (Sab)", "Ataque com Espada Longa"
  dice: { sides: number }[]            // dados a rolar na mesa, ex.: [{sides:20},{sides:20}] com vantagem
  mode: "normal" | "vantagem" | "desvantagem"
  modifier: number                     // somado pelo motor
  dc: number | null                    // CD do teste; null em ataques (a CA do alvo fica oculta até o resultado)
  reason: string                       // texto curto do Mestre
  createdTurn: number
}

interface RollOutcome {
  id: number; label: string; whoName: string
  dice: number[]; kept: number[]; modifier: number; total: number
  dc: number | null
  outcome: "sucesso" | "falha" | "critico" | "falha_critica" | null   // null em dano/livre
  source: "mesa" | "motor" | "manual"
  at: string                           // ISO
}
```

## Conversa com o Mestre (modo principal de jogo)

- O jogador digita na mesa → `POST /api/messages`. O estado `master.status` vira `na_fila`/`pensando` (mostre "O Mestre está narrando…", com `activity` se houver) e a resposta aparece como `chat[role=mestre]`.
- Ao resolver uma rolagem pela mesa, o servidor avisa o Mestre sozinho (mensagem `sistema`), e ele continua a cena.
- `master.status = "erro"`: mostre `master.error` e permita reenviar.

## Regras da rolagem na mesa

- **Rolagem não fica para depois.** Enquanto houver `pendingRolls`, `POST /api/messages` e `POST /api/actions` respondem 409 ("Role os dados primeiro…") e o motor não abre turno novo. O app deve manter o modal de dados aberto, sem opção de adiar, até o jogador rolar. Só o Mestre pode cancelar (`roll-cancel`).

- A mesa rola exatamente `dice` (dados físicos 3D) e envia os valores naturais, na mesma ordem de `dice`.
- Teste contra a morte vem como `kind: "resistencia"`, label "Teste contra a morte", `dice: [d20]`, `modifier: 0`, `dc: 10`. Com 20 natural o herói volta com 1 PV.
- Em ataques, `dice` traz o(s) d20 primeiro e depois os dados de dano (ex.: `[d20, d8]`); o motor só aplica o dano se acertar e rola sozinho os dados extras de crítico.
- O motor aplica o modificador, vantagem/desvantagem (mantém maior/menor d20), compara com a CD e grava o resultado.
- O Mestre lê o resultado no próximo `dnd context` e narra a partir dele. O Mestre também pode resolver sozinho (`source: "motor"`) se o jogador pedir.
