// backend/src/scripts/migrate-data.ts
import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { HomebrewBundle } from '../entities/HomebrewBundle.js';
import { TRANSLATIONS_SPELLS } from '../../data/TranslatorSpells.js';
import { TRANSLATIONS_EQUIPMENT } from '../../data/TranslatorEquipments.js';
import backgroundsData from '../../data/backgrounds.json' assert { type: 'json' };
import bcrypt from 'bcryptjs';
import { TRANSLATIONS } from '../../data/TraslatorPTBR.js';
import * as DndApiService from '../services/dndApiService.js';

const SYSTEM_USER_ID = 1;

async function upsertHomebrew(authorId: number, type: any, name: string, content: any, isPublic: boolean = true): Promise<HomebrewContent> {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const index = content.index || name.toLowerCase().replace(/\s+/g, '-');
    
    let existing = await homebrewRepo.findOne({ where: { type, name: content.name } });

    if (existing) {
        console.log(`Atualizando '${content.name}'...`);
        existing.content = content;
        existing.isPublic = isPublic;
        return await homebrewRepo.save(existing);
    } else {
        console.log(`Criando '${content.name}'...`);
        const newContent = new HomebrewContent();
        newContent.authorId = authorId;
        newContent.type = type;
        newContent.name = content.name;
        newContent.content = { ...content, index: index };
        newContent.isPublic = isPublic;
        newContent.createdBy = 'user';
        return await homebrewRepo.save(newContent);
    }
}

async function createOrUpdateBundle(name: string, description: string, contents: HomebrewContent[]) {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    let bundle = await bundleRepo.findOne({ where: { name, authorId: SYSTEM_USER_ID } });

    if (!bundle) {
        bundle = new HomebrewBundle();
        bundle.name = name;
        bundle.authorId = SYSTEM_USER_ID;
        bundle.isPublic = true;
    }
    
    bundle.description = description;
    bundle.contents = contents;

    await bundleRepo.save(bundle);
    console.log(`Pacote '${name}' salvo com ${contents.length} itens.`);
}


async function migrate() {
    console.log('Iniciando conexão com o banco de dados...');
    await AppDataSource.initialize();
    console.log('Conexão estabelecida.');

    const userRepo = AppDataSource.getRepository(User);
    
    let systemUser = await userRepo.findOneBy({ id: SYSTEM_USER_ID });
    if (!systemUser) {
        console.log('Usuário do sistema não encontrado. Criando um novo...');
        systemUser = new User();
        systemUser.id = SYSTEM_USER_ID;
        systemUser.username = 'Sistema';
        systemUser.email = 'system@cronicasdeaventuras.com';
        systemUser.password = await bcrypt.hash('uma_senha_muito_segura', 12);
        systemUser.settings = {};
        await userRepo.save(systemUser);
        console.log('Usuário do sistema criado com ID:', systemUser.id);
    }

    const migratedSpells: HomebrewContent[] = [];
    const migratedEquipments: HomebrewContent[] = [];
    const migratedBackgrounds: HomebrewContent[] = [];
    const migratedBase: HomebrewContent[] = [];

    console.log('\n--- Migrando Traduções de Magias ---');
    for (const [englishName, translation] of Object.entries(TRANSLATIONS_SPELLS)) {
        const spell = await upsertHomebrew(SYSTEM_USER_ID, 'spell', englishName, {
            ...translation,
            name: translation.name,
            index: englishName.toLowerCase().replace(/\s+/g, '-'),
        });
        migratedSpells.push(spell);
    }

    console.log('\n--- Migrando Traduções de Equipamentos ---');
    for (const [englishIndex, translation] of Object.entries(TRANSLATIONS_EQUIPMENT)) {
        const item = await upsertHomebrew(SYSTEM_USER_ID, 'item', englishIndex, {
            ...translation,
            name: translation.name,
            index: englishIndex,
        });
        migratedEquipments.push(item);
    }
    
    await createOrUpdateBundle(
        "Traduções PT-BR (Itens e Magias)",
        "Um pacote essencial que traduz a maioria dos itens e magias do SRD para o português do Brasil. Recomendado para todas as aventuras.",
        [...migratedSpells, ...migratedEquipments]
    );

    console.log('\n--- Migrando Antecedentes Traduzidos ---');
    for (const background of backgroundsData.results) {
        const bg = await upsertHomebrew(SYSTEM_USER_ID, 'background', background.index, background);
        migratedBackgrounds.push(bg);
    }
    
    await createOrUpdateBundle(
        "Antecedentes (SRD Traduzido)",
        "Contém todos os antecedentes disponíveis no Documento de Referência do Sistema (SRD), traduzidos para o português.",
        migratedBackgrounds
    );

    console.log('\n--- Migrando Traduções Base (Raças, Classes) ---');
    const resourcesToTranslate: { resource: 'races'|'classes', type: 'race'|'class' }[] = [
        { resource: 'races', type: 'race' },
        { resource: 'classes', type: 'class' },
    ];

    for (const { resource, type } of resourcesToTranslate) {
        console.log(`Buscando ${resource}...`);
        const list = await DndApiService.getResourceList(resource);
        if (list?.results) {
            for (const item of list.results) {
                const details = await DndApiService.getDetails(resource, item.index);
                const translatedName = TRANSLATIONS[details.name];
                if (translatedName) {
                    const translatedContent = {
                        ...details,
                        name: translatedName,
                    };
                    const hbContent = await upsertHomebrew(SYSTEM_USER_ID, type, item.index, translatedContent, true);
                    migratedBase.push(hbContent);
                }
            }
        }
    }
    
    await createOrUpdateBundle(
        "Traduções Essenciais PT-BR (Raças e Classes)",
        "Traduções básicas para raças e classes do SRD para o português do Brasil.",
        migratedBase
    );


    console.log('\nMigração de dados concluída com sucesso!');
    await AppDataSource.destroy();
}

migrate().catch(error => {
    console.error('Falha na migração:', error);
    process.exit(1);
});
