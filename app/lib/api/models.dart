// Modelos do contrato engine/API.md (GameView). Leitura tolerante: campo ausente vira padrão.

typedef Json = Map<String, dynamic>;

String _s(Object? v, [String d = '']) => v is String ? v : d;
int _i(Object? v, [int d = 0]) => v is num ? v.toInt() : d;
bool _b(Object? v) => v == true;
List<Json> _l(Object? v) => v is List ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList() : const [];
List<String> _ls(Object? v) => v is List ? v.whereType<String>().toList() : const [];

class Campaign {
  Campaign(this.slug, this.name);
  final String slug, name;
  factory Campaign.fromJson(Json j) => Campaign(_s(j['slug']), _s(j['name']));
}

class Ability {
  Ability(this.score, this.mod, this.save, this.proficientSave);
  final int score, mod, save;
  final bool proficientSave;
}

class Skill {
  Skill(this.label, this.ability, this.bonus, this.proficient, this.expertise);
  final String label, ability;
  final int bonus;
  final bool proficient, expertise;
}

class Slot {
  Slot(this.level, this.max, this.used);
  final int level, max, used;
}

class Item {
  Item.fromJson(Json j)
      : id = _s(j['id']),
        name = _s(j['name']),
        qty = _i(j['qty'], 1),
        kind = _s(j['kind']),
        equipped = _b(j['equipped']),
        drawn = _b(j['drawn']),
        notes = _s(j['notes']),
        effect = j['effect'] as String?,
        rarity = knownRarity(j['rarity'] is String ? j['rarity'] as String : (j['props'] is Map ? (j['props'] as Map)['rarity'] : null)),
        actions = _ls(j['actions']);
  final String id, name, kind, notes;
  final int qty;
  final bool equipped, drawn;
  final String? effect, rarity;
  final List<String> actions;
}

/// Raridades que o motor reconhece. Qualquer outro texto vira null.
String? knownRarity(Object? raw) {
  if (raw is! String || raw.trim().isEmpty) return null;
  final folded = raw.toLowerCase().replaceAll(RegExp(r'[áàãâ]'), 'a').replaceAll(RegExp(r'[éê]'), 'e').replaceAll(RegExp(r'[íî]'), 'i').replaceAll(RegExp(r'[óôõ]'), 'o').replaceAll(RegExp(r'[úü]'), 'u').replaceAll(RegExp(r'[^a-z]'), '');
  return switch (folded) {
    'comum' || 'common' => 'comum',
    'incomum' || 'uncommon' => 'incomum',
    'raro' || 'rare' => 'raro',
    'muitoraro' || 'veryrare' => 'muito raro',
    'lendario' || 'legendary' => 'lendário',
    'artefato' || 'artifact' => 'artefato',
    _ => null,
  };
}

class Pc {
  Pc.fromJson(Json j)
      : id = _s(j['id']),
        name = _s(j['name']),
        race = _s(j['race']),
        classKey = _s(j['class']),
        classLabel = _s(j['classLabel']),
        subclass = _s(j['subclass']),
        background = _s(j['background']),
        level = _i(j['level'], 1),
        xp = _i(j['xp']),
        nextLevelXp = j['nextLevelXp'] is num ? _i(j['nextLevelXp']) : null,
        levelUpReady = _b(j['levelUpReady']),
        hp = _i(j['hp']),
        maxHp = _i(j['maxHp'], 1),
        tempHp = _i(j['tempHp']),
        ac = _i(j['ac']),
        speed = _i(j['speed']),
        initiative = _i(j['initiative']),
        profBonus = _i(j['profBonus']),
        status = _s(j['status'], 'vivo'),
        passivePerception = _i(j['passivePerception']),
        conditions = _ls(j['conditions']),
        deathSuccess = _i((j['death'] as Map?)?['success']),
        deathFail = _i((j['death'] as Map?)?['fail']),
        abilities = {
          for (final e in ((j['abilities'] as Map?) ?? {}).entries)
            e.key as String: Ability(_i(e.value['score']), _i(e.value['mod']), _i(e.value['save']), _b(e.value['proficientSave'])),
        },
        skills = _l(j['skills']).map((s) => Skill(_s(s['label']), _s(s['ability']), _i(s['bonus']), _b(s['proficient']), _b(s['expertise']))).toList(),
        spellSaveDc = (j['spellcasting'] as Map?)?['saveDc'] is num ? _i((j['spellcasting'] as Map)['saveDc']) : null,
        spellAttack = (j['spellcasting'] as Map?)?['attackBonus'] is num ? _i((j['spellcasting'] as Map)['attackBonus']) : null,
        spellAbilityLabel = _opt((j['spellcasting'] as Map?)?['abilityLabel']),
        slots = _l((j['spellcasting'] as Map?)?['slots']).map((s) => Slot(_i(s['level']), _i(s['max']), _i(s['used']))).toList(),
        spells = _ls((j['spellcasting'] as Map?)?['spells']),
        hitDie = _i((j['hitDice'] as Map?)?['die']),
        hitDiceMax = _i((j['hitDice'] as Map?)?['max']),
        hitDiceUsed = _i((j['hitDice'] as Map?)?['used']),
        portrait = _opt(j['portrait']),
        po = _i((j['money'] as Map?)?['po']),
        pp = _i((j['money'] as Map?)?['pp']),
        pcCoins = _i((j['money'] as Map?)?['pc']),
        inventory = _l(j['inventory']).map(Item.fromJson).toList(),
        features = _ls(j['features']),
        featureDetails = _l(j['featureDetails']).map(FeatureDetail.fromJson).toList(),
        resources = _l(j['resources']).map(TrackedResource.fromJson).toList(),
        pendingChoices = _l(j['pendingChoices']).map((c) => '${_s(c['name'])}: escolha ${_i(c['choose'])} — ${_l(c['options']).map((o) => _s(o['name'])).join(', ')}').toList();
  final String id, name, race, classKey, classLabel, subclass, background, status;
  final int level, xp, hp, maxHp, tempHp, ac, speed, initiative, profBonus, passivePerception, deathSuccess, deathFail, po, pp, pcCoins, hitDie, hitDiceMax, hitDiceUsed;
  final int? nextLevelXp, spellSaveDc, spellAttack;
  final String? spellAbilityLabel, portrait;
  final bool levelUpReady;
  final List<String> conditions, spells, features;
  final Map<String, Ability> abilities;
  final List<Skill> skills;
  final List<Slot> slots;
  final List<Item> inventory;
  final List<FeatureDetail> featureDetails;
  final List<TrackedResource> resources;
  final List<String> pendingChoices;
}

class FeatureDetail {
  FeatureDetail.fromJson(Json j) : name = _s(j['name']), description = _s(j['description']), source = _s(j['source']);
  final String name, description, source;
}

class TrackedResource {
  TrackedResource.fromJson(Json j)
      : id = _s(j['id']), name = _s(j['name']), effect = _s(j['effect']),
        max = _i(j['max']), used = _i(j['used']), resetsOn = _s(j['resets_on']),
        unlimited = _b(j['unlimited']), available = _b(j['available']);
  final String id, name, effect, resetsOn;
  final int max, used;
  final bool unlimited, available;
}

class Exit {
  Exit(this.id, this.name, this.minutes, this.via);
  final String id, name, via;
  final int minutes;
}

class Location {
  Location.fromJson(Json j)
      : id = _s(j['id']),
        name = _s(j['name']),
        kind = _s(j['kind']),
        summary = _s(j['summary']),
        details = _s(j['details']),
        parent = (j['parent'] as Map?)?['name'] as String?,
        exits = _l(j['exits']).map((e) => Exit(_s(e['id']), _s(e['name']), _i(e['minutes']), _s(e['via']))).toList(),
        items = _l(j['items']).map(Item.fromJson).toList();
  final String id, name, kind, summary, details;
  final String? parent;
  final List<Exit> exits;
  final List<Item> items;
}

class Npc {
  Npc.fromJson(Json j)
      : id = _s(j['id']),
        name = _s(j['name']),
        summary = _s(j['summary']),
        status = _s(j['status']),
        attitude = _i(j['attitude']),
        attitudeLabel = _s(j['attitudeLabel'], 'neutro'),
        companion = _b(j['companion']),
        hp = j['hp'] is num ? _i(j['hp']) : null,
        maxHp = j['maxHp'] is num ? _i(j['maxHp']) : null,
        reaction = j['reaction'] as String?,
        portrait = _opt(j['portrait']);
  final String id, name, summary, status, attitudeLabel;
  final int attitude;
  final bool companion;
  final int? hp, maxHp;
  final String? reaction, portrait;
}

class Combatant {
  Combatant.fromJson(Json j)
      : id = _s(j['id']),
        name = _s(j['name']),
        initiative = _i(j['initiative']),
        hp = _i(j['hp']),
        maxHp = _i(j['maxHp'], 1),
        status = _s(j['status']),
        current = _b(j['current']),
        isPc = _b(j['isPc']),
        portrait = _opt(j['portrait']);
  final String id, name, status;
  final int initiative, hp, maxHp;
  final bool current, isPc;
  final String? portrait;
}

class Quest {
  Quest.fromJson(Json j)
      : id = _s(j['id']),
        title = _s(j['title']),
        summary = _s(j['summary']),
        status = _s(j['status']),
        giver = j['giver'] as String?,
        objectives = _l(j['objectives']).map((o) => (_s(o['text']), _b(o['done']))).toList();
  final String id, title, summary, status;
  final String? giver;
  final List<(String, bool)> objectives;
}

class Turn {
  Turn.fromJson(Json j)
      : n = _i(j['n']),
        day = _i(j['day']),
        time = _s(j['time']),
        action = _s(j['action']),
        summary = _s(j['summary']),
        narration = _s(j['narration']);
  final int n, day;
  final String time, action, summary, narration;
}

class MapPlace {
  MapPlace.fromJson(Json j)
      : id = _s(j['id']),
        name = _s(j['name']),
        kind = _s(j['kind']),
        parent = j['parent'] as String?,
        visited = _b(j['visited']),
        current = _b(j['current']);
  final String id, name, kind;
  final String? parent;
  final bool visited, current;
}

class Fact {
  Fact.fromJson(Json j)
      : id = _i(j['id']),
        text = _s(j['text']),
        about = _opt(j['about']),
        day = _i(j['day']);
  final int id, day;
  final String text;
  final String? about;
}

class MapLink {
  MapLink(this.from, this.to, this.minutes, [this.via = '']);
  final String from, to, via;
  final int minutes;
}

String? _opt(Object? v) => v is String && v.trim().isNotEmpty ? v.trim() : null;

class RollRequest {
  RollRequest.fromJson(Json j)
      : id = _i(j['id']),
        whoName = _s(j['whoName']),
        kind = _s(j['kind']),
        label = _s(j['label']),
        dice = _l(j['dice']).map((d) => _i(d['sides'], 20)).toList(),
        mode = _s(j['mode'], 'normal'),
        modifier = _i(j['modifier']),
        dc = j['dc'] is num ? _i(j['dc']) : null,
        reason = _s(j['reason']);
  final int id, modifier;
  final int? dc;
  final String whoName, kind, label, mode, reason;
  final List<int> dice;
}

class RollOutcome {
  RollOutcome.fromJson(Json j)
      : id = _i(j['id']),
        label = _s(j['label']),
        whoName = _s(j['whoName']),
        dice = (j['dice'] as List? ?? []).map((e) => _i(e)).toList(),
        kept = (j['kept'] as List? ?? []).map((e) => _i(e)).toList(),
        modifier = _i(j['modifier']),
        total = _i(j['total']),
        dc = j['dc'] is num ? _i(j['dc']) : null,
        outcome = j['outcome'] as String?,
        source = _s(j['source']);
  final int id, modifier, total;
  final int? dc;
  final String label, whoName, source;
  final String? outcome;
  final List<int> dice, kept;
}

class ChatMessage {
  ChatMessage.fromJson(Json j)
      : id = _i(j['id']),
        role = _s(j['role']),
        text = _s(j['text']),
        status = _s(j['status']),
        error = _s(j['error']);
  final int id;
  final String role, text, status, error;
}

class MasterState {
  MasterState.fromJson(Json? j)
      : status = _s(j?['status'], 'ocioso'),
        activity = j?['activity'] as String?,
        error = j?['error'] as String?;
  final String status;
  final String? activity, error;
  bool get busy => status == 'pensando' || status == 'na_fila';
}

class GameView {
  GameView.fromJson(Json j)
      : version = _i(j['version']),
        campaignName = _s((j['campaign'] as Map?)?['name']),
        premise = _s((j['campaign'] as Map?)?['premise']),
        tone = _s((j['campaign'] as Map?)?['tone']),
        day = _i((j['clock'] as Map?)?['day'], 1),
        time = _s((j['clock'] as Map?)?['time']),
        period = _s((j['clock'] as Map?)?['period']),
        turnOpen = _b((j['turn'] as Map?)?['open']),
        pc = j['pc'] is Map ? Pc.fromJson((j['pc'] as Map).cast()) : null,
        location = j['location'] is Map ? Location.fromJson((j['location'] as Map).cast()) : null,
        present = _l(j['present']).map(Npc.fromJson).toList(),
        combatRound = (j['combat'] as Map?)?['round'] as int?,
        combat = _l((j['combat'] as Map?)?['order']).map(Combatant.fromJson).toList(),
        quests = _l(j['quests']).map(Quest.fromJson).toList(),
        facts = _l(j['facts']).map(Fact.fromJson).toList(),
        journal = _l(j['journal']).map(Turn.fromJson).toList(),
        places = _l((j['map'] as Map?)?['places']).map(MapPlace.fromJson).toList(),
        links = _l((j['map'] as Map?)?['links']).map((l) => MapLink(_s(l['from']), _s(l['to']), _i(l['minutes']), _s(l['via']))).toList(),
        pendingRolls = _l(j['pendingRolls']).map(RollRequest.fromJson).toList(),
        lastRolls = _l(j['lastRolls']).map(RollOutcome.fromJson).toList(),
        chat = _l(j['chat']).map(ChatMessage.fromJson).toList(),
        master = MasterState.fromJson((j['master'] as Map?)?.cast());
  final int version, day;
  final String campaignName, premise, tone, time, period;
  final bool turnOpen;
  final Pc? pc;
  final Location? location;
  final List<Npc> present;
  final int? combatRound;
  final List<Combatant> combat;
  final List<Quest> quests;
  final List<Fact> facts;
  final List<Turn> journal;
  final List<MapPlace> places;
  final List<MapLink> links;
  final List<RollRequest> pendingRolls;
  final List<RollOutcome> lastRolls;
  final List<ChatMessage> chat;
  final MasterState master;

  /// Última narração do Mestre (ou do diário, se a campanha ainda não tem conversa).
  String get latestNarration {
    final m = chat.lastWhere((c) => c.role == 'mestre', orElse: () => ChatMessage.fromJson(const {}));
    if (m.text.isNotEmpty) return m.text;
    return journal.isNotEmpty ? journal.last.narration : '';
  }
}
