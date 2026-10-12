import 'package:dndai/api/client.dart';
import 'package:dndai/api/models.dart';
import 'package:dndai/theme.dart';
import 'package:dndai/ui/fantasy/drawers.dart';
import 'package:dndai/ui/fantasy/sigils.dart';
import 'package:dndai/ui/fantasy/table.dart';
import 'package:dndai/ui/play_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('raridade desconhecida não vira cor', () {
    expect(knownRarity('very rare'), 'muito raro');
    expect(knownRarity('lendário'), 'lendário');
    expect(knownRarity('brilhante'), isNull);
    expect(rarityColor(null), isNull);
    expect(rarityColor('raro'), Palette.rare);
    expect(classKeyOf('', 'Patrulheiro'), 'patrulheiro');
    final uri = ApiClient(baseUrl: 'http://127.0.0.1:8790', token: 'segredo').ttsUri('selo', 'chat-2');
    expect(uri.path, '/api/tts');
    expect(uri.queryParameters['campaign'], 'selo');
    expect(uri.queryParameters['key'], 'chat-2');
    expect(uri.queryParameters['token'], 'segredo');
  });

  testWidgets('mesa mostra narração, iniciativa e abre a ficha', (tester) async {
    await phone(tester);
    await tester.pumpWidget(host(GameTable(view: sampleView(), onSend: (_) async => null, onItem: (_, _) async => null, onLeave: () {}, animateNarration: false)));
    await tester.pumpAndSettle();
    final diary = find.textContaining('ensopado', findRichText: true);
    if (diary.evaluate().isEmpty) {
      await tester.scrollUntilVisible(
        find.text('O MESTRE'),
        120,
        scrollable: find.descendant(of: find.byKey(const Key('journal')), matching: find.byType(Scrollable)),
      );
    }
    expect(diary, findsOneWidget);
    expect(find.text('O MESTRE'), findsOneWidget);
    final page = tester.getSize(find.byKey(const Key('narracao-destaque')));
    expect(page.height, greaterThan(500));
    expect(find.textContaining('Lyra'), findsWidgets);
    expect(find.textContaining('R1'), findsWidgets);

    await tester.tap(find.byKey(const Key('status-bar')));
    await tester.pumpAndSettle();
    expect(find.text('Brom'), findsWidgets);
    expect(find.textContaining('envenenado'), findsWidgets);

    await tester.tap(find.byKey(const Key('quick-ficha')));
    await tester.pumpAndSettle();
    expect(find.text('ATRIBUTOS'), findsOneWidget);
    expect(find.text('PERÍCIAS'), findsOneWidget);
    expect(find.text('Furtividade'), findsOneWidget);
  });

  testWidgets('recursos enviam uso ao motor e ficam bloqueados enquanto ocupados', (tester) async {
    await phone(tester);
    final calls = <String>[];
    final view = sampleView(withResource: true);
    await tester.pumpWidget(host(Scaffold(body: SheetDrawer(view: view, onResource: (id, amount) async {
      calls.add('$id:$amount');
      return 'Segundo Fôlego: cura 6 PV';
    }))));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Usar Segundo Fôlego'), 400, scrollable: find.descendant(of: find.byType(ListView), matching: find.byType(Scrollable)).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Usar Segundo Fôlego'));
    await tester.pumpAndSettle();
    expect(calls, ['segundo-folego:1']);
    expect(find.text('Segundo Fôlego: cura 6 PV'), findsOneWidget);

    await tester.pumpWidget(host(Scaffold(body: SheetDrawer(view: view, busy: true, onResource: (_, _) async => null))));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Usar Segundo Fôlego'), 400, scrollable: find.descendant(of: find.byType(ListView), matching: find.byType(Scrollable)).first);
    await tester.pumpAndSettle();
    final button = tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'Usar Segundo Fôlego'));
    expect(button.onPressed, isNull);
  });

  testWidgets('bolsa expande o item e soltar em Usar chama o motor', (tester) async {
    await phone(tester);
    final calls = <String>[];
    await tester.pumpWidget(host(GameTable(
      view: sampleView(),
      animateNarration: false,
      onSend: (_) async => null,
      onLeave: () {},
      onItem: (action, id) async {
        calls.add('$action:$id');
        return 'Cura 6 PV';
      },
    )));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('quick-bolsa')));
    await tester.pumpAndSettle();
    expect(find.text('raro'), findsOneWidget);
    expect(find.text('lendário'), findsNothing);

    await tester.tap(find.byKey(const Key('item-pocao')));
    await tester.pumpAndSettle();
    expect(find.text('Usar'), findsWidgets);

    final from = tester.getCenter(find.byKey(const Key('item-pocao')));
    final gesture = await tester.startGesture(from);
    await tester.pump(const Duration(milliseconds: 400));
    await gesture.moveTo(tester.getCenter(find.byKey(const Key('drop-usar'))));
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
    expect(calls, ['usar:pocao']);
    expect(find.text('Cura 6 PV'), findsOneWidget);
  });

  testWidgets('grimório desenha espaços e o diário não mostra gancho secreto', (tester) async {
    await tester.pumpWidget(host(SizedBox(height: 700, child: SpellbookDrawer(view: sampleView()))));
    await tester.pumpAndSettle();
    expect(find.text('1º círculo · 2/3'), findsOneWidget);
    expect(find.text('Mãos Mágicas'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Círculo 1')), findsOneWidget);

    await tester.pumpWidget(host(SizedBox(height: 700, child: QuestDrawer(view: sampleView()))));
    await tester.pumpAndSettle();
    expect(find.text('O selo da mina'), findsOneWidget);
    expect(find.textContaining('Kael prometeu'), findsOneWidget);
    expect(find.textContaining('gancho secreto'), findsNothing);
  });

  testWidgets('pessoas expandem e o mapa lista o local atual', (tester) async {
    await tester.pumpWidget(host(const SizedBox(height: 640, child: SizedBox.shrink())));
    await tester.pumpWidget(host(SizedBox(height: 640, child: PeopleDrawer(view: sampleView()))));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Expandir').first);
    await tester.pumpAndSettle();
    expect(find.textContaining('com medo da sua arma'), findsOneWidget);

    await tester.pumpWidget(host(SizedBox(height: 700, child: MapDrawer(view: sampleView()))));
    await tester.pumpAndSettle();
    expect(find.textContaining('Você está em Taverna do Javali'), findsWidgets);
    expect(find.textContaining('Trilha Norte'), findsWidgets);
  });

  testWidgets('texto maior aumenta a escala e a saída sugere o caminho', (tester) async {
    await phone(tester);
    final settings = PlaySettings();
    await tester.pumpWidget(host(
      GameTable(view: sampleView(), animateNarration: false, onSend: (_) async => null, onItem: (_, _) async => null, onLeave: () {}),
      settings: settings,
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('btn-ajustes')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('switch-texto-maior')));
    await tester.pumpAndSettle();
    expect(settings.largeText, isTrue);
    expect(MediaQuery.textScalerOf(tester.element(find.byType(GameTable))).scale(10), greaterThan(12));
    Navigator.of(tester.element(find.byType(BottomSheet))).pop();
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsNothing);

    await tester.tap(find.byKey(const Key('exit-lugar:trilha')));
    await tester.pump();
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, 'Sigo para Trilha Norte.');

    await tester.tap(find.byKey(const Key('font-maior')));
    await tester.pump();
    expect(settings.narrationStep, 2);
  });

  testWidgets('ouvir pede a voz da última narração', (tester) async {
    await phone(tester);
    final keys = <String>[];
    await tester.pumpWidget(host(GameTable(
      view: sampleView(),
      animateNarration: false,
      onSend: (_) async => null,
      onItem: (_, _) async => null,
      onLeave: () {},
      onListen: (key) async => keys.add(key),
    )));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('btn-ouvir')));
    expect(keys, ['chat-2']);
  });

  testWidgets('golden da mesa, ficha, bolsa, grimório e diário', (tester) async {
    final view = sampleView();
    Future<void> shot(String name, Widget child, Size size) async {
      await tester.binding.setSurfaceSize(size);
      tester.view.devicePixelRatio = 1;
      await tester.pumpWidget(host(child));
      await tester.pumpAndSettle();
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));
    }

    await shot('mesa_telefone', GameTable(view: view, animateNarration: false, onSend: (_) async => null, onItem: (_, _) async => null, onLeave: () {}, onListen: (_) async {}), const Size(390, 844));
    await shot('ficha', Scaffold(body: SheetDrawer(view: view)), const Size(390, 844));
    await shot('bolsa', Scaffold(body: BagDrawer(view: view, onItem: (_, _) async => null)), const Size(390, 844));
    await shot('grimorio', Scaffold(body: SpellbookDrawer(view: view)), const Size(390, 844));
    await shot('diario', Scaffold(body: QuestDrawer(view: view)), const Size(390, 844));
    await shot('mesa_larga', GameTable(view: view, animateNarration: false, onSend: (_) async => null, onItem: (_, _) async => null, onLeave: () {}, onListen: (_) async {}), const Size(1100, 760));
    await tester.binding.setSurfaceSize(null);
  });
}

Future<void> phone(WidgetTester tester) async {
  final view = tester.view;
  final ratio = view.devicePixelRatio;
  await tester.binding.setSurfaceSize(const Size(390, 844));
  view.devicePixelRatio = 1;
  addTearDown(() async {
    view.devicePixelRatio = ratio;
    await tester.binding.setSurfaceSize(null);
  });
}

Widget host(Widget child, {PlaySettings? settings}) {
  final play = settings ?? PlaySettings();
  return PlaySettingsScope(
    notifier: play,
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      builder: (context, inner) => ListenableBuilder(
        listenable: play,
        builder: (context, _) {
          final mq = MediaQuery.of(context);
          final base = mq.textScaler.scale(100) / 100;
          final factor = (play.largeText ? base * 1.3 : base).clamp(0.8, 2.4);
          return MediaQuery(data: mq.copyWith(textScaler: TextScaler.linear(factor)), child: inner ?? const SizedBox.shrink());
        },
      ),
      home: child,
    ),
  );
}

GameView sampleView({bool withResource = false}) => GameView.fromJson({
      'version': 3,
      'campaign': {'name': 'O Selo Quebrado', 'premise': 'Uma mina selada chama os vivos.', 'tone': 'sombrio'},
      'clock': {'day': 4, 'time': '21:10', 'period': 'noite'},
      'turn': {'open': false},
      'pc': {
        'id': 'pc:lyra',
        'name': 'Lyra',
        'race': 'Elfa',
        'class': 'ladino',
        'classLabel': 'Ladino',
        'subclass': 'Ladrão',
        'background': 'Criminosa',
        'level': 3,
        'xp': 900,
        'nextLevelXp': 2700,
        'hp': 14,
        'maxHp': 21,
        'tempHp': 0,
        'ac': 15,
        'speed': 9,
        'initiative': 3,
        'profBonus': 2,
        'status': 'vivo',
        'passivePerception': 13,
        'conditions': ['envenenado'],
        'death': {'success': 0, 'fail': 0},
        'hitDice': {'die': 8, 'max': 3, 'used': 1},
        'abilities': {
          'for': {'score': 10, 'mod': 0, 'save': 0, 'proficientSave': false},
          'des': {'score': 16, 'mod': 3, 'save': 5, 'proficientSave': true},
          'con': {'score': 12, 'mod': 1, 'save': 1, 'proficientSave': false},
          'int': {'score': 14, 'mod': 2, 'save': 4, 'proficientSave': true},
          'sab': {'score': 12, 'mod': 1, 'save': 1, 'proficientSave': false},
          'car': {'score': 13, 'mod': 1, 'save': 1, 'proficientSave': false},
        },
        'skills': [
          {'label': 'Furtividade', 'ability': 'des', 'bonus': 5, 'proficient': true, 'expertise': false},
          {'label': 'Percepção', 'ability': 'sab', 'bonus': 3, 'proficient': true, 'expertise': false},
        ],
        'spellcasting': {
          'ability': 'int',
          'abilityLabel': 'Inteligência',
          'saveDc': 12,
          'attackBonus': 4,
          'slots': [
            {'level': 1, 'max': 3, 'used': 1},
          ],
          'spells': ['Mãos Mágicas'],
        },
        'money': {'po': 12, 'pp': 4, 'pc': 8},
        'inventory': [
          {'id': 'pocao', 'name': 'Poção de Cura', 'qty': 2, 'kind': 'consumível', 'equipped': false, 'drawn': false, 'notes': 'Vidro verde.', 'effect': 'Cura 2d4+2 PV', 'actions': ['usar', 'largar'], 'rarity': 'comum'},
          {'id': 'manto', 'name': 'Manto Élfico', 'qty': 1, 'kind': 'manto', 'equipped': true, 'drawn': false, 'notes': 'Capuz fundo.', 'effect': null, 'actions': ['guardar'], 'rarity': 'raro'},
          {'id': 'seixo', 'name': 'Seixo', 'qty': 1, 'kind': 'equipamento', 'equipped': false, 'drawn': false, 'notes': '', 'effect': null, 'actions': ['largar'], 'props': {'rarity': 'brilhante'}},
        ],
        'features': ['Ataque Furtivo'],
        if (withResource) 'resources': [
          {'id': 'segundo-folego', 'name': 'Segundo Fôlego', 'max': 1, 'used': 0, 'resets_on': 'short', 'effect': 'Cura 1d10 + nível', 'available': true},
        ],
      },
      'location': {
        'id': 'lugar:taverna',
        'name': 'Taverna do Javali',
        'kind': 'taverna',
        'summary': 'Mesas grudentas e uma lareira baixa.',
        'details': 'O taverneiro não tira os olhos da porta.',
        'parent': {'name': 'Vila de Pedra'},
        'exits': [
          {'id': 'lugar:trilha', 'name': 'Trilha Norte', 'minutes': 10, 'via': 'porta dos fundos'},
        ],
        'items': [
          {'id': 'chao', 'name': 'Corda', 'qty': 1, 'kind': 'equipamento', 'notes': 'Enrolada.', 'actions': []},
        ],
      },
      'present': [
        {'id': 'npc:brom', 'name': 'Brom', 'summary': 'Taverneiro anão, braços de farinha.', 'status': 'vivo', 'attitude': 15, 'attitudeLabel': 'neutro', 'companion': false, 'reaction': 'com medo da sua arma'},
      ],
      'combat': {
        'round': 1,
        'order': [
          {'id': 'pc:lyra', 'name': 'Lyra', 'initiative': 18, 'hp': 14, 'maxHp': 21, 'status': 'vivo', 'current': true, 'isPc': true, 'portrait': null},
          {'id': 'npc:bandido', 'name': 'Bandido', 'initiative': 9, 'hp': 7, 'maxHp': 11, 'status': 'vivo', 'current': false, 'isPc': false, 'portrait': null},
        ],
      },
      'quests': [
        {'id': 'q1', 'title': 'O selo da mina', 'summary': 'Descobrir o que quebrou o selo.', 'status': 'ativa', 'giver': 'Brom', 'objectives': [{'text': 'Falar com o guarda', 'done': false}]},
      ],
      'facts': [
        {'id': 1, 'text': 'Kael prometeu voltar antes do anoitecer', 'about': 'npc:kael', 'day': 4},
      ],
      'journal': [],
      'map': {
        'places': [
          {'id': 'lugar:vila', 'name': 'Vila de Pedra', 'kind': 'vila', 'parent': null, 'visited': true, 'current': false},
          {'id': 'lugar:taverna', 'name': 'Taverna do Javali', 'kind': 'taverna', 'parent': 'lugar:vila', 'visited': true, 'current': true},
          {'id': 'lugar:trilha', 'name': 'Trilha Norte', 'kind': 'trilha', 'parent': 'lugar:vila', 'visited': false, 'current': false},
        ],
        'links': [
          {'from': 'lugar:taverna', 'to': 'lugar:trilha', 'minutes': 10, 'via': 'porta dos fundos'},
        ],
      },
      'pendingRolls': [],
      'lastRolls': [],
      'chat': [
        {'id': 1, 'role': 'jogador', 'text': 'Olho a sala.', 'status': 'entregue', 'error': ''},
        {'id': 2, 'role': 'mestre', 'text': 'A taverna cheira a ensopado e a medo.', 'status': 'entregue', 'error': ''},
      ],
      'master': {'status': 'ocioso'},
    });
