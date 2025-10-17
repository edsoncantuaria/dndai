// backend/src/scripts/migrate-data.ts
import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { TRANSLATIONS_SPELLS } from '../../data/TranslatorSpells.js';
import { TRANSLATIONS_EQUIPMENT } from '../../data/TranslatorEquipments.js';
import backgroundsData from '../../data/backgrounds.json' assert { type: 'json' };
import bcrypt from 'bcryptjs';

const SYSTEM_USER_ID = 1;

async function upsertHomebrew(authorId: number, type: any, name: string, content: any) {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);

    // Usa o 'index' do conteúdo (que é o nome oficial em inglês) como chave
    const index = content.index || name.toLowerCase().replace(/\s+/g, '-');
    
    let existing = await homebrewRepo.findOne({
        where: {
            authorId,
            type,
            content: { index: index }
        }
    });

    if (existing) {
        console.log(`Atualizando '${name}'...`);
        existing.content = content;
        existing.name = content.name;
        existing.isPublic = true;
        await homebrewRepo.save(existing);
    } else {
        console.log(`Criando '${name}'...`);
        const newContent = new HomebrewContent();
        newContent.authorId = authorId;
        newContent.type = type;
        newContent.name = content.name; // Usa o nome traduzido
        newContent.content = { ...content, index: index }; // Garante que o index original seja salvo
        newContent.isPublic = true;
        newContent.createdBy = 'user'; // Considera como criado pelo 'sistema'
        await homebrewRepo.save(newContent);
    }
}

async function migrate() {
    console.log('Iniciando conexão com o banco de dados...');
    await AppDataSource.initialize();
    console.log('Conexão estabelecida.');

    const userRepo = AppDataSource.getRepository(User);
    
    // 1. Garante que o usuário do sistema exista
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

    // 2. Migrar Magias
    console.log('\n--- Migrando Traduções de Magias ---');
    for (const [englishName, translation] of Object.entries(TRANSLATIONS_SPELLS)) {
        await upsertHomebrew(SYSTEM_USER_ID, 'spell', englishName, {
            ...translation,
            name: translation.name, // O nome principal é o traduzido
            index: englishName.toLowerCase().replace(/\s+/g, '-'), // O index é o original em inglês
        });
    }

    // 3. Migrar Equipamentos
    console.log('\n--- Migrando Traduções de Equipamentos ---');
    for (const [englishIndex, translation] of Object.entries(TRANSLATIONS_EQUIPMENT)) {
        await upsertHomebrew(SYSTEM_USER_ID, 'item', englishIndex, {
            ...translation,
            name: translation.name,
            index: englishIndex,
        });
    }

    // 4. Migrar Antecedentes
    console.log('\n--- Migrando Antecedentes Traduzidos ---');
    for (const background of backgroundsData.results) {
        await upsertHomebrew(SYSTEM_USER_ID, 'background', background.index, background);
    }


    console.log('\nMigração de dados concluída com sucesso!');
    await AppDataSource.destroy();
}

migrate().catch(error => {
    console.error('Falha na migração:', error);
    process.exit(1);
});
