# Completar criação e progressão de personagem no Flutter

## Objetivo

Fazer o fluxo Flutter funcionar integralmente para jogador novo:

1. Login.
2. Criar campanha.
3. Criar uma ficha SRD 5e válida.
4. Jogar, explorar o mapa progressivo, rolar dados, usar recursos e conversar com o Mestre.
5. Subir de nível sem depender da CLI ou de escolha manual do Mestre.

O motor (`engine/`) é a fonte de verdade de regras e do catálogo SRD. O Flutter nunca deve duplicar tabelas de raça, classe, subclasse, perícia ou progressão.

## Estado atual

Já existe e está funcional:

- Login, campanhas, criação básica de PC, mesa, chat com Mestre, SSE, rolagens, itens, recursos, descanso e mapa descoberto.
- Persistência no SQLite por campanha (`world.db`) e backups por turno.
- Motor valida classes, níveis, recursos, rolagens, subclasses, ASI/talentos e escolhas de características.
- O mapa é progressivo: a API envia apenas locais visitados e vizinhos diretos, sem vazar segredos.
- `GET /api/pc/levelup-options?campaign=<slug>` foi adicionado para o Flutter consultar opções SRD da próxima subida.

Ainda incompleto:

- Criador Flutter não escolhe perícias de classe nem aplica automaticamente as do antecedente.
- Não persiste proficiências de ferramentas/armas/armaduras, idiomas ou equipamento inicial SRD de modo explícito na ficha.
- Não trata escolhas raciais variáveis, especialmente os dois `+1` livres do meio-elfo.
- A distribuição de atributos atual é manual, sem separar valores-base de bônus raciais.
- Escolhas de subclasse que aparecem no próprio nível da seleção precisam recarregar após selecionar a subclasse.
- Escolhas pendentes de características precisam ser selecionáveis pela UI, não apenas exibidas como texto.

## Invariantes obrigatórios

- Regras e validações ficam no motor; Flutter apenas busca opções, coleta decisões e envia a seleção.
- Não expor lugares, NPCs, segredos ou escolhas internas do Mestre no mapa/API do jogador.
- Criação e subida são atômicas: erro não pode deixar ficha parcialmente alterada.
- Uma escolha enviada deve ser verificada novamente no servidor contra raça, classe, nível e catálogo SRD.
- Fichas antigas devem continuar abrindo; campos novos recebem valores padrão em memória e são persistidos na próxima mutação.
- Nunca aceitar valores finais de atributo que não correspondam a `base_abilities + bônus racial` quando a raça for SRD conhecida.

## Implementação no motor

### 1. Modelo persistido de ficha

Em `engine/src/world.ts`, ampliar `Sheet` e `defaultSheet` com campos compatíveis com fichas antigas:

```ts
baseAbilities: Record<Ability, number> | null
proficiencies: string[]
tools: string[]
languages: string[]
creationChoices: Record<string, string[]>
```

Usar nomes/IDs SRD normalizados para persistência; labels são apenas para apresentação.

### 2. Perfil de criação vindo do SRD

Criar em `engine/src/progression.ts` (ou módulo `character-options.ts`) uma função pura que receba raça, classe e antecedente e devolva:

```ts
interface ChoiceOption { id: string; name: string }
interface ChoiceGroup {
  id: string
  label: string
  choose: number
  options: ChoiceOption[]
  kind: 'skill' | 'language' | 'tool' | 'equipment' | 'ability'
}
interface CharacterCreationOptions {
  race: { id: string; name: string; fixedBonuses: Partial<Record<Ability, number>>; choices: ChoiceGroup[] }
  class: { id: string; name: string; savingThrows: Ability[]; proficiencies: ChoiceOption[]; choices: ChoiceGroup[] }
  background: { id: string; name: string; proficiencies: ChoiceOption[]; choices: ChoiceGroup[] }
  equipment: ChoiceGroup[]
}
```

Reaproveitar `data/srd/2014/normalized/{races,classes,backgrounds,proficiencies,equipment,equipment-categories}.json`. Expandir categorias de equipamento no motor, nunca no Flutter.

### 3. Endpoint de opções

Adicionar rota autenticada:

```text
GET /api/pc/creation-options?race=<id>&class=<id>&background=<id>
```

Ela devolve `CharacterCreationOptions`. Retornar `400` para parâmetros inválidos e não mutar o banco.

### 4. Validar e materializar a ficha

Ampliar `PcSchema` em `engine/src/pc.ts` para receber:

```ts
base_abilities
choices
skills
languages
tools
equipment_choices
```

Ao criar:

- Converter rótulos/IDs para referências SRD normalizadas.
- Validar quantidade e pertencimento de cada escolha.
- Somar bônus raciais aos atributos-base e gravar o resultado final em `abilities`.
- Validar o caso especial de meio-elfo: `+2 CAR`, dois `+1` em atributos distintos que não sejam CAR.
- Unir perícias de classe, antecedente e raça sem duplicar; duplicata deve virar escolha substituta válida quando a regra SRD permitir, ou erro claro quando não permitir.
- Salvar idiomas, ferramentas e proficiências na `Sheet`.
- Materializar equipamento fixo e as escolhas de equipamento em `items`; não aceitar item fora das opções SRD.
- Manter dinheiro inicial conforme a regra existente quando o usuário optar por dinheiro em vez de equipamento, se esse modo for suportado.

### 5. Progressão e subclasses

Manter `GET /api/pc/levelup-options` como fonte única de verdade. Estender query para aceitar subclasse candidata:

```text
GET /api/pc/levelup-options?campaign=<slug>&subclass=<id>
```

Com `subclass`, a resposta deve incluir as escolhas daquela subclasse no próximo nível. A UI chama novamente a rota assim que o usuário muda o dropdown.

Incluir escolhas ainda pendentes de níveis anteriores, para que uma ficha criada antes desta mudança possa ser regularizada no Flutter.

### 6. View do jogador

Incluir em `PcView`:

```ts
proficiencies: { id: string; name: string; kind: string }[]
languages: { id: string; name: string }[]
tools: { id: string; name: string }[]
```

Somente dados da própria ficha; não incluir informação privada do Mestre.

### 7. Contrato e testes do motor

Atualizar `engine/API.md` com os endpoints e tipos novos.

Adicionar testes para:

- Todas as 12 classes retornam escolhas de perícia válidas.
- Todos os antecedentes SRD retornam suas proficiências e escolhas.
- Raças com bônus fixos, meio-elfo e raças sem escolha.
- Rejeição de bônus racial, perícia, idioma, ferramenta ou item inválido.
- Equipamento escolhido aparece no inventário.
- Ficha antiga abre com defaults seguros.
- Clérigo/Bruxo/Feiticeiro (subclasse no nível 1), Mago/Druida (nível 2), Bardo/Guerreiro/Ladino (nível 3).
- ASI extra de Guerreiro (6 e 14) e Ladino (10).
- Escolha de subclasse atualiza as opções específicas dela antes de confirmar nível.

## Implementação Flutter

### 1. Modelos e cliente

Em `app/lib/api/models.dart`, adicionar modelos tipados para `CharacterCreationOptions`, grupos/opções de escolha e proficiências da ficha.

Em `app/lib/api/client.dart`, adicionar:

```dart
Future<CharacterCreationOptions> characterCreationOptions({
  required String race,
  required String characterClass,
  required String background,
});

Future<LevelUpOptions> levelUpOptions(String campaign, {String? subclass});
```

### 2. Criador de personagem

Refatorar `app/lib/ui/character_creation_screen.dart` em etapas claras:

1. Identidade e antecedente.
2. Raça e classe.
3. Atributos-base e aplicação visível de bônus raciais.
4. Perícias, idiomas, ferramentas e escolhas raciais.
5. Equipamento inicial.
6. Resumo final antes de criar.

Ao alterar raça/classe/antecedente, buscar novamente opções do motor. Preserve apenas decisões ainda válidas; descarte as inválidas com aviso explícito.

Mostrar:

- Atributo-base, bônus racial e valor final separadamente.
- Contador de escolhas, por exemplo `Perícias de Guerreiro: 1 de 2`.
- Opções já escolhidas desabilitadas em grupos incompatíveis.
- Resumo de proficiências, idiomas e equipamento antes do envio.

Não usar listas locais de subclasses, raças, perícias ou equipamento como fonte de regra.

### 3. Ficha e nível

Na ficha, mostrar idiomas, ferramentas e proficiências em seções próprias.

No diálogo de nível:

- Buscar opções do motor ao abrir.
- Ao escolher uma subclasse, buscar de novo usando `subclass=<id>`.
- Renderizar checkboxes/radios para todas as escolhas exigidas.
- Bloquear confirmação até cada grupo ter exatamente a quantidade exigida.
- Enviar `choices` apenas quando completo; deixar o motor como validação final.
- Mostrar erro de rede/API sem fechar o diálogo.

### 4. Mapa-múndi progressivo

O comportamento desejado já existe no contrato e deve ser preservado:

- Exibir locais visitados, seus pais e vizinhos diretos descobertos.
- Desenhar somente links entre locais conhecidos.
- Indicar local atual e saídas conhecidas.
- Não permitir viagem pelo mapa; viajar continua sendo uma ação narrada ao Mestre.
- A posição visual arrastada no Flutter é apenas layout local e nunca altera geografia do motor.

Adicionar testes de widget para confirmar que local não descoberto não aparece e que uma saída recém-descoberta aparece após atualizar `GameView`.

## Critérios de aceite

- Um jogador cria qualquer uma das 12 classes SRD e recebe somente escolhas válidas.
- Um meio-elfo só conclui a ficha após escolher dois bônus distintos permitidos.
- Perícias, idiomas, ferramentas e equipamento inicial criados aparecem na ficha/inventário após reiniciar o app.
- A criação inválida é rejeitada pelo motor mesmo que o cliente seja adulterado.
- Todas as subclasses e escolhas de nível podem ser concluídas pela UI.
- Não há regressão em turnos, rolagens obrigatórias, SSE, itens, descanso, Mestre, backup ou mapa descoberto.
- `npm run typecheck && npm test` em `engine/` e `flutter analyze && flutter test` em `app/` passam.

## Ordem recomendada

1. Modelo persistido e funções SRD do motor.
2. Endpoint de opções + validação/materialização de criação.
3. Testes do motor para todas as classes/raças/antecedentes.
4. Modelos e cliente Flutter.
5. Criador Flutter e resumo.
6. Diálogo de nível reativo à subclasse.
7. Ficha, mapa e testes Flutter.
8. Regressão completa e build web.

## Prompt pronto para Antigravity

```text
Implemente o plano em docs/FLUTTER_CHARACTER_CREATION_COMPLETION.md neste repositório.

Contexto: o app Flutter em app/ é a mesa do jogador e engine/ é a fonte de verdade das regras D&D 5e/SRD. Não duplique regras ou catálogos no Flutter. O motor deve fornecer todas as opções válidas; o Flutter apenas apresenta, coleta escolhas e envia a decisão. Preserve compatibilidade com fichas antigas e não exponha segredos do Mestre.

Entregue uma implementação completa de criação de personagem e progressão: perícias de classe/antecedente, bônus e escolhas raciais incluindo meio-elfo, idiomas, ferramentas, equipamento inicial, atributos-base versus bônus raciais, subclasses no nível correto e escolhas de características no mesmo nível. Mantenha o mapa-múndi progressivo por descoberta já existente.

Trabalhe na ordem indicada no documento. Atualize engine/API.md. Adicione testes de motor para todas as classes e escolhas relevantes, e testes Flutter para o criador, progressão e mapa. Ao final execute e reporte: cd engine && npm run typecheck && npm test; cd app && flutter analyze && flutter test && flutter build web --release.
```
