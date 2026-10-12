import 'package:flutter/material.dart';

import '../api/client.dart';
import '../theme.dart';
import 'fantasy/chrome.dart';
import 'fantasy/sigils.dart';

class CharacterCreationScreen extends StatefulWidget {
  const CharacterCreationScreen({
    super.key,
    required this.api,
    required this.campaignSlug,
    required this.onCreated,
  });

  final ApiClient api;
  final String campaignSlug;
  final VoidCallback onCreated;

  @override
  State<CharacterCreationScreen> createState() => _CharacterCreationScreenState();
}

class _CharacterCreationScreenState extends State<CharacterCreationScreen> {
  final _nameCtrl = TextEditingController(text: 'Valeros');
  int _step = 0;
  bool _submitting = false;
  String? _error;

  String _race = 'Humano';
  String _class = 'Guerreiro';
  String _subclass = 'campeao';
  String _background = 'Herói do Povo';

  int _str = 15;
  int _dex = 13;
  int _con = 14;
  int _int = 10;
  int _wis = 12;
  int _cha = 8;

  final Map<String, List<String>> _subclassesByClass = {
    'Guerreiro': ['campeao', 'mestre_da_batalha', 'cavaleiro_mistico'],
    'Ladino': ['ladrao', 'assassino', 'trapaceiro_arcano'],
    'Mago': ['evocacao', 'abjuracao', 'adivinhacao'],
    'Clerigo': ['vida', 'guerra', 'luz'],
    'Barbaro': ['furioso', 'totem'],
    'Bardo': ['lore', 'bravura'],
    'Druida': ['terra', 'lua'],
    'Monge': ['palmaaberta', 'sombra'],
    'Paladino': ['devocao', 'vinganca'],
    'Patrulheiro': ['cacador', 'senhor_das_feras'],
    'Feiticeiro': ['linhagemdraconica', 'magiaselvagem'],
    'Bruxo': ['corruptor', 'arquifada'],
  };

  final Map<String, String> _subclassLabels = {
    'campeao': 'Campeão (Crítico expandido)',
    'mestre_da_batalha': 'Mestre da Batalha (Manobras)',
    'cavaleiro_mistico': 'Cavaleiro Místico (Magias marciais)',
    'ladrao': 'Ladrão (Furtividade & Mãos Rápidas)',
    'assassino': 'Assassino (Golpes letais)',
    'trapaceiro_arcano': 'Trapaceiro Arcano (Truques e Ilusões)',
    'evocacao': 'Escola de Evocação (Poder elemental)',
    'abjuracao': 'Escola de Abjuração (Proteção e Barreiras)',
    'adivinhacao': 'Escola de Adivinhação (Presságio)',
    'vida': 'Domínio da Vida (Cura suprema)',
    'guerra': 'Domínio da Guerra (Combate divino)',
    'luz': 'Domínio da Luz (Chama celestial)',
    'furioso': 'Caminho do Furioso (Frenesi)',
    'totem': 'Guerreiro Totêmico (Espírito Animal)',
    'lore': 'Colégio do Conhecimento (Perícias extras)',
    'bravura': 'Colégio da Bravura (Inspiração em combate)',
    'terra': 'Círculo da Terra (Magia dos biomas)',
    'lua': 'Círculo da Lua (Formas selvagens poderosas)',
    'palmaaberta': 'Caminho da Palma Aberta (Técnicas de Ki)',
    'sombra': 'Caminho das Sombras (Furtividade ninja)',
    'devocao': 'Juramento de Devoção (Luz sagrada)',
    'vinganca': 'Juramento de Vingança (Punição implacável)',
    'cacador': 'Caçador (Predador do ermo)',
    'senhor_das_feras': 'Senhor das Feras (Companheiro animal)',
    'linhagemdraconica': 'Linhagem Dracônica (Resistência e escamas)',
    'magiaselvagem': 'Magia Selvagem (Surtos imprevisíveis)',
    'corruptor': 'O Corruptor (Vitalidade sombria)',
    'arquifada': 'A Arquifada (Encantamento e ilusão)',
  };

  final List<String> _races = [
    'Humano',
    'Elfo',
    'Anão',
    'Halfling',
    'Draconato',
    'Gnomo',
    'Meio-Elfo',
    'Meio-Orc',
    'Tiefling',
  ];

  final List<String> _classes = [
    'Guerreiro',
    'Ladino',
    'Mago',
    'Clérigo',
    'Bárbaro',
    'Bardo',
    'Druida',
    'Monge',
    'Paladino',
    'Patrulheiro',
    'Feiticeiro',
    'Bruxo',
  ];

  final List<String> _backgrounds = [
    'Herói do Povo',
    'Acólito',
    'Criminoso',
    'Soldado',
    'Sábio',
    'Nobre',
    'Forasteiro',
    'Charlatão',
    'Artista',
    'Marinheiro',
    'Eremita',
  ];

  int _mod(int val) => ((val - 10) / 2).floor();
  String _signed(int val) => val >= 0 ? '+$val' : '$val';

  int get _calculatedAc {
    final dexMod = _mod(_dex);
    switch (_class) {
      case 'Guerreiro':
      case 'Paladino':
        return 16; // Cota de malha inicial
      case 'Barbaro':
        return 10 + dexMod + _mod(_con); // Defesa sem armadura
      case 'Monge':
        return 10 + dexMod + _mod(_wis); // Defesa sem armadura
      case 'Ladino':
      case 'Patrulheiro':
        return 11 + dexMod; // Armadura de couro
      default:
        return 10 + dexMod;
    }
  }

  int get _calculatedHp {
    final conMod = _mod(_con);
    final die = switch (_class) {
      'Bárbaro' => 12,
      'Guerreiro' || 'Paladino' || 'Patrulheiro' => 10,
      'Mago' || 'Feiticeiro' => 6,
      _ => 8,
    };
    return die + conMod;
  }

  void _onClassChanged(String newClass) {
    setState(() {
      _class = newClass;
      final subs = _subclassesByClass[newClass] ?? [];
      _subclass = subs.isNotEmpty ? subs.first : '';
      // Sugere atributos clássicos da classe
      switch (newClass) {
        case 'Guerreiro':
        case 'Paladino':
        case 'Bárbaro':
          _str = 15; _con = 14; _dex = 13; _wis = 12; _int = 10; _cha = 8;
          break;
        case 'Ladino':
        case 'Monge':
        case 'Patrulheiro':
          _dex = 15; _con = 14; _wis = 13; _str = 12; _int = 10; _cha = 8;
          break;
        case 'Mago':
          _int = 15; _con = 14; _dex = 13; _wis = 12; _cha = 10; _str = 8;
          break;
        case 'Clérigo':
        case 'Druida':
          _wis = 15; _con = 14; _str = 13; _dex = 12; _int = 10; _cha = 8;
          break;
        case 'Bardo':
        case 'Bruxo':
        case 'Feiticeiro':
          _cha = 15; _con = 14; _dex = 13; _wis = 12; _int = 10; _str = 8;
          break;
      }
    });
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final payload = {
        'name': _nameCtrl.text.trim().isEmpty ? 'Valeros' : _nameCtrl.text.trim(),
        'race': _race,
        'class': _class,
        'subclass': _subclass,
        'background': _background,
        'level': 1,
        'ac': _calculatedAc,
        'hp': _calculatedHp,
        'abilities': {
          'for': _str,
          'des': _dex,
          'con': _con,
          'int': _int,
          'sab': _wis,
          'car': _cha,
        },
      };

      await widget.api.createPc(widget.campaignSlug, payload);
      if (mounted) widget.onCreated();
    } catch (e) {
      setState(() => _error = 'Erro ao criar ficha: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Criação de Personagem'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Barra de passos
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
              color: Palette.brassDark,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _StepTab(index: 0, current: _step, label: 'Identidade', onSelect: () => setState(() => _step = 0)),
                  _StepTab(index: 1, current: _step, label: 'Raça & Classe', onSelect: () => setState(() => _step = 1)),
                  _StepTab(index: 2, current: _step, label: 'Atributos & Resumo', onSelect: () => setState(() => _step = 2)),
                ],
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
                child: Text(_error!, style: const TextStyle(color: Palette.failure)),
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_step == 0) _buildStep0(),
                  if (_step == 1) _buildStep1(),
                  if (_step == 2) _buildStep2(),
                ],
              ),
            ),
            // Rodapé de Ação
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Palette.leather,
                border: Border(top: BorderSide(color: Palette.brassDark)),
              ),
              child: Row(
                children: [
                  if (_step > 0)
                    TextButton.icon(
                      onPressed: () => setState(() => _step--),
                      icon: const Icon(Icons.arrow_back),
                      label: const Text('Anterior'),
                    ),
                  const Spacer(),
                  if (_step < 2)
                    FilledButton.icon(
                      onPressed: () => setState(() => _step++),
                      icon: const Icon(Icons.arrow_forward),
                      label: const Text('Próximo'),
                    )
                  else
                    FilledButton.icon(
                      onPressed: _submitting ? null : _submit,
                      icon: _submitting
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.shield),
                      label: const Text('Concluir & Entrar no Reino'),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep0() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Identidade do Aventureiro', style: displayStyle(size: 24, color: Palette.ink)),
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
          initialValue: _background,
          decoration: const InputDecoration(
            labelText: 'Antecedente (Histórico)',
            prefixIcon: Icon(Icons.menu_book, color: Palette.gold),
          ),
          items: _backgrounds.map((b) => DropdownMenuItem(value: b, child: Text(b))).toList(),
          onChanged: (v) => setState(() => _background = v ?? 'Herói do Povo'),
        ),
        const SizedBox(height: 24),
        Parchment(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Resumo Inicial', style: displayStyle(size: 18, color: Palette.ink)),
              const SizedBox(height: 6),
              Text(
                '${_nameCtrl.text.isEmpty ? "Seu Herói" : _nameCtrl.text}, um $_race $_class de antecedente $_background.',
                style: const TextStyle(color: Palette.ink, fontStyle: FontStyle.italic),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStep1() {
    final subs = _subclassesByClass[_class] ?? [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Raça, Classe e Arquétipo', style: displayStyle(size: 24, color: Palette.ink)),
        const SizedBox(height: 8),
        const Text(
          'Escolha sua linhagem e a vocação heroica segundo o Livro do Jogador 5e.',
          style: TextStyle(color: Palette.inkSoft),
        ),
        const SizedBox(height: 20),
        DropdownButtonFormField<String>(
          initialValue: _race,
          decoration: const InputDecoration(
            labelText: 'Raça',
            prefixIcon: Icon(Icons.person, color: Palette.gold),
          ),
          items: _races.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
          onChanged: (v) => setState(() => _race = v ?? 'Humano'),
        ),
        const SizedBox(height: 18),
        DropdownButtonFormField<String>(
          initialValue: _class,
          decoration: const InputDecoration(
            labelText: 'Classe Primária',
            prefixIcon: Icon(Icons.auto_stories, color: Palette.gold),
          ),
          items: _classes.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
          onChanged: (v) => _onClassChanged(v ?? 'Guerreiro'),
        ),
        if (subs.isNotEmpty) ...[
          const SizedBox(height: 18),
          DropdownButtonFormField<String>(
            initialValue: subs.contains(_subclass) ? _subclass : subs.first,
            decoration: const InputDecoration(
              labelText: 'Arquétipo / Subclasse Planejada',
              prefixIcon: Icon(Icons.star_outline, color: Palette.gold),
            ),
            items: subs.map((s) => DropdownMenuItem(value: s, child: Text(_subclassLabels[s] ?? s))).toList(),
            onChanged: (v) => setState(() => _subclass = v ?? subs.first),
          ),
        ],
        const SizedBox(height: 24),
        Row(
          children: [
            ClassSigil(classKey: _class.toLowerCase(), label: _class, size: 54, color: Palette.ink),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('$_race · $_class', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: Palette.ink)),
                  Text(
                    'Arquétipo: ${_subclassLabels[_subclass] ?? _subclass}',
                    style: const TextStyle(color: Palette.inkSoft, fontSize: 14),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStep2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Atributos D&D 5e', style: displayStyle(size: 24, color: Palette.ink)),
        const SizedBox(height: 8),
        const Text(
          'Distribua seus atributos para definir seus testes, salvaguardas e perícias.',
          style: TextStyle(color: Palette.inkSoft),
        ),
        const SizedBox(height: 16),
        // Estatísticas de Combate
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _CombatSummaryCard(label: 'CA (Classe Armadura)', value: '$_calculatedAc'),
            _CombatSummaryCard(label: 'PV Máximo (Nível 1)', value: '$_calculatedHp'),
            _CombatSummaryCard(label: 'Iniciativa', value: _signed(_mod(_dex))),
          ],
        ),
        const SizedBox(height: 20),
        _AttributeRow(label: 'Força (FOR)', value: _str, mod: _mod(_str), onChange: (v) => setState(() => _str = v)),
        _AttributeRow(label: 'Destreza (DES)', value: _dex, mod: _mod(_dex), onChange: (v) => setState(() => _dex = v)),
        _AttributeRow(label: 'Constituição (CON)', value: _con, mod: _mod(_con), onChange: (v) => setState(() => _con = v)),
        _AttributeRow(label: 'Inteligência (INT)', value: _int, mod: _mod(_int), onChange: (v) => setState(() => _int = v)),
        _AttributeRow(label: 'Sabedoria (SAB)', value: _wis, mod: _mod(_wis), onChange: (v) => setState(() => _wis = v)),
        _AttributeRow(label: 'Carisma (CAR)', value: _cha, mod: _mod(_cha), onChange: (v) => setState(() => _cha = v)),
      ],
    );
  }
}

class _StepTab extends StatelessWidget {
  const _StepTab({required this.index, required this.current, required this.label, required this.onSelect});
  final int index, current;
  final String label;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final active = index == current;
    return GestureDetector(
      onTap: onSelect,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? Palette.gold : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? Palette.parchment : Palette.parchmentDeep,
            fontWeight: active ? FontWeight.w700 : FontWeight.normal,
            fontSize: 13,
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
        color: Palette.parchmentDeep,
        border: Border.all(color: Palette.brassDark, width: 2),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Palette.inkSoft)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Palette.ink, fontFamily: 'Cinzel')),
        ],
      ),
    );
  }
}

class _AttributeRow extends StatelessWidget {
  const _AttributeRow({required this.label, required this.value, required this.mod, required this.onChange});
  final String label;
  final int value, mod;
  final ValueChanged<int> onChange;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, color: Palette.ink))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: Palette.parchmentDeep,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(mod >= 0 ? '+$mod' : '$mod', style: const TextStyle(fontWeight: FontWeight.w700, color: Palette.gold)),
          ),
          const SizedBox(width: 12),
          IconButton(
            icon: const Icon(Icons.remove_circle_outline, size: 20),
            onPressed: value > 6 ? () => onChange(value - 1) : null,
          ),
          Text('$value', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, fontFamily: 'Cinzel')),
          IconButton(
            icon: const Icon(Icons.add_circle_outline, size: 20),
            onPressed: value < 20 ? () => onChange(value + 1) : null,
          ),
        ],
      ),
    );
  }
}
