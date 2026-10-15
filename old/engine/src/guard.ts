// Tetos de regra para o que o Mestre pede em lote. A ficha já carrega o bônus
// de atributo, perícia e arma; aqui só entra o extra da cena, com limite.
import { type DB, metaNum, setMeta } from "./db.ts"
import { XP_THRESHOLDS } from "./rules.ts"
import { fmtMoney, getCharacter } from "./world.ts"

export const BONUS_LIMIT = 10
const MONEY_SOFT_CP = 500 * 100
const MONEY_HARD_CP = 5000 * 100
const XP_SOFT = 1000
const FLAT_DAMAGE_CAP = 300

export function assertBonus(bonus: number): void {
  if (!Number.isInteger(bonus) || Math.abs(bonus) > BONUS_LIMIT) {
    throw new Error(`Bônus circunstancial ${bonus} fora do limite ±${BONUS_LIMIT}. Atributo, perícia e arma já entram pela ficha; --bonus é só o extra da cena (cobertura, ajuda, inspiração).`)
  }
}

export function assertFlatDamage(amount: number): void {
  if (amount > FLAT_DAMAGE_CAP) {
    throw new Error(`Dano fixo de ${amount} excede o teto de ${FLAT_DAMAGE_CAP} por aplicação. Dano de ataque ou magia entra por attack/damage, com os dados do motor.`)
  }
}

export function assertHeal(amount: number, maxHp: number, name: string, reason: string | undefined, source: string | undefined): void {
  if (!source) throw new Error("Cura exige source: pocao, magia, descanso, habilidade, item ou outro.")
  if (!reason || reason.trim().length < 8) throw new Error("Cura exige reason (mín. 8 caracteres) dizendo a fonte na ficção.")
  if (amount > maxHp) throw new Error(`Cura de ${amount} excede os PV máximos de ${name} (${maxHp}).`)
}

export function assertTemp(amount: number, maxHp: number, name: string, reason: string | undefined): void {
  if (amount > maxHp) throw new Error(`PV temporários (${amount}) não podem passar dos PV máximos de ${name} (${maxHp}).`)
  if (amount > 0 && (!reason || reason.trim().length < 8)) throw new Error("PV temporários exigem reason (mín. 8 caracteres).")
}

export function noteMoneyGain(db: DB, turn: number, delta: number, confirm: boolean, reason: string): void {
  if (delta <= 0) return
  const key = `econ_money_${turn}`
  const next = metaNum(db, key) + delta
  if (next > MONEY_HARD_CP) {
    throw new Error(`Dinheiro acima do teto de ${fmtMoney(MONEY_HARD_CP)} por turno (este turno ficaria em ${fmtMoney(next)}).`)
  }
  if (next > MONEY_SOFT_CP) {
    if (!confirm) throw new Error(`Ganho de ${fmtMoney(delta)} passa de ${fmtMoney(MONEY_SOFT_CP)} neste turno. Repita com "confirm": true e reason explicando a fonte (tesouro, recompensa).`)
    if (reason.trim().length < 12) throw new Error("Confirmação de dinheiro exige reason (mín. 12 caracteres) com a fonte.")
  }
  setMeta(db, key, next)
}

export function noteXpGain(db: DB, id: string, amount: number, confirm: boolean, reason: string): void {
  const c = getCharacter(db, id)
  if (c.level >= 20) throw new Error(`${c.name} já está no nível máximo.`)
  const room = XP_THRESHOLDS[c.level] - c.xp
  if (room <= 0) throw new Error(`${c.name} já tem XP para subir de nível. Use levelup antes de conceder mais.`)
  if (amount > room) {
    throw new Error(`XP ${amount} faria ${c.name} pular nível (cabem ${room} até o próximo). Suba com levelup e só então conceda o resto.`)
  }
  if (amount > XP_SOFT) {
    if (!confirm) throw new Error(`Mais de ${XP_SOFT} XP num turno exige "confirm": true e reason.`)
    if (reason.trim().length < 12) throw new Error("Confirmação de XP exige reason (mín. 12 caracteres).")
  }
  const key = `econ_xp_${metaNum(db, "turn")}_${id}`
  const next = metaNum(db, key) + amount
  if (next > room) throw new Error(`Este turno já concedeu XP a ${c.name}; o teto até o próximo nível é ${room} (pedido deixaria ${next}).`)
  setMeta(db, key, next)
}
