import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Preferências locais da mesa. Não alteram regra nenhuma: só leitura, vibração e som do sistema.
class PlaySettings extends ChangeNotifier {
  static const panelIds = ['ficha', 'bolsa', 'grimorio', 'missoes', 'pessoas', 'mapa'];
  static final fallback = PlaySettings();

  bool largeText = false;
  bool haptics = true;
  bool sounds = false;
  /// 0 menor, 1 leitura, 2 maior. Só o diário em destaque.
  int narrationStep = 1;
  static const narrationSizes = <double>[18, 22, 26];
  List<String> panelOrder = [...panelIds];
  SharedPreferences? _prefs;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _prefs = prefs;
    largeText = prefs.getBool('ui.largeText') ?? false;
    haptics = prefs.getBool('ui.haptics') ?? true;
    sounds = prefs.getBool('ui.sounds') ?? false;
    narrationStep = (prefs.getInt('ui.narrationStep') ?? 1).clamp(0, narrationSizes.length - 1);
    final saved = prefs.getString('ui.panelOrder');
    if (saved != null) {
      final parts = saved.split(',').where(panelIds.contains).toList();
      for (final id in panelIds) {
        if (!parts.contains(id)) parts.add(id);
      }
      panelOrder = parts;
    }
    notifyListeners();
  }

  Future<void> setLargeText(bool value) async {
    largeText = value;
    notifyListeners();
    await _prefs?.setBool('ui.largeText', value);
  }

  Future<void> setHaptics(bool value) async {
    haptics = value;
    notifyListeners();
    await _prefs?.setBool('ui.haptics', value);
  }

  Future<void> setSounds(bool value) async {
    sounds = value;
    notifyListeners();
    await _prefs?.setBool('ui.sounds', value);
  }

  double get narrationSize => narrationSizes[narrationStep.clamp(0, narrationSizes.length - 1)];

  Future<void> setNarrationStep(int value) async {
    narrationStep = value.clamp(0, narrationSizes.length - 1);
    notifyListeners();
    await _prefs?.setInt('ui.narrationStep', narrationStep);
  }

  Future<void> setPanelOrder(List<String> next) async {
    panelOrder = [...next];
    notifyListeners();
    await _prefs?.setString('ui.panelOrder', panelOrder.join(','));
  }
}

class PlaySettingsScope extends InheritedNotifier<PlaySettings> {
  const PlaySettingsScope({super.key, required PlaySettings notifier, required super.child}) : super(notifier: notifier);

  static PlaySettings of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<PlaySettingsScope>();
    return scope?.notifier ?? PlaySettings.fallback;
  }
}

void tableFeedback(BuildContext context, {bool heavy = false}) {
  final settings = PlaySettingsScope.of(context);
  if (settings.haptics) {
    if (heavy) {
      HapticFeedback.heavyImpact();
    } else {
      HapticFeedback.selectionClick();
    }
  }
  if (settings.sounds) SystemSound.play(heavy ? SystemSoundType.alert : SystemSoundType.click);
}
