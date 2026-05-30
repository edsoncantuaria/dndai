import { randomUUID } from 'crypto';
import { PenaiDataSource } from '../data-source.js';
import { CanonicalRegion } from '../entities/CanonicalRegion.js';
import { CanonicalPoi } from '../entities/CanonicalPoi.js';
import { CanonicalRegionLink } from '../entities/CanonicalRegionLink.js';
import { TravelModeCatalog } from '../entities/TravelModeCatalog.js';

export async function seedPenaiWorld(): Promise<void> {
    const regionRepo = PenaiDataSource.getRepository(CanonicalRegion);
    const poiRepo = PenaiDataSource.getRepository(CanonicalPoi);
    const linkRepo = PenaiDataSource.getRepository(CanonicalRegionLink);
    const modeRepo = PenaiDataSource.getRepository(TravelModeCatalog);

    const existing = await regionRepo.count();
    if (existing > 0) {
        if ((await modeRepo.count()) === 0) {
            await seedTravelModes(modeRepo);
        }
        const cidadela = await regionRepo.findOne({ where: { slug: 'cidadela-do-acoluz' } });
        const vales = await regionRepo.findOne({ where: { slug: 'vales-do-norte' } });
        if (cidadela && vales && (await linkRepo.count()) === 0) {
            await linkRepo.save(
                linkRepo.create({
                    id: randomUUID(),
                    fromRegionId: cidadela.id,
                    toRegionId: vales.id,
                    distanceKm: 200,
                    baseDurationHours: 48,
                    biome: 'colinas',
                    terrainModifier: 1,
                    isLocked: false,
                    locale: 'pt-BR',
                }),
            );
        }
        return;
    }

    const cidadelaId = randomUUID();
    const valesId = randomUUID();

    await regionRepo.save([
        regionRepo.create({
            id: cidadelaId,
            slug: 'cidadela-do-acoluz',
            displayName: 'Cidadela do Aço-Luz',
            summary: 'Fortaleza murada onde mercadores e guardas disputam o comércio do norte.',
            locale: 'pt-BR',
        }),
        regionRepo.create({
            id: valesId,
            slug: 'vales-do-norte',
            displayName: 'Vales do Norte',
            summary: 'Colinas enevoadas e vilarejos isolados; rotas antigas ligam ao sul.',
            locale: 'pt-BR',
        }),
    ]);

    await poiRepo.save([
        poiRepo.create({
            id: randomUUID(),
            regionId: cidadelaId,
            slug: 'ponte-sul',
            displayName: 'Ponte Sul',
            poiType: 'landmark',
            maxImportantNpcs: 5,
            description: 'Passagem vigiada sobre o rio; rumores de bandidos.',
            locale: 'pt-BR',
        }),
        poiRepo.create({
            id: randomUUID(),
            regionId: cidadelaId,
            slug: 'taverna-lua-rubra',
            displayName: 'Taverna Lua Rubra',
            poiType: 'shop',
            maxImportantNpcs: 5,
            description: 'Ponto de encontro de aventureiros; música baixa e cerveja escura.',
            locale: 'pt-BR',
        }),
        poiRepo.create({
            id: randomUUID(),
            regionId: valesId,
            slug: 'posto-muralha',
            displayName: 'Posto da Muralha',
            poiType: 'landmark',
            maxImportantNpcs: 4,
            description: 'Entrada norte vigiada; vento gelado e tochas tremeluzentes.',
            locale: 'pt-BR',
        }),
    ]);

    await linkRepo.save(
        linkRepo.create({
            id: randomUUID(),
            fromRegionId: cidadelaId,
            toRegionId: valesId,
            distanceKm: 200,
            baseDurationHours: 48,
            biome: 'colinas',
            terrainModifier: 1,
            isLocked: false,
            locale: 'pt-BR',
        }),
    );

    await seedTravelModes(modeRepo);

    console.log('[PENAI] Seed mapa canônico PT-BR + rotas de viagem aplicado.');
}

async function seedTravelModes(modeRepo: ReturnType<typeof PenaiDataSource.getRepository<TravelModeCatalog>>) {
    const modes = [
        { slug: 'walk', displayName: 'A pé', speedMultiplier: 1 },
        { slug: 'horse', displayName: 'Cavalo', speedMultiplier: 2 },
        { slug: 'wagon', displayName: 'Carroça', speedMultiplier: 1.5 },
        { slug: 'dragon', displayName: 'Dragão', speedMultiplier: 8 },
    ];
    for (const m of modes) {
        const exists = await modeRepo.findOne({ where: { slug: m.slug } });
        if (!exists) {
            await modeRepo.save(modeRepo.create({ ...m, locale: 'pt-BR' }));
        }
    }
}
