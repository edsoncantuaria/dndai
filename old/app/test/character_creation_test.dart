import 'package:dndai/api/client.dart';
import 'package:dndai/api/models.dart';
import 'package:dndai/theme.dart';
import 'package:dndai/ui/character_creation_screen.dart';
import 'package:dndai/ui/fantasy/drawers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

CharacterCreationOptions sampleCreationOptions({
  String race = 'human',
  String characterClass = 'fighter',
  String background = 'acolyte',
}) {
  final isHalfElf = race == 'half-elf' || race == 'meio-elfo';
  return CharacterCreationOptions.fromJson({
    'catalog': {
      'races': [
        {'id': 'human', 'name': 'Humano'},
        {'id': 'half-elf', 'name': 'Meio-Elfo'},
        {'id': 'high-elf', 'name': 'Alto Elfo'},
      ],
      'classes': [
        {'id': 'fighter', 'name': 'Guerreiro'},
        {'id': 'wizard', 'name': 'Mago'},
        {'id': 'rogue', 'name': 'Ladino'},
      ],
      'backgrounds': [
        {'id': 'acolyte', 'name': 'Acólito'},
        {'id': 'soldier', 'name': 'Soldado'},
      ],
    },
    'race': {
      'id': isHalfElf ? 'half-elf' : 'human',
      'name': isHalfElf ? 'Meio-Elfo' : 'Humano',
      'fixedBonuses': isHalfElf
          ? {'car': 2}
          : {'for': 1, 'des': 1, 'con': 1, 'int': 1, 'sab': 1, 'car': 1},
      'choices': [
        if (isHalfElf) ...[
          {
            'id': 'racial-ability-bonus',
            'label': 'Bônus de Atributos do Meio-Elfo (+1 em dois atributos distintos)',
            'choose': 2,
            'kind': 'ability',
            'options': [
              {'id': 'for', 'name': 'Força (+1)'},
              {'id': 'des', 'name': 'Destreza (+1)'},
              {'id': 'con', 'name': 'Constituição (+1)'},
              {'id': 'int', 'name': 'Inteligência (+1)'},
              {'id': 'sab', 'name': 'Sabedoria (+1)'},
            ],
          },
          {
            'id': 'race-skills',
            'label': 'Versatilidade em Perícias',
            'choose': 2,
            'kind': 'skill',
            'options': [
              {'id': 'atletismo', 'name': 'Atletismo'},
              {'id': 'acrobacia', 'name': 'Acrobacia'},
              {'id': 'furtividade', 'name': 'Furtividade'},
            ],
          },
        ],
      ],
    },
    'class': {
      'id': 'fighter',
      'name': 'Guerreiro',
      'savingThrows': ['for', 'con'],
      'proficiencies': [
        {'id': 'all-armor', 'name': 'Todas as armaduras'},
        {'id': 'shields', 'name': 'Escudos'},
        {'id': 'simple-weapons', 'name': 'Armas simples'},
        {'id': 'martial-weapons', 'name': 'Armas marciais'},
      ],
      'choices': [
        {
          'id': 'class-skills',
          'label': 'Perícias de Classe',
          'choose': 2,
          'kind': 'skill',
          'options': [
            {'id': 'acrobacia', 'name': 'Acrobacia'},
            {'id': 'adestrar', 'name': 'Adestrar Animais'},
            {'id': 'atletismo', 'name': 'Atletismo'},
            {'id': 'historia', 'name': 'História'},
            {'id': 'intuicao', 'name': 'Intuição'},
            {'id': 'intimidacao', 'name': 'Intimidação'},
            {'id': 'percepcao', 'name': 'Percepção'},
            {'id': 'sobrevivencia', 'name': 'Sobrevivência'},
          ],
        },
      ],
    },
    'background': {
      'id': 'acolyte',
      'name': 'Acólito',
      'proficiencies': [
        {'id': 'intuicao', 'name': 'Intuição'},
        {'id': 'religiao', 'name': 'Religião'},
      ],
      'choices': [
        {
          'id': 'bg-languages',
          'label': 'Idiomas do Antecedente',
          'choose': 2,
          'kind': 'language',
          'options': [
            {'id': 'elvish', 'name': 'Élfico'},
            {'id': 'dwarvish', 'name': 'Anão'},
            {'id': 'draconic', 'name': 'Dracônico'},
          ],
        },
      ],
    },
    'equipment': [
      {
        'id': 'eq-1',
        'label': '(a) Cota de malha ou (b) Armadura de couro, arco longo e 20 flechas',
        'choose': 1,
        'kind': 'equipment',
        'options': [
          {'id': 'chain-mail', 'name': 'Cota de malha'},
          {'id': 'leather-armor', 'name': 'Armadura de couro, arco longo e 20 flechas'},
        ],
      },
    ],
  });
}

class FakeApiClient extends ApiClient {
  FakeApiClient({
    this.creationOptionsFn,
    this.createPcFn,
    this.levelUpOptionsFn,
    this.levelUpFn,
  }) : super(baseUrl: 'http://127.0.0.1:8790');

  final Future<CharacterCreationOptions> Function(
    String race,
    String characterClass,
    String background,
  )? creationOptionsFn;
  final Future<void> Function(String campaign, Map<String, dynamic> data)?
  createPcFn;
  final Future<LevelUpOptions> Function(String campaign, String? subclass)?
  levelUpOptionsFn;
  final Future<String> Function(String campaign, Map<String, dynamic> data)?
  levelUpFn;

  @override
  Future<CharacterCreationOptions> characterCreationOptions({
    required String race,
    required String characterClass,
    required String background,
  }) async {
    if (creationOptionsFn != null) {
      return creationOptionsFn!(race, characterClass, background);
    }
    return sampleCreationOptions(
      race: race,
      characterClass: characterClass,
      background: background,
    );
  }

  @override
  Future<void> createPc(String campaign, Map<String, dynamic> pcData) async {
    if (createPcFn != null) {
      return createPcFn!(campaign, pcData);
    }
  }

  @override
  Future<LevelUpOptions> levelUpOptions(
    String campaign, {
    String? subclass,
  }) async {
    if (levelUpOptionsFn != null) {
      return levelUpOptionsFn!(campaign, subclass);
    }
    return LevelUpOptions.fromJson({
      'level': 2,
      'subclass': {'required': false, 'options': []},
      'asi': false,
      'choices': [],
    });
  }
}

void main() {
  testWidgets(
    'criação exige nome na etapa inicial e impede avanço sem nome',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(),
          home: CharacterCreationScreen(
            api: FakeApiClient(),
            campaignSlug: 'teste',
            onCreated: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Clicar próximo sem informar nome
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();

      expect(
        find.text('Informe o nome do personagem antes de prosseguir.'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'não oferece seleção de subclasse no nível 1 e avisa sobre nível futuro',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(),
          home: CharacterCreationScreen(
            api: FakeApiClient(),
            campaignSlug: 'teste',
            onCreated: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextField, 'Nome do Personagem'),
        'Valeros',
      );
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();

      // Na etapa 1 (Raça & Classe)
      expect(
        find.text(
          'O arquétipo/subclasse será escolhido no nível permitido.',
        ),
        findsOneWidget,
      );
      expect(find.text('Arquétipo / Subclasse'), findsNothing);
    },
  );

  testWidgets(
    'meio-elfo exige exatamente 2 bônus raciais flexíveis e atualiza os atributos finais',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(),
          home: CharacterCreationScreen(
            api: FakeApiClient(),
            campaignSlug: 'teste',
            onCreated: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextField, 'Nome do Personagem'),
        'Elion',
      );
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();

      // Selecionar Meio-Elfo no dropdown
      await tester.tap(find.widgetWithText(DropdownButtonFormField<String>, 'Raça'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Meio-Elfo').last);
      await tester.pumpAndSettle();

      // Ir para Atributos
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Bônus de Atributos do Meio-Elfo'),
        findsOneWidget,
      );

      // Tentar avançar com 0 bônus selecionados
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();
      expect(
        find.text('Selecione exatamente 2 bônus raciais (+1).'),
        findsOneWidget,
      );

      // Selecionar Força (+1) e Constituição (+1)
      await tester.tap(find.text('Força (+1)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Constituição (+1)'));
      await tester.pumpAndSettle();

      // Força base 15 + 1 racial = 16
      expect(find.text('Base: 15 + 1 racial'), findsOneWidget);
      expect(find.text('16'), findsWidgets);

      // Carisma base 8 + 2 racial = 10
      expect(find.text('Base: 8 + 2 racial'), findsOneWidget);
      expect(find.text('10'), findsWidgets);

      // Avança com sucesso agora que escolheu 2
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();
      expect(find.text('Perícias, Idiomas & Ferramentas'), findsOneWidget);
    },
  );

  testWidgets(
    'perícias de classe desabilitam perícias já fornecidas pelo antecedente e validam limites',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(),
          home: CharacterCreationScreen(
            api: FakeApiClient(),
            campaignSlug: 'teste',
            onCreated: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextField, 'Nome do Personagem'),
        'Kaelen',
      );
      await tester.tap(find.text('Próximo')); // Passo 1
      await tester.pumpAndSettle();
      await tester.tap(find.text('Próximo')); // Passo 2
      await tester.pumpAndSettle();
      await tester.tap(find.text('Próximo')); // Passo 3
      await tester.pumpAndSettle();

      // Intuição é fixa do Acólito
      expect(
        find.text('Intuição (já concedida pelo antecedente)'),
        findsOneWidget,
      );

      // Tentativa de avançar sem selecionar as 2 perícias
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Complete as escolhas: Perícias de Classe'),
        findsOneWidget,
      );

      // Selecionar 2 perícias permitidas
      await tester.scrollUntilVisible(
        find.text('Acrobacia'),
        50,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Acrobacia'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Atletismo'),
        50,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Atletismo'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining(RegExp('2 de 2', caseSensitive: false)),
        findsWidgets,
      );

      await tester.scrollUntilVisible(
        find.text('Élfico'),
        50,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Élfico'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Anão'),
        50,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Anão'));
      await tester.pumpAndSettle();

      // Avança para equipamento
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();
      expect(find.text('Equipamento Inicial'), findsOneWidget);
    },
  );

  testWidgets(
    'fluxo completo submete payload completo com atributos-base, escolhas e equipamento',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      Map<String, dynamic>? submittedData;
      var createdCalled = false;

      final api = FakeApiClient(
        createPcFn: (campaign, data) async {
          submittedData = data;
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(),
          home: CharacterCreationScreen(
            api: api,
            campaignSlug: 'campanha-alpha',
            onCreated: () {
              createdCalled = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Passo 0: Nome
      await tester.enterText(
        find.widgetWithText(TextField, 'Nome do Personagem'),
        'Theron',
      );
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();

      // Passo 1: Raça & Classe (padrão Humano / Guerreiro)
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();

      // Passo 2: Atributos
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();

      // Passo 3: Perícias
      await tester.scrollUntilVisible(
        find.text('Acrobacia'),
        50,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Acrobacia'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Atletismo'),
        50,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Atletismo'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Élfico'),
        50,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Élfico'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Anão'),
        50,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Anão'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();

      // Passo 4: Equipamento (Cota de malha já vem pré-selecionada)
      expect(find.text('Cota de malha'), findsOneWidget);
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();

      // Passo 5: Resumo
      expect(find.text('Resumo do Personagem'), findsOneWidget);
      expect(find.textContaining('Theron'), findsWidgets);
      expect(find.textContaining('Humano · Guerreiro'), findsWidgets);
      expect(find.text('• Cota de malha'), findsOneWidget);

      await tester.tap(find.text('Concluir & Entrar no Reino'));
      await tester.pumpAndSettle();

      expect(createdCalled, isTrue);
      expect(submittedData, isNotNull);
      expect(submittedData!['name'], 'Theron');
      expect(submittedData!['race'], 'Humano');
      expect(submittedData!['class'], 'Guerreiro');
      expect(submittedData!['background'], 'Acólito');
      expect(submittedData!['level'], 1);
      expect(submittedData!['base_abilities'], isA<Map>());
      expect(submittedData!['abilities'], isA<Map>());
      final choices = submittedData!['choices'] as Map<String, dynamic>;
      expect(choices['class-skills'], containsAll(['acrobacia', 'atletismo']));
      expect(choices['bg-languages'], containsAll(['elvish', 'dwarvish']));
      expect(choices['eq-1'], ['chain-mail']);
    },
  );

  testWidgets(
    'diálogo de evolução de nível é reativo à escolha de subclasse e valida escolhas obrigatórias',
    (tester) async {
      var subclassQueried = <String?>[];
      Map<String, dynamic>? submittedLevelUp;

      LevelUpOptions mockLevelUpOptions({String? subclass}) {
        subclassQueried.add(subclass);
        final hasSubclass = subclass == 'hunter' || subclass == 'cacador';
        return LevelUpOptions.fromJson({
          'level': 3,
          'subclass': {
            'required': true,
            'options': [
              {'id': 'hunter', 'name': 'Caçador'},
              {'id': 'beast-master', 'name': 'Mestre das Feras'},
            ],
          },
          'asi': false,
          'choices': [
            if (hasSubclass)
              {
                'id': 'hunters-prey',
                'name': 'Presa do Caçador',
                'choose': 1,
                'options': [
                  {'id': 'colossus-slayer', 'name': 'Matador de Colossos'},
                  {'id': 'giant-killer', 'name': 'Assassino de Gigantes'},
                ],
              },
          ],
        });
      }

      final pcJson = {
        'id': 'pc:lyra',
        'name': 'Lyra',
        'race': 'Humano',
        'class': 'patrulheiro',
        'classLabel': 'Patrulheiro',
        'subclass': '',
        'background': 'Forasteiro',
        'level': 2,
        'xp': 900,
        'levelUpReady': true,
        'hp': 20,
        'maxHp': 20,
        'tempHp': 0,
        'ac': 14,
        'speed': 9,
        'initiative': 2,
        'profBonus': 2,
        'passivePerception': 13,
        'abilities': {
          'for': {'score': 12, 'mod': 1, 'save': 3, 'proficientSave': true},
          'des': {'score': 15, 'mod': 2, 'save': 4, 'proficientSave': true},
          'con': {'score': 14, 'mod': 2, 'save': 2, 'proficientSave': false},
          'int': {'score': 10, 'mod': 0, 'save': 0, 'proficientSave': false},
          'sab': {'score': 14, 'mod': 2, 'save': 2, 'proficientSave': false},
          'car': {'score': 8, 'mod': -1, 'save': -1, 'proficientSave': false},
        },
        'skills': [],
        'money': {'po': 10, 'pp': 0, 'pc': 0},
        'inventory': [],
        'features': [],
      };

      final gameView = GameView.fromJson({
        'version': 1,
        'campaign': {'name': 'Teste'},
        'clock': {'day': 1, 'time': '10:00', 'period': 'Manhã'},
        'turn': {'open': true},
        'pc': pcJson,
        'present': [],
        'quests': [],
        'facts': [],
        'journal': [],
        'map': {'places': [], 'links': []},
        'pendingRolls': [],
        'lastRolls': [],
        'chat': [],
        'master': {'status': 'ocioso'},
      });

      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(),
          home: Scaffold(
            body: SheetDrawer(
              view: gameView,
              onLevelOptions: ({subclass}) async =>
                  mockLevelUpOptions(subclass: subclass),
              onLevelUp: ({
                String hpMode = 'media',
                String? subclass,
                String? asi,
                String? feat,
                Map<String, List<String>>? choices,
              }) async {
                submittedLevelUp = {
                  'hpMode': hpMode,
                  'subclass': subclass,
                  'choices': choices,
                };
                return null;
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Clicar no botão 'Subir de Nível'
      await tester.tap(find.text('Subir de Nível'));
      await tester.pumpAndSettle();

      expect(find.text('Subir para Nível 3'), findsOneWidget);
      expect(subclassQueried, contains(null));

      // Botão 'Confirmar Evolução' deve estar desabilitado enquanto não escolheu subclasse
      final confirmBtnFinder = find.widgetWithText(FilledButton, 'Confirmar Evolução');
      final confirmBtn = tester.widget<FilledButton>(confirmBtnFinder);
      expect(confirmBtn.onPressed, isNull);

      // Escolher a subclasse 'Caçador'
      await tester.tap(find.widgetWithText(DropdownButtonFormField<String>, 'Arquétipo / Subclasse'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Caçador').last);
      await tester.pumpAndSettle();

      // Confirma que a API foi consultada com a subclasse
      expect(subclassQueried, contains('hunter'));

      // Agora aparece a escolha 'Presa do Caçador: escolha 1'
      expect(find.textContaining('Presa do Caçador'), findsOneWidget);

      // Ainda desabilitado pois não escolheu a opção da subclasse
      final confirmBtn2 = tester.widget<FilledButton>(confirmBtnFinder);
      expect(confirmBtn2.onPressed, isNull);

      // Escolhe 'Matador de Colossos'
      await tester.tap(find.text('Matador de Colossos'));
      await tester.pumpAndSettle();

      // Agora habilitado!
      final confirmBtn3 = tester.widget<FilledButton>(confirmBtnFinder);
      expect(confirmBtn3.onPressed, isNotNull);

      // Confirma evolução
      await tester.tap(confirmBtnFinder);
      await tester.pumpAndSettle();

      expect(submittedLevelUp, isNotNull);
      expect(submittedLevelUp!['subclass'], 'hunter');
      expect(submittedLevelUp!['choices'], {
        'hunters-prey': ['colossus-slayer'],
      });
    },
  );
}
