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
import { TRANSLATIONS_BASE } from '../../data/TranslatorPTBR.js';
import bcrypt from 'bcryptjs';

const SYSTEM_USER_ID = 1;

async function upsertHomebrew(authorId: number, type: any, name: string, content: any, isPublic: boolean = true): Promise<HomebrewContent> {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const index = content.index || name.toLowerCase().replace(/\s+/g, '-');
    
    // Para traduções, o 'name' é a categoria, que deve ser único por autor/tipo
    const whereCondition: any = type === 'translation' ? { type, name, authorId } : { type, name };

    let existing = await homebrewRepo.findOne({ where: whereCondition });

    if (existing) {
        console.log(`Atualizando '${name}' do tipo '${type}'...`);
        existing.content = content;
        existing.isPublic = isPublic;
        return await homebrewRepo.save(existing);
    } else {
        console.log(`Criando '${name}' do tipo '${type}'...`);
        const newContent = new HomebrewContent();
        newContent.authorId = authorId;
        newContent.type = type;
        newContent.name = name;
        newContent.content = type === 'translation' ? content : { ...content, index: index };
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
    const migratedBaseTranslations: HomebrewContent[] = [];

    console.log('\n--- Migrando Traduções de Magias ---');
    for (const [englishName, translation] of Object.entries(TRANSLATIONS_SPELLS)) {
        const spell = await upsertHomebrew(SYSTEM_USER_ID, 'spell', englishName, {
            ...translation,
            official_index: englishName.toLowerCase().replace(/\s+/g, '-'),
        });
        migratedSpells.push(spell);
    }

    console.log('\n--- Migrando Traduções de Equipamentos ---');
    for (const [englishIndex, translation] of Object.entries(TRANSLATIONS_EQUIPMENT)) {
        const item = await upsertHomebrew(SYSTEM_USER_ID, 'item', englishIndex, {
            ...translation,
            official_index: englishIndex,
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
    
    console.log('\n--- Migrando Traduções Essenciais do Sistema ---');
    for (const [category, translations] of Object.entries(TRANSLATIONS_BASE)) {
        const translationContent = await upsertHomebrew(SYSTEM_USER_ID, 'translation', category, translations);
        migratedBaseTranslations.push(translationContent);
    }

    await createOrUpdateBundle(
        "Traduções Essenciais PT-BR",
        "Contém as traduções base para termos do sistema como atributos, classes, raças, perícias e condições.",
        migratedBaseTranslations
    );

    console.log('\nMigração de dados concluída com sucesso!');
    await AppDataSource.destroy();
}

migrate().catch(error => {
    console.error('Falha na migração:', error);
    process.exit(1);
});
