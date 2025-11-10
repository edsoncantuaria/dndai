// backend/src/services/questKeywordService.ts
import { EntityManager, In } from 'typeorm';
import { QuestKeyword } from '../entities/QuestKeyword.js';
import { Quest } from '../entities/Quest.js';

type RawKeyword = string | { keyword?: string; name?: string; label?: string; slug?: string; text?: string };

const coerceKeywordArray = (input?: RawKeyword | RawKeyword[]): RawKeyword[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean) as RawKeyword[];
  return [input];
};

const slugifyKeyword = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

const normalizeKeyword = (raw?: RawKeyword | null) => {
  if (!raw) return null;
  const base =
    typeof raw === 'string'
      ? raw
      : raw.keyword ?? raw.name ?? raw.label ?? raw.slug ?? raw.text ?? '';
  if (!base) return null;
  const keyword = base.toString().trim();
  if (!keyword) return null;
  const slug = slugifyKeyword(keyword);
  if (!slug) return null;
  return { keyword, slug };
};

export const extractQuestKeywordStrings = (raw?: RawKeyword[] | null): string[] => {
  if (!raw) return [];
  return raw
    .map(entry => {
      if (!entry) return null;
      if (typeof entry === 'string') return entry;
      return entry.keyword ?? entry.name ?? entry.label ?? entry.slug ?? null;
    })
    .filter((value): value is string => Boolean(value))
    .map(value => value.toString());
};

const ensureQuestKeywordEntities = async (
  manager: EntityManager,
  rawKeywords?: RawKeyword | RawKeyword[]
): Promise<QuestKeyword[]> => {
  const normalizedEntries = coerceKeywordArray(rawKeywords)
    .map(entry => normalizeKeyword(entry))
    .filter((entry): entry is { keyword: string; slug: string } => Boolean(entry));
  if (!normalizedEntries.length) return [];

  const uniqueMap = new Map<string, { keyword: string; slug: string }>();
  normalizedEntries.forEach(entry => {
    if (!uniqueMap.has(entry.slug)) uniqueMap.set(entry.slug, entry);
  });

  const slugList = Array.from(uniqueMap.keys());
  const repo = manager.getRepository(QuestKeyword);
  const existing = await repo.find({ where: { slug: In(slugList) } });
  const bySlug = new Map(existing.map(entry => [entry.slug, entry]));

  const toCreate = slugList
    .filter(slug => !bySlug.has(slug))
    .map(slug => repo.create({ keyword: uniqueMap.get(slug)!.keyword, slug }));

  if (toCreate.length) {
    const saved = await repo.save(toCreate);
    saved.forEach(entry => bySlug.set(entry.slug, entry));
  }

  return slugList
    .map(slug => bySlug.get(slug))
    .filter((entry): entry is QuestKeyword => Boolean(entry));
};

export const syncQuestKeywords = async (
  manager: EntityManager,
  quest: Quest,
  rawKeywords?: RawKeyword | RawKeyword[]
): Promise<QuestKeyword[]> => {
  if (!quest?.id) return [];
  const keywordEntities = await ensureQuestKeywordEntities(manager, rawKeywords);
  const questRepo = manager.getRepository(Quest);
  const relation = questRepo.createQueryBuilder().relation(Quest, 'keywords').of(quest.id);
  const currentEntries = await relation.loadMany<QuestKeyword>();
  const currentIds = new Set(currentEntries.map(entry => entry.id));
  const nextIds = new Set(keywordEntities.map(entry => entry.id));

  const toAdd = keywordEntities.filter(entry => !currentIds.has(entry.id)).map(entry => entry.id);
  const toRemove = currentEntries.filter(entry => !nextIds.has(entry.id)).map(entry => entry.id);

  if (toAdd.length) await relation.add(toAdd);
  if (toRemove.length) await relation.remove(toRemove);

  return keywordEntities;
};
