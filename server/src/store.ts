// Registro de campanhas em disco e instâncias abertas no processo (um processo só serve tudo).
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Campaign, HOME } from "./core/campaign.ts"

const open = new Map<string, Campaign>()

export function campaignsHome(): string { return HOME }

export function listCampaigns(): { slug: string; name: string }[] {
  if (!existsSync(HOME)) return []
  return readdirSync(HOME, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(HOME, e.name, "world.db")))
    .map((e) => ({ slug: e.name, name: campaign(e.name).info().name || e.name }))
}

export function campaignExists(slug: string): boolean {
  try { Campaign.slugOk(slug) } catch { return false }
  return existsSync(join(HOME, slug, "world.db"))
}

export function campaign(slug: string): Campaign {
  let c = open.get(slug)
  if (!c) { c = Campaign.open(slug); open.set(slug, c) }
  return c
}

export function createCampaign(slug: string, init: { name: string; premise?: string; tone?: string }): Campaign {
  const c = Campaign.create(slug, init)
  open.set(slug, c)
  return c
}

export function closeAll(): void { for (const c of open.values()) c.close(); open.clear() }
