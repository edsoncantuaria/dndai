import 'package:flutter/material.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../theme.dart';
import 'fantasy/chrome.dart';
import 'fantasy/sigils.dart';

class CharacterCreationScreen extends StatefulWidget {
  const CharacterCreationScreen({
    super.key,
    required this.api,
    required this.campaignSlug,
    required this.onCreated,
    this.initialOptions,
  });

  final ApiClient api;
  final String campaignSlug;
  final VoidCallback onCreated;
  final CharacterCreationOptions? initialOptions;

  @override
  State<CharacterCreationScreen> createState() =>
      _CharacterCreationScreenState();
}

class _CharacterCreationScreenState extends State<CharacterCreationScreen> {
  final _nameCtrl = TextEditingController();
  int _step = 0;
  bool _submitting = false;
  bool _loadingOptions = false;
  String? _error;

  CharacterCreationOptions? _options;

  String _selectedRace = 'human';
  String _selectedClass = 'fighter';
  String _selectedBackground = 'acolyte';

  // Atributos-base
  int _baseStr = 15;
  int _baseDex = 13;
  int _baseCon = 14;
  int _baseInt = 10;
  int _baseWis = 12;
  int _baseCha = 8;

  // Escolhas raciais de atributos (+1 livre do meio-elfo)
  List<String> _racialAbilityChoices = [];

  // Escolhas de perícias, idiomas e ferramentas
  Set<String> _selectedClassSkills = {};
  Set<String> _selectedRaceSkills = {};
  // Cada escolha é guardada sob o id do grupo devolvido pelo motor. Isso é
  // importante quando dois grupos oferecem a mesma opção (por exemplo, dois
  // idiomas extras): o servidor consegue validar sua origem sem ambiguidade.
  final Map<String, Set<String>> _selectedGroupChoices = {};

  // Escolhas de equipamento: ID do grupo -> ID do item
  final Map<String, String> _selectedEquipment = {};

  final List<String> _abilityKeys = ['for', 'des', 'con', 'int', 'sab', 'car'];
  final Map<String, String> _abilityLabels = {
    'for': 'Força (FOR)',
    'des': 'Destreza (DES)',
    'con': 'Constituição (CON)',
    'int': 'Inteligência (INT)',
    'sab': 'Sabedoria (SAB)',
    'car': 'Carisma (CAR)',
  };

  Set<String> _groupSelections(String groupId) =>
      _selectedGroupChoices.putIfAbsent(groupId, () => <String>{});

  @override
  void initState() {
    super.initState();
    if (widget.initialOptions != null) {
      _options = widget.initialOptions;
      _pruneInvalidChoices(widget.initialOptions!);
    } else {
      _fetchOptions();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchOptions() async {
    setState(() {
      _loadingOptions = true;
      _error = null;
    });

    try {
      final opts = await widget.api.characterCreationOptions(
        race: _selectedRace,
        characterClass: _selectedClass,
        background: _selectedBackground,
      );
      if (mounted) {
        setState(() {
          _options = opts;
          _loadingOptions = false;
          _pruneInvalidChoices(opts);
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadingOptions = false;
          _error = 'Não foi possível carregar opções do motor: $e';
        });
      }
    }
  }

  void _pruneInvalidChoices(CharacterCreationOptions opts) {
    // 1. Escolha racial de atributos
    final abilityGroup = opts.race.choices
        .where((c) => c.kind == 'ability')
        .firstOrNull;
    if (abilityGroup != null) {
      final valid = abilityGroup.options.map((o) => o.id).toSet();
      _racialAbilityChoices.removeWhere((id) => !valid.contains(id));
      if (_racialAbilityChoices.length > abilityGroup.choose) {
        _racialAbilityChoices =
            _racialAbilityChoices.sublist(0, abilityGroup.choose);
      }
    } else {
      _racialAbilityChoices.clear();
    }

    // 2. Perícias fixas de antecedente
    final fixedBgSkills = opts.background.proficiencies.map((p) => p.id).toSet();

    // 3. Perícias de classe
    final classSkillGroup = opts.characterClass.choices
        .where((c) => c.kind == 'skill')
        .firstOrNull;
    if (classSkillGroup != null) {
      final valid = classSkillGroup.options.map((o) => o.id).toSet();
      _selectedClassSkills.removeWhere(
        (id) => !valid.contains(id) || fixedBgSkills.contains(id),
      );
      if (_selectedClassSkills.length > classSkillGroup.choose) {
        _selectedClassSkills =
            _selectedClassSkills.take(classSkillGroup.choose).toSet();
      }
    } else {
      _selectedClassSkills.clear();
    }

    // 4. Perícias de raça (ex.: meio-elfo)
    final raceSkillGroup = opts.race.choices
        .where((c) => c.kind == 'skill')
        .firstOrNull;
    if (raceSkillGroup != null) {
      final valid = raceSkillGroup.options.map((o) => o.id).toSet();
      _selectedRaceSkills.removeWhere(
        (id) =>
            !valid.contains(id) ||
            fixedBgSkills.contains(id) ||
            _selectedClassSkills.contains(id),
      );
      if (_selectedRaceSkills.length > raceSkillGroup.choose) {
        _selectedRaceSkills =
            _selectedRaceSkills.take(raceSkillGroup.choose).toSet();
      }
    } else {
      _selectedRaceSkills.clear();
    }

    // 5. Todas as escolhas variáveis são vinculadas ao grupo do motor.
    final variableGroups = [
      ...opts.race.choices,
      ...opts.characterClass.choices,
      ...opts.background.choices,
    ].where((g) => g.kind == 'language' || g.kind == 'tool');
    final groupById = {for (final group in variableGroups) group.id: group};
    _selectedGroupChoices.removeWhere((id, _) => !groupById.containsKey(id));
    for (final entry in _selectedGroupChoices.entries) {
      final group = groupById[entry.key]!;
      final valid = group.options.map((option) => option.id).toSet();
      entry.value.removeWhere((id) => !valid.contains(id));
      while (entry.value.length > group.choose) {
        entry.value.remove(entry.value.last);
      }
    }

    // 7. Equipamento: manter seleção ou pré-selecionar primeira opção
    for (final eqGroup in opts.equipment) {
      final current = _selectedEquipment[eqGroup.id];
      final validOptions = eqGroup.options.map((o) => o.id).toSet();
      if (current == null || !validOptions.contains(current)) {
        if (eqGroup.options.isNotEmpty) {
          _selectedEquipment[eqGroup.id] = eqGroup.options.first.id;
        }
      }
    }
  }

  void _onClassChanged(String newClass) {
    _selectedClass = newClass;
    final k = newClass.toLowerCase();
    setState(() {
      if (k.contains('guerreiro') ||
          k.contains('fighter') ||
          k.contains('barbar') ||
          k.contains('paladin')) {
        _baseStr = 15;
        _baseCon = 14;
        _baseDex = 13;
        _baseWis = 12;
        _baseInt = 10;
        _baseCha = 8;
      } else if (k.contains('ladino') ||
          k.contains('rogue') ||
          k.contains('monk') ||
          k.contains('monge') ||
          k.contains('ranger') ||
          k.contains('patrulheiro')) {
        _baseDex = 15;
        _baseCon = 14;
        _baseWis = 13;
        _baseStr = 12;
        _baseInt = 10;
        _baseCha = 8;
      } else if (k.contains('mago') || k.contains('wizard')) {
        _baseInt = 15;
        _baseCon = 14;
        _baseDex = 13;
        _baseWis = 12;
        _baseCha = 10;
        _baseStr = 8;
      } else if (k.contains('cler') || k.contains('druid')) {
        _baseWis = 15;
        _baseCon = 14;
        _baseStr = 13;
        _baseDex = 12;
        _baseInt = 10;
        _baseCha = 8;
      } else {
        _baseCha = 15;
        _baseCon = 14;
        _baseDex = 13;
        _baseWis = 12;
        _baseInt = 10;
        _baseStr = 8;
      }
    });
    _fetchOptions();
  }

  int _getBase(String a) {
    return switch (a) {
      'for' => _baseStr,
      'des' => _baseDex,
      'con' => _baseCon,
      'int' => _baseInt,
      'sab' => _baseWis,
      'car' => _baseCha,
      _ => 10,
    };
  }

  void _setBase(String a, int v) {
    final clamped = v.clamp(6, 18);
    setState(() {
      switch (a) {
        case 'for':
          _baseStr = clamped;
          break;
        case 'des':
          _baseDex = clamped;
          break;
        case 'con':
          _baseCon = clamped;
          break;
        case 'int':
          _baseInt = clamped;
          break;
        case 'sab':
          _baseWis = clamped;
          break;
        case 'car':
          _baseCha = clamped;
          break;
      }
    });
  }

  int _getRacialBonus(String a) {
    final fixed = _options?.race.fixedBonuses[a] ?? 0;
    final flex = _racialAbilityChoices.where((x) => x == a).length;
    return fixed + flex;
  }

  int _getFinal(String a) => _getBase(a) + _getRacialBonus(a);

  int _mod(int val) => ((val - 10) / 2).floor();
  String _signed(int val) => val >= 0 ? '+$val' : '$val';

  int get _calculatedAc {
    final dexMod = _mod(_getFinal('des'));
    final conMod = _mod(_getFinal('con'));
    final wisMod = _mod(_getFinal('sab'));
    final cls = (_options?.characterClass.name ?? _selectedClass).toLowerCase();
    if (cls.contains('guerreiro') ||
        cls.contains('fighter') ||
        cls.contains('paladin')) {
      return 16;
    } else if (cls.contains('bárbaro') || cls.contains('barbar')) {
      return 10 + dexMod + conMod;
    } else if (cls.contains('monge') || cls.contains('monk')) {
      return 10 + dexMod + wisMod;
    } else if (cls.contains('ladino') ||
        cls.contains('rogue') ||
        cls.contains('ranger') ||
        cls.contains('patrulheiro')) {
      return 11 + dexMod;
    }
    return 10 + dexMod;
  }

  int get _calculatedHp {
    final conMod = _mod(_getFinal('con'));
    final cls = (_options?.characterClass.name ?? _selectedClass).toLowerCase();
    final die = cls.contains('bárbaro') || cls.contains('barbar')
        ? 12
        : (cls.contains('guerreiro') ||
                cls.contains('fighter') ||
                cls.contains('paladin') ||
                cls.contains('patrulheiro') ||
                cls.contains('ranger'))
            ? 10
            : (cls.contains('mago') ||
                    cls.contains('wizard') ||
                    cls.contains('feiticeiro') ||
                    cls.contains('sorcerer'))
                ? 6
                : 8;
    return die + conMod;
  }

  List<String> _missingChoices({bool includeEquipment = true}) {
    final opts = _options;
    if (opts == null) return [];
    final groups = [
      ...opts.race.choices,
      ...opts.characterClass.choices,
      ...opts.background.choices,
      if (includeEquipment) ...opts.equipment,
    ];
    return [
      for (final group in groups)
        if (_selectionFor(group).length != group.choose) group.label,
    ];
  }

  Set<String> _selectionFor(ChoiceGroup group) {
    if (group.id == 'racial-ability-bonus') {
      return _racialAbilityChoices.toSet();
    }
    if (group.id == 'class-skills') return _selectedClassSkills;
    if (group.id == 'racial-skill') return _selectedRaceSkills;
    if (group.kind == 'equipment') {
      final selected = _selectedEquipment[group.id];
      return selected == null ? {} : {selected};
    }
    return _groupSelections(group.id);
  }

  Map<String, dynamic> _creationChoicesPayload() {
    final opts = _options;
    if (opts == null) return {};
    return {
      for (final group in [
        ...opts.race.choices,
        ...opts.characterClass.choices,
        ...opts.background.choices,
        ...opts.equipment,
      ])
        group.id: _selectionFor(group).toList(),
    };
  }

  void _validateAndAdvance() {
    if (_step == 0) {
      if (_nameCtrl.text.trim().isEmpty) {
        setState(() => _error = 'Informe o nome do personagem antes de prosseguir.');
        return;
      }
    } else if (_step == 2) {
      final opts = _options;
      if (opts != null) {
        final abilityGroup = opts.race.choices
            .where((c) => c.kind == 'ability')
            .firstOrNull;
        if (abilityGroup != null &&
            _racialAbilityChoices.length != abilityGroup.choose) {
          setState(() => _error =
              'Selecione exatamente ${abilityGroup.choose} bônus raciais (+1).');
          return;
        }
      }
    } else if (_step == 3) {
      final missing = _missingChoices(includeEquipment: false);
      if (missing.isNotEmpty) {
        setState(() => _error = 'Complete as escolhas: ${missing.join(', ')}.');
        return;
      }
    }

    setState(() {
      _error = null;
      if (_step < 5) _step++;
    });
  }

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty) {
      setState(() {
        _step = 0;
        _error = 'Informe o nome do personagem antes de concluir.';
      });
      return;
    }

    final opts = _options;
    if (opts != null) {
      final abilityGroup = opts.race.choices
          .where((c) => c.kind == 'ability')
          .firstOrNull;
      if (abilityGroup != null &&
          _racialAbilityChoices.length != abilityGroup.choose) {
        setState(() {
          _step = 2;
          _error =
              'Selecione exatamente ${abilityGroup.choose} bônus raciais (+1).';
        });
        return;
      }

      final missing = _missingChoices();
      if (missing.isNotEmpty) {
        setState(() {
          _step = missing.any((label) =>
                  opts.equipment.any((group) => group.label == label))
              ? 4
              : 3;
          _error = 'Complete as escolhas: ${missing.join(', ')}.';
        });
        return;
      }
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final payload = {
        'name': _nameCtrl.text.trim(),
        'race': _options?.race.name ?? _selectedRace,
        'class': _options?.characterClass.name ?? _selectedClass,
        'background': _options?.background.name ?? _selectedBackground,
        'level': 1,
        'ac': _calculatedAc,
        'hp': _calculatedHp,
        'base_abilities': {
          for (final a in _abilityKeys) a: _getBase(a),
        },
        'abilities': {
          for (final a in _abilityKeys) a: _getFinal(a),
        },
        'choices': _creationChoicesPayload(),
      };

      await widget.api.createPc(widget.campaignSlug, payload);
      if (mounted) widget.onCreated();
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Erro ao criar ficha: $e');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Criação de Personagem'),
        actions: [
          if (_loadingOptions)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Barra de passos
            Container(
              decoration: const BoxDecoration(
                color: Palette.obsidianRaised,
                border: Border(bottom: BorderSide(color: Color(0x40D4AF37))),
              ),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                child: Row(
                  children: [
                    _StepTab(
                      index: 0,
                      current: _step,
                      label: '1. Identidade',
                      onSelect: () => setState(() => _step = 0),
                    ),
                    const SizedBox(width: 6),
                    _StepTab(
                      index: 1,
                      current: _step,
                      label: '2. Raça & Classe',
                      onSelect: () => setState(() => _step = 1),
                    ),
                    const SizedBox(width: 6),
                    _StepTab(
                      index: 2,
                      current: _step,
                      label: '3. Atributos',
                      onSelect: () => setState(() => _step = 2),
                    ),
                    const SizedBox(width: 6),
                    _StepTab(
                      index: 3,
                      current: _step,
                      label: '4. Perícias & Idiomas',
                      onSelect: () => setState(() => _step = 3),
                    ),
                    const SizedBox(width: 6),
                    _StepTab(
                      index: 4,
                      current: _step,
                      label: '5. Equipamento',
                      onSelect: () => setState(() => _step = 4),
                    ),
                    const SizedBox(width: 6),
                    _StepTab(
                      index: 5,
                      current: _step,
                      label: '6. Resumo',
                      onSelect: () => setState(() => _step = 5),
                    ),
                  ],
                ),
              ),
            ),
            if (_error != null)
              Container(
                margin: const EdgeInsets.all(12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Palette.failure.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Palette.failure),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Palette.failure, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(color: Palette.failure),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_step == 0) _buildStep0(),
                  if (_step == 1) _buildStep1(),
                  if (_step == 2) _buildStep2(),
                  if (_step == 3) _buildStep3(),
                  if (_step == 4) _buildStep4(),
                  if (_step == 5) _buildStep5(),
                ],
              ),
            ),
            // Rodapé de Ação
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Palette.obsidianRaised,
                border: Border(top: BorderSide(color: Color(0x38D4AF37))),
              ),
              child: Row(
                children: [
                  if (_step > 0)
                    TextButton.icon(
                      style: TextButton.styleFrom(
                        foregroundColor: Palette.gold,
                      ),
                      onPressed: () => setState(() => _step--),
                      icon: const Icon(Icons.arrow_back),
                      label: const Text(
                        'Anterior',
                        style: TextStyle(fontFamily: 'Cinzel'),
                      ),
                    ),
                  const Spacer(),
                  if (_step < 5)
                    FilledButton.icon(
                      onPressed: _validateAndAdvance,
                      icon: const Icon(Icons.arrow_forward),
                      label: const Text('Próximo'),
                    )
                  else
                    Flexible(
                      child: FilledButton.icon(
                        onPressed: _submitting ? null : _submit,
                        icon: _submitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.shield),
                        label: const Text(
                          'Concluir & Entrar no Reino',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- PASSO 0: Identidade e Antecedente ---
  Widget _buildStep0() {
    final catalogBgs = _options?.catalog?.backgrounds;
    final bgs = catalogBgs != null && catalogBgs.isNotEmpty
        ? catalogBgs
        : [ChoiceOption(_selectedBackground, _options?.background.name ?? 'Acólito')];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Identidade do Aventureiro',
          style: displayStyle(size: 24, color: Palette.ink),
        ),
        const SizedBox(height: 8),
        const Text(
          'Dê um nome e um passado ao seu personagem para dar início à crônica.',
          style: TextStyle(color: Palette.inkSoft),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _nameCtrl,
          decoration: const InputDecoration(
            labelText: 'Nome do Personagem',
            prefixIcon: Icon(Icons.person_outline, color: Palette.gold),
          ),
        ),
        const SizedBox(height: 18),
        DropdownButtonFormField<String>(
          key: ValueKey('bg-$_selectedBackground'),
          initialValue: bgs.any((b) => b.id == _selectedBackground)
              ? _selectedBackground
              : bgs.first.id,
          decoration: const InputDecoration(
            labelText: 'Antecedente (Histórico)',
            prefixIcon: Icon(Icons.menu_book, color: Palette.gold),
          ),
          items: bgs
              .map((b) => DropdownMenuItem(value: b.id, child: Text(b.name)))
              .toList(),
          onChanged: (v) {
            if (v != null) {
              _selectedBackground = v;
              _fetchOptions();
            }
          },
        ),
        const SizedBox(height: 24),
        Parchment(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Resumo Inicial',
                style: displayStyle(size: 18, color: Palette.ink),
              ),
              const SizedBox(height: 6),
              Text(
                '${_nameCtrl.text.isEmpty ? "Seu Herói" : _nameCtrl.text}, '
                'de antecedente ${_options?.background.name ?? _selectedBackground}.',
                style: const TextStyle(
                  color: Palette.ink,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // --- PASSO 1: Raça e Classe ---
  Widget _buildStep1() {
    final catalogRaces = _options?.catalog?.races;
    final races = catalogRaces != null && catalogRaces.isNotEmpty
        ? catalogRaces
        : [ChoiceOption(_selectedRace, _options?.race.name ?? 'Humano')];

    final catalogClasses = _options?.catalog?.classes;
    final classes = catalogClasses != null && catalogClasses.isNotEmpty
        ? catalogClasses
        : [ChoiceOption(_selectedClass, _options?.characterClass.name ?? 'Guerreiro')];

    final raceName = _options?.race.name ?? _selectedRace;
    final className = _options?.characterClass.name ?? _selectedClass;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Raça e Classe Primária',
          style: displayStyle(size: 24, color: Palette.ink),
        ),
        const SizedBox(height: 8),
        const Text(
          'Escolha sua linhagem e vocação heroica segundo o catálogo do motor.',
          style: TextStyle(color: Palette.inkSoft),
        ),
        const SizedBox(height: 20),
        DropdownButtonFormField<String>(
          key: ValueKey('race-$_selectedRace'),
          initialValue: races.any((r) => r.id == _selectedRace)
              ? _selectedRace
              : races.first.id,
          decoration: const InputDecoration(
            labelText: 'Raça',
            prefixIcon: Icon(Icons.person, color: Palette.gold),
          ),
          items: races
              .map((r) => DropdownMenuItem(value: r.id, child: Text(r.name)))
              .toList(),
          onChanged: (v) {
            if (v != null) {
              _selectedRace = v;
              _fetchOptions();
            }
          },
        ),
        const SizedBox(height: 18),
        DropdownButtonFormField<String>(
          key: ValueKey('class-$_selectedClass'),
          initialValue: classes.any((c) => c.id == _selectedClass)
              ? _selectedClass
              : classes.first.id,
          decoration: const InputDecoration(
            labelText: 'Classe Primária',
            prefixIcon: Icon(Icons.auto_stories, color: Palette.gold),
          ),
          items: classes
              .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
              .toList(),
          onChanged: (v) {
            if (v != null) {
              _onClassChanged(v);
            }
          },
        ),
        const SizedBox(height: 24),
        Row(
          children: [
            ClassSigil(
              classKey: _selectedClass.toLowerCase(),
              label: className,
              size: 54,
              color: Palette.ink,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$raceName · $className',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                      color: Palette.ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'O arquétipo/subclasse será escolhido no nível permitido.',
                    style: TextStyle(color: Palette.inkSoft, fontSize: 14),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  // --- PASSO 2: Atributos-base e Bônus Raciais ---
  Widget _buildStep2() {
    final opts = _options;
    final abilityChoiceGroup = opts?.race.choices
        .where((c) => c.kind == 'ability')
        .firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Atributos D&D 5e',
          style: displayStyle(size: 24, color: Palette.ink),
        ),
        const SizedBox(height: 8),
        const Text(
          'Defina seus valores-base e visualize os bônus concedidos por sua linhagem.',
          style: TextStyle(color: Palette.inkSoft),
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _CombatSummaryCard(
              label: 'CA (Classe Armadura)',
              value: '$_calculatedAc',
            ),
            _CombatSummaryCard(
              label: 'PV Máximo (Nível 1)',
              value: '$_calculatedHp',
            ),
            _CombatSummaryCard(
              label: 'Iniciativa',
              value: _signed(_mod(_getFinal('des'))),
            ),
          ],
        ),
        const SizedBox(height: 20),
        // Escolha flexível racial (Meio-Elfo)
        if (abilityChoiceGroup != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: Palette.obsidianTint,
              border: Border.all(color: Palette.gold),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${abilityChoiceGroup.label} '
                  '(${_racialAbilityChoices.length} de ${abilityChoiceGroup.choose})',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Palette.goldBright,
                    fontFamily: 'Cinzel',
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    for (final opt in abilityChoiceGroup.options)
                      FilterChip(
                        selected: _racialAbilityChoices.contains(opt.id),
                        label: Text(opt.name),
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              if (_racialAbilityChoices.length <
                                  abilityChoiceGroup.choose) {
                                _racialAbilityChoices.add(opt.id);
                              }
                            } else {
                              _racialAbilityChoices.remove(opt.id);
                            }
                          });
                        },
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
        for (final k in _abilityKeys)
          _AttributeRow(
            label: _abilityLabels[k]!,
            baseValue: _getBase(k),
            bonusValue: _getRacialBonus(k),
            finalValue: _getFinal(k),
            mod: _mod(_getFinal(k)),
            onBaseChange: (v) => _setBase(k, v),
          ),
      ],
    );
  }

  // --- PASSO 3: Perícias, Idiomas & Ferramentas ---
  Widget _buildStep3() {
    final opts = _options;
    final fixedSkills = opts?.background.proficiencies ?? [];
    final classSkillGroup = opts?.characterClass.choices
        .where((c) => c.kind == 'skill')
        .firstOrNull;
    final raceSkillGroup =
        opts?.race.choices.where((c) => c.kind == 'skill').firstOrNull;

    final langGroups = [
      ...?opts?.race.choices.where((c) => c.kind == 'language'),
      ...?opts?.background.choices.where((c) => c.kind == 'language'),
    ];

    final toolGroups = [
      ...?opts?.characterClass.choices.where((c) => c.kind == 'tool'),
      ...?opts?.background.choices.where((c) => c.kind == 'tool'),
      ...?opts?.race.choices.where((c) => c.kind == 'tool'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Perícias, Idiomas & Ferramentas',
          style: displayStyle(size: 24, color: Palette.ink),
        ),
        const SizedBox(height: 8),
        const Text(
          'Selecione seus talentos e conhecimentos segundo sua classe e antecedente.',
          style: TextStyle(color: Palette.inkSoft),
        ),
        const SizedBox(height: 16),
        if (fixedSkills.isNotEmpty) ...[
          const SectionHeading('Perícias do Antecedente (Automáticas)'),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              for (final s in fixedSkills)
                Chip(
                  avatar: const Icon(Icons.check_circle, size: 16, color: Palette.goldBright),
                  label: Text(s.name),
                ),
            ],
          ),
          const SizedBox(height: 16),
        ],
        if (classSkillGroup != null) ...[
          SectionHeading(
            'Perícias de ${opts?.characterClass.name ?? "Classe"}: '
            '${_selectedClassSkills.length} de ${classSkillGroup.choose}',
          ),
          for (final opt in classSkillGroup.options) ...[
            Builder(builder: (context) {
              final isFixed = fixedSkills.any((f) => f.id == opt.id);
              final isSelected = _selectedClassSkills.contains(opt.id);
              final canSelect = isSelected ||
                  _selectedClassSkills.length < classSkillGroup.choose;
              return CheckboxListTile(
                title: Text(
                  isFixed ? '${opt.name} (já concedida pelo antecedente)' : opt.name,
                  style: TextStyle(
                    color: isFixed ? Palette.textDim : Palette.text,
                  ),
                ),
                value: isFixed || isSelected,
                onChanged: isFixed
                    ? null
                    : (checked) {
                        setState(() {
                          if (checked == true && canSelect) {
                            _selectedClassSkills.add(opt.id);
                          } else if (checked != true) {
                            _selectedClassSkills.remove(opt.id);
                          }
                        });
                      },
              );
            }),
          ],
          const SizedBox(height: 16),
        ],
        if (raceSkillGroup != null) ...[
          SectionHeading(
            'Perícias Raciais: '
            '${_selectedRaceSkills.length} de ${raceSkillGroup.choose}',
          ),
          for (final opt in raceSkillGroup.options) ...[
            Builder(builder: (context) {
              final isFixed = fixedSkills.any((f) => f.id == opt.id);
              final isClass = _selectedClassSkills.contains(opt.id);
              final isSelected = _selectedRaceSkills.contains(opt.id);
              final canSelect = isSelected ||
                  _selectedRaceSkills.length < raceSkillGroup.choose;
              final disabled = isFixed || isClass;
              return CheckboxListTile(
                title: Text(
                  disabled ? '${opt.name} (já escolhida)' : opt.name,
                  style: TextStyle(
                    color: disabled ? Palette.textDim : Palette.text,
                  ),
                ),
                value: disabled || isSelected,
                onChanged: disabled
                    ? null
                    : (checked) {
                        setState(() {
                          if (checked == true && canSelect) {
                            _selectedRaceSkills.add(opt.id);
                          } else if (checked != true) {
                            _selectedRaceSkills.remove(opt.id);
                          }
                        });
                      },
              );
            }),
          ],
          const SizedBox(height: 16),
        ],
        if (langGroups.isNotEmpty) ...[
          for (final lg in langGroups) ...[
            SectionHeading(
              '${lg.label}: ${_groupSelections(lg.id).length} de ${lg.choose}',
            ),
            for (final opt in lg.options)
              CheckboxListTile(
                title: Text(opt.name),
                value: _groupSelections(lg.id).contains(opt.id),
                onChanged: (checked) {
                  setState(() {
                    final current = _groupSelections(lg.id);
                    if (checked == true && current.length < lg.choose) {
                      current.add(opt.id);
                    } else if (checked != true) {
                      current.remove(opt.id);
                    }
                  });
                },
              ),
          ],
          const SizedBox(height: 16),
        ],
        if (toolGroups.isNotEmpty) ...[
          for (final tg in toolGroups) ...[
            SectionHeading(
              '${tg.label}: ${_groupSelections(tg.id).length} de ${tg.choose}',
            ),
            for (final opt in tg.options)
              CheckboxListTile(
                title: Text(opt.name),
                value: _groupSelections(tg.id).contains(opt.id),
                onChanged: (checked) {
                  setState(() {
                    final current = _groupSelections(tg.id);
                    if (checked == true && current.length < tg.choose) {
                      current.add(opt.id);
                    } else if (checked != true) {
                      current.remove(opt.id);
                    }
                  });
                },
              ),
          ],
        ],
      ],
    );
  }

  // --- PASSO 4: Equipamento Inicial ---
  Widget _buildStep4() {
    final eqGroups = _options?.equipment ?? [];

    if (eqGroups.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Equipamento Inicial',
            style: displayStyle(size: 24, color: Palette.ink),
          ),
          const SizedBox(height: 8),
          const Text(
            'Nenhuma escolha de equipamento pendente para esta classe.',
            style: TextStyle(color: Palette.inkSoft),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Equipamento Inicial',
          style: displayStyle(size: 24, color: Palette.ink),
        ),
        const SizedBox(height: 8),
        const Text(
          'Escolha os conjuntos de armas, armaduras e pacotes concedidos pela sua vocação.',
          style: TextStyle(color: Palette.inkSoft),
        ),
        const SizedBox(height: 16),
        for (final group in eqGroups) ...[
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Palette.obsidianTint,
              border: Border.all(color: const Color(0x38D4AF37)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Material(
              color: Colors.transparent,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    group.label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Palette.goldBright,
                    ),
                  ),
                  const SizedBox(height: 8),
                  RadioGroup<String>(
                    groupValue: _selectedEquipment[group.id],
                    onChanged: (v) {
                      if (v != null) {
                        setState(() => _selectedEquipment[group.id] = v);
                      }
                    },
                    child: Column(
                      children: [
                        for (final opt in group.options)
                          RadioListTile<String>(
                            title: Text(opt.name),
                            value: opt.id,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  // --- PASSO 5: Resumo Final ---
  Widget _buildStep5() {
    final opts = _options;
    final raceName = opts?.race.name ?? _selectedRace;
    final className = opts?.characterClass.name ?? _selectedClass;
    final bgName = opts?.background.name ?? _selectedBackground;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Resumo do Personagem',
          style: displayStyle(size: 24, color: Palette.ink),
        ),
        const SizedBox(height: 8),
        const Text(
          'Revise todos os detalhes antes de ingressar no reino.',
          style: TextStyle(color: Palette.inkSoft),
        ),
        const SizedBox(height: 16),
        Parchment(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _nameCtrl.text.isEmpty ? 'Herói sem nome' : _nameCtrl.text,
                style: displayStyle(size: 26, color: Palette.ink),
              ),
              Text(
                '$raceName · $className nível 1 · $bgName',
                style: const TextStyle(
                  color: Palette.inkSoft,
                  fontStyle: FontStyle.italic,
                  fontSize: 16,
                ),
              ),
              const Divider(color: Palette.brassDark, height: 24),
              const SectionHeading('Atributos Finais'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final k in _abilityKeys)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Palette.parchmentDeep,
                        border: Border.all(color: Palette.brassDark),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Column(
                        children: [
                          Text(
                            k.toUpperCase(),
                            style: const TextStyle(
                              fontFamily: 'Cinzel',
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                              color: Palette.inkEmph,
                            ),
                          ),
                          Text(
                            '${_getFinal(k)}',
                            style: const TextStyle(
                              fontFamily: 'Cinzel',
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Palette.ink,
                            ),
                          ),
                          Text(
                            _signed(_mod(_getFinal(k))),
                            style: const TextStyle(
                              fontSize: 12,
                              color: Palette.inkSoft,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const Divider(color: Palette.brassDark, height: 24),
              const SectionHeading('Combate'),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  Text('CA: $_calculatedAc', style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text('PV: $_calculatedHp', style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text('Iniciativa: ${_signed(_mod(_getFinal('des')))}', style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
              const Divider(color: Palette.brassDark, height: 24),
              const SectionHeading('Perícias'),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final s in opts?.background.proficiencies ?? [])
                    Chip(label: Text(s.name)),
                  for (final id in _selectedClassSkills)
                    Chip(
                      label: Text(
                        opts?.characterClass.choices
                                .where((c) => c.kind == 'skill')
                                .expand((c) => c.options)
                                .where((o) => o.id == id)
                                .firstOrNull
                                ?.name ??
                            id,
                      ),
                    ),
                  for (final id in _selectedRaceSkills)
                    Chip(
                      label: Text(
                        opts?.race.choices
                                .where((c) => c.kind == 'skill')
                                .expand((c) => c.options)
                                .where((o) => o.id == id)
                                .firstOrNull
                                ?.name ??
                            id,
                      ),
                    ),
                ],
              ),
              if (_selectedEquipment.isNotEmpty) ...[
                const Divider(color: Palette.brassDark, height: 24),
                const SectionHeading('Equipamento Selecionado'),
                for (final entry in _selectedEquipment.entries)
                  Builder(builder: (context) {
                    final itemOpt = opts?.equipment
                        .where((g) => g.id == entry.key)
                        .expand((g) => g.options)
                        .where((o) => o.id == entry.value)
                        .firstOrNull;
                    return Text('• ${itemOpt?.name ?? entry.value}');
                  }),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _StepTab extends StatelessWidget {
  const _StepTab({
    required this.index,
    required this.current,
    required this.label,
    required this.onSelect,
  });
  final int index, current;
  final String label;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final active = index == current;
    return GestureDetector(
      onTap: onSelect,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? Palette.gold : const Color(0xFF161622),
          border: Border.all(
            color: active ? Palette.goldBright : const Color(0x38D4AF37),
          ),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? const Color(0xFF09090C) : Palette.textDim,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            fontFamily: 'Cinzel',
            fontSize: 12,
            letterSpacing: 0.6,
          ),
        ),
      ),
    );
  }
}

class _CombatSummaryCard extends StatelessWidget {
  const _CombatSummaryCard({required this.label, required this.value});
  final String label, value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Palette.obsidianTint,
        border: Border.all(color: const Color(0x50D4AF37), width: 1.5),
        borderRadius: BorderRadius.circular(8),
        boxShadow: const [
          BoxShadow(
            color: Color(0x30000000),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: Palette.textDim,
              fontFamily: 'Cinzel',
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: Palette.goldBright,
              fontFamily: 'Cinzel',
            ),
          ),
        ],
      ),
    );
  }
}

class _AttributeRow extends StatelessWidget {
  const _AttributeRow({
    required this.label,
    required this.baseValue,
    required this.bonusValue,
    required this.finalValue,
    required this.mod,
    required this.onBaseChange,
  });

  final String label;
  final int baseValue, bonusValue, finalValue, mod;
  final ValueChanged<int> onBaseChange;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Palette.obsidianTint,
          border: Border.all(color: const Color(0x28D4AF37)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: Palette.text,
                      fontSize: 15,
                    ),
                  ),
                  Text(
                    'Base: $baseValue ${bonusValue != 0 ? (bonusValue > 0 ? "+ $bonusValue racial" : "$bonusValue racial") : ""}',
                    style: const TextStyle(
                      color: Palette.textDim,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF1B1B26),
                border: Border.all(color: const Color(0x40D4AF37)),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                mod >= 0 ? '+$mod' : '$mod',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Palette.goldBright,
                  fontFamily: 'Cinzel',
                ),
              ),
            ),
            const SizedBox(width: 12),
            IconButton(
              icon: const Icon(
                Icons.remove_circle_outline,
                size: 22,
                color: Palette.gold,
              ),
              onPressed: baseValue > 6 ? () => onBaseChange(baseValue - 1) : null,
            ),
            SizedBox(
              width: 32,
              child: Text(
                '$finalValue',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'Cinzel',
                  color: Palette.text,
                ),
              ),
            ),
            IconButton(
              icon: const Icon(
                Icons.add_circle_outline,
                size: 22,
                color: Palette.gold,
              ),
              onPressed: baseValue < 18 ? () => onBaseChange(baseValue + 1) : null,
            ),
          ],
        ),
      ),
    );
  }
}
