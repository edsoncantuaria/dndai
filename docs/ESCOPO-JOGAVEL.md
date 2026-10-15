# Escopo jogável (contrato do Mestre)

O Mestre é uma IA e vai inventar coisas. A defesa é um **mundo fechado**: só tem efeito no jogo o que existe no **SRD 2024** (5e-database) ou no **estado da campanha** (ids). Todo o resto é texto, sem consequência. Fonte do contrato em código: `server/src/core/scope.ts` (`SCOPE`, `scopeText()` vai na skill).

## Quem decide o quê

| Camada | Regra | Exemplos |
|---|---|---|
| **Só o motor** | O Mestre não escreve, só lê | dados, PV, CA, condições, mortes, XP, nível, espaços de magia, recursos de classe, preço, moeda, posição, tempo de viagem, iniciativa |
| **Mestre pede, motor limita** | Op validada; erro = nada gravado | monstros, itens, dinheiro, XP, magias, criação de locais/NPCs/missões |
| **Livre** | Prosa sem efeito mecânico | descrição, tom, diálogo, intenções de NPC, boatos |
| **Proibido** | A narração é recusada | ver abaixo |

## Limites mecânicos (hoje no código)

- **Monstros/NPCs:** só blocos de estatísticas do SRD (341). ND máximo sem confirmação: nível 1 → 1; depois nível+2. Acima disso só com `confirm` e justificativa.
- **Itens:** equipamentos (182) e itens mágicos (262) do SRD. Raridade mínima por nível: comum 1, incomum 3, raro 5, muito raro 11, lendário 17, artefato nunca. Item mágico não comum é único na campanha.
- **Dinheiro:** precisa de fonte (≥ 8 letras). Teto por turno (regra da casa; o SRD não tem tabela de tesouro): níveis 1–4: 100 PO; 5–10: 1.000; 11–16: 5.000; 17–20: 25.000.
- **XP:** de combate vem do XP do bloco de estatísticas dos monstros mortos, uma vez cada (`claimKillXp`). De marco: 1/4 do caminho até o próximo nível, com motivo, a cada 4 turnos no mínimo.
- **Nomes novos:** só nascem em `create`; referências são por id. Morto não age, local/item/NPC inexistente derruba a narração.

## O jogador pode (verbos suportados)

falar e negociar · explorar e testar perícias · atacar (arma/desarmado) · conjurar magias do SRD · usar/equipar itens · comprar e vender (preços do SRD) · viajar entre locais · descansar (curto/longo) · subir de nível · salvaguardas contra morte.

## Fora do jogo (por enquanto)

multiclasse · criação de itens e downtime · montarias e veículos · grade tática (alcance é narrado por zonas) · qualquer regra fora do SRD 5.2 · multijogador. Se o jogador pedir, o Mestre diz que não existe nesta mesa e oferece a alternativa mais próxima.

## Imposto no código (Fase 3)

- **Lista fechada de ops:** o conector só aceita `dnd_agir {beat}` com as ops de `server/src/mestre/submit.ts` (zod `strict`); op desconhecida ou campo extra = erro e nada gravado. O Mestre não tem shell, arquivo nem SQL.
- **Atomicidade:** o beat inteiro é um commit; qualquer erro (referência inexistente, teto, invariante) desfaz tudo.
- **Conjuração:** magia só do SRD, conhecida/preparada, com espaço; dano por nível de espaço, ataque de magia e salvaguarda (com metade do dano) saem automáticos quando o SRD tem os dados; o resto (utilidade, condições, cura) fica para o Mestre, com o espaço já gasto.
- **Guarda da narração:** recusa nome próprio fora do motor/SRD, morto agindo, PC em lugar errado, uso de item que o PC não tem, 3ª pessoa para o PC e segredo ainda fechado. `{n1}` vira o nome exato; id inexistente derruba a narração.
- **Comércio:** `buy`/`sell` usam o preço do SRD (revenda pela metade).
- **Escopo por conector:** cada campanha tem a sua URL secreta e só enxerga a si mesma; auditoria em `campaigns/connector-audit.log`.

## Efeitos automáticos (testados)

Condições do SRD (vantagem/desvantagem, falha automática, crítico em alvo indefeso, exaustão), Fúria, Ataque Furtivo (uma vez por turno), Retomar o Fôlego, Surto de Ação, Mãos Consagradas, Maestria com Armas (Graze, Topple, Vex, Sap; Push, Slow, Nick e Cleave viram aviso ao Mestre), concentração (dano exige salvaguarda de CON), cura por magia (2d8+mod, valor fixo, "todos os PV") e poção de cura, kit de curandeiro. Dano de 89 magias e 422 ações de monstros do SRD rodam pelo motor.

## Masmorras, encontros e mundo (testados)

Encontros nunca passam do orçamento de XP do nível (baixa/moderada/alta, por tamanho do grupo; regra da casa inspirada no DMG 2024). Masmorras: 10 temas, grafo conexo, portas trancadas barram o movimento, chave do chefe sempre existe, armadilhas com CD e dano por faixa de nível, enigmas, tesouro dentro do teto de ouro e itens mágicos por raridade. Auras de lugar (surto arcano, zona morta, solo sagrado, Pálido, clareira feérica, tempestade) têm efeito mecânico. O cenário Auralis (8 regiões, 14 facções, 15 NPCs, 10 masmorras, 3 agendas, livro do mundo com segredos) é original e vem pronto; campanha em branco continua possível.

## Ainda não imposto

- Boato como categoria separada de fato (hoje: `fact` sem `secret`, ou memória de NPC).
- Efeitos de talentos, subclasses e da maioria das magias de utilidade/condição (242 de 339): registrados e gastam espaço/recurso; o Mestre adjudica e usa `condition`/`hazard` para o que muda o estado.
