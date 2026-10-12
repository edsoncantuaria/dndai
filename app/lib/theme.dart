import 'package:flutter/material.dart';

/// Identidade visual Baldur's Gate 3 e D&D Oficial:
/// Obsidian profundo (#050506), painéis em relevo (#121216/#13131A),
/// ouro nobre polido (#D4AF37 / #F0D878), brasas ember (#E40712)
/// e tipografia marfim cristalina (#F7F0E3) de altíssima legibilidade.
class Palette {
  // Obsidian base e painéis
  static const obsidian = Color(0xFF050506);
  static const obsidianRaised = Color(0xFF101015);
  static const obsidianTint = Color(0xFF181822);

  // Aliases compatíveis com o código do app
  static const leather = obsidian;
  static const leatherRaised = obsidianRaised;
  static const brass = Color(0xFFD4AF37);
  static const brassDark = Color(0xFF7A6520);
  static const parchment = Color(0xFF13131A);
  static const parchmentDeep = Color(0xFF1A1A24);
  static const ink = Color(0xFFF7F0E3);
  static const inkSoft = Color(0xFFA8A29E);
  static const inkEmph = Color(0xFFF0D878);

  static const bg = obsidian;
  static const surface = obsidianRaised;
  static const surfaceHigh = obsidianTint;
  static const line = Color(0xFF2E2A24);
  static const gold = Color(0xFFD4AF37);
  static const goldBright = Color(0xFFF0D878);
  static const goldDim = Color(0xFF7A6520);
  static const ember = Color(0xFFE40712);
  static const emberHover = Color(0xFFFF2430);
  static const emberDeep = Color(0xFF9B0610);
  static const text = Color(0xFFF7F0E3);
  static const textDim = Color(0xFFA8A29E);
  static const hp = Color(0xFFE40712);
  static const hpLow = Color(0xFF8A0B10);
  static const mana = Color(0xFF4C75DB);
  static const success = Color(0xFF3FAE66);
  static const failure = Color(0xFFFF4A52);

  // Raridades D&D 5e autênticas
  static const uncommon = Color(0xFF3FAE66);
  static const rare = Color(0xFF3B82F6);
  static const veryRare = Color(0xFFA855F7);
  static const legendary = Color(0xFFF59E0B);
  static const artifact = Color(0xFFEF4444);
  static const common = Color(0xFF9CA3AF);
}

Color? rarityColor(String? rarity) => switch (rarity) {
      'comum' => Palette.common,
      'incomum' => Palette.uncommon,
      'raro' => Palette.rare,
      'muito raro' => Palette.veryRare,
      'lendário' => Palette.legendary,
      'artefato' => Palette.artifact,
      _ => null,
    };

ThemeData buildTheme() {
  final base = ThemeData(useMaterial3: true, brightness: Brightness.dark);
  final ink = base.textTheme.apply(fontFamily: 'EBGaramond', bodyColor: Palette.text, displayColor: Palette.gold);
  const display = TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, color: Palette.goldBright);
  return base.copyWith(
    scaffoldBackgroundColor: Palette.obsidian,
    colorScheme: const ColorScheme.dark(
      primary: Palette.gold,
      onPrimary: Color(0xFF0D0A06),
      secondary: Palette.ember,
      surface: Palette.obsidianRaised,
      onSurface: Palette.text,
      error: Palette.failure,
      outline: Palette.brassDark,
    ),
    textTheme: ink.copyWith(
      headlineMedium: display.copyWith(fontSize: 26, letterSpacing: 1.2),
      titleLarge: display.copyWith(fontSize: 22, color: Palette.goldBright),
      titleMedium: display.copyWith(fontSize: 16, color: Palette.text),
      bodyLarge: const TextStyle(fontFamily: 'EBGaramond', fontSize: 18, height: 1.5, color: Palette.text),
      bodyMedium: const TextStyle(fontFamily: 'EBGaramond', fontSize: 16, height: 1.5, color: Palette.text),
    ),
    cardTheme: CardThemeData(
      color: Palette.obsidianTint,
      elevation: 4,
      shadowColor: Colors.black.withValues(alpha: 0.6),
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: Color(0x38D4AF37), width: 1),
      ),
    ),
    iconTheme: const IconThemeData(color: Palette.gold),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Palette.obsidianTint,
      hintStyle: const TextStyle(color: Palette.textDim, fontFamily: 'EBGaramond'),
      labelStyle: const TextStyle(color: Palette.gold, fontFamily: 'Cinzel', fontSize: 13),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0x38D4AF37))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0x38D4AF37))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Palette.goldBright, width: 1.5)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 48),
        backgroundColor: Palette.ember,
        foregroundColor: Colors.white,
        textStyle: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, fontSize: 15, letterSpacing: 1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: const BorderSide(color: Color(0x40D4AF37))),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        foregroundColor: Palette.goldBright,
        side: const BorderSide(color: Color(0x50D4AF37)),
        textStyle: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, fontSize: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Palette.obsidianRaised,
      contentTextStyle: TextStyle(color: Palette.text, fontFamily: 'EBGaramond', fontSize: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
        side: BorderSide(color: Color(0x40D4AF37)),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Palette.goldBright : Palette.textDim),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Palette.brassDark : Palette.line),
    ),
  );
}

/// Fonte da narração de alta legibilidade no padrão Baldur's Gate 3.
TextStyle narrationStyle(BuildContext context, {double size = 18}) =>
    TextStyle(fontFamily: 'EBGaramond', fontSize: size, height: 1.6, color: Palette.text, letterSpacing: 0.2);

TextStyle displayStyle({double size = 18, Color color = Palette.goldBright}) =>
    TextStyle(fontFamily: 'Cinzel', fontSize: size, fontWeight: FontWeight.w600, color: color, letterSpacing: 0.8);

