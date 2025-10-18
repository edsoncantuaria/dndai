// src/components/Homebrew/ExampleViewer.tsx
'use client';
import React from 'react';
import { HomebrewContentType } from '@/services/homebrewService';
import NewSpellCard from '../Spells/NewSpellCard';
import type { ApiListItem } from '@/types';

interface Props {
    contentType: HomebrewContentType;
    data: any;
}

const Section: React.FC<{ title: string; children: React.ReactNode, isSubSection?: boolean }> = ({ title, children, isSubSection }) => (
    <div className={isSubSection ? "mt-3" : "mt-4 pt-4 border-t border-stone-700/60"}>
        <h4 className={`font-bold ${isSubSection ? 'text-amber-200' : 'text-amber-300 text-lg'} mb-2`}>{title}</h4>
        <div className="space-y-2 text-sm">{children}</div>
    </div>
);

const KeyValue: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
        <p><strong className="text-stone-400 font-semibold">{label}:</strong> <span className="text-stone-200">{value}</span></p>
    );
}

const RaceViewer: React.FC<{ data: any }> = ({ data }) => (
    <div>
        <h3 className="text-2xl font-bold font-garamond text-amber-300">{data.name}</h3>
        <Section title="Atributos Principais">
            <KeyValue label="Velocidade" value={`${data.speed} pés`} />
            <KeyValue label="Tamanho" value={`${data.size}, ${data.size_description}`} />
            <KeyValue label="Idade" value={data.age} />
            <KeyValue label="Alinhamento" value={data.alignment} />
        </Section>
        <Section title="Bônus e Proficiências">
            <div>
                <h5 className="font-semibold text-stone-300">Bônus de Atributo</h5>
                <ul className="list-disc list-inside text-stone-200">
                    {data.ability_bonuses?.map((bonus: any) => (
                        <li key={bonus.ability_score.index}>{bonus.ability_score.name} +{bonus.bonus}</li>
                    ))}
                </ul>
            </div>
            <div>
                <h5 className="font-semibold text-stone-300">Proficiências Iniciais</h5>
                <ul className="list-disc list-inside text-stone-200">
                    {data.starting_proficiencies?.map((prof: ApiListItem) => (
                        <li key={prof.index}>{prof.name}</li>
                    ))}
                </ul>
            </div>
             {data.starting_proficiency_options && <KeyValue label="Opções de Proficiência" value={data.starting_proficiency_options.desc} />}
        </Section>
        <Section title="Traços Raciais">
            <ul className="list-disc list-inside text-stone-200">
                {data.traits?.map((trait: ApiListItem) => <li key={trait.index}>{trait.name}</li>)}
            </ul>
        </Section>
    </div>
);

const ClassViewer: React.FC<{ data: any }> = ({ data }) => (
    <div>
        <h3 className="text-2xl font-bold font-garamond text-amber-300">{data.name}</h3>
        <Section title="Informações de Combate">
             <KeyValue label="Dado de Vida" value={`d${data.hit_die}`} />
             <KeyValue label="Resistências" value={data.saving_throws?.map((st: ApiListItem) => st.name).join(', ')} />
        </Section>
        <Section title="Proficiências">
             <ul className="list-disc list-inside text-stone-200">
                {data.proficiencies?.map((prof: ApiListItem) => (
                    <li key={prof.index}>{prof.name}</li>
                ))}
            </ul>
        </Section>
        <Section title="Opções de Perícia">
            {data.proficiency_choices?.map((choice: any, index: number) => (
                <p key={index}>{choice.desc}</p>
            ))}
        </Section>
    </div>
);

const MonsterViewer: React.FC<{ data: any }> = ({ data }) => (
     <div>
        <h3 className="text-2xl font-bold font-garamond text-amber-300">{data.name}</h3>
        <p className="text-stone-400 italic text-sm">{data.size} {data.type}, {data.alignment}</p>
        <Section title="Defesas">
            <KeyValue label="Classe de Armadura" value={data.armor_class} />
            <KeyValue label="Pontos de Vida" value={`${data.hit_points} (${data.hit_dice})`} />
            <KeyValue label="Velocidade" value={Object.entries(data.speed).map(([type, val]) => `${type} ${val}`).join(', ')} />
        </Section>
        <Section title="Atributos">
            <div className="grid grid-cols-3 gap-2 text-center">
                {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(attr => (
                    <div key={attr} className="bg-stone-800 p-1 rounded">
                        <div className="text-xs text-stone-400">{attr.substring(0,3).toUpperCase()}</div>
                        <div className="font-bold text-stone-200">{data[attr]} ({Math.floor((data[attr] - 10) / 2) >= 0 ? '+' : ''}{Math.floor((data[attr] - 10) / 2)})</div>
                    </div>
                ))}
            </div>
        </Section>
        <Section title="Habilidades">
            <KeyValue label="Sentidos" value={Object.entries(data.senses).map(([key, val]) => `${key} ${val}`).join(', ')} />
            <KeyValue label="Idiomas" value={data.languages} />
            <KeyValue label="Nível de Desafio" value={`${data.challenge_rating} (${data.xp} XP)`} />
        </Section>
        {data.special_abilities?.length > 0 && <Section title="Habilidades Especiais">
            {data.special_abilities.map((ability: any, i: number) => (
                <p key={i}><strong className="text-stone-300">{ability.name}.</strong> {ability.desc}</p>
            ))}
        </Section>}
         {data.actions?.length > 0 && <Section title="Ações">
            {data.actions.map((action: any, i: number) => (
                <p key={i}><strong className="text-stone-300">{action.name}.</strong> {action.desc}</p>
            ))}
        </Section>}
    </div>
);


const ExampleViewer: React.FC<Props> = ({ contentType, data }) => {
    if (!data) {
        return <p className="text-center text-stone-500 italic">Exemplo não disponível.</p>;
    }

    switch (contentType) {
        case 'race':
            return <RaceViewer data={data} />;
        case 'class':
            return <ClassViewer data={data} />;
        case 'spell':
            return <NewSpellCard spell={data} defaultExpanded={true} />;
        case 'monster':
            return <MonsterViewer data={data} />;
        default:
            return (
                <div>
                     <h3 className="text-xl font-bold font-garamond text-amber-300 mb-2">{data.name}</h3>
                     <p className="text-stone-300">{data.desc?.[0] || data.desc || 'Descrição não disponível.'}</p>
                </div>
            );
    }
};

export default ExampleViewer;
