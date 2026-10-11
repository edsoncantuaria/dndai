import 'package:flutter/material.dart';

/// Couro, pergaminho e latão. Texto longo fica no pergaminho (tinta escura); o resto da mesa é couro.
class Palette {
  static const leather = Color(0xFF1A120C);
  static const leatherRaised = Color(0xFF2C1E16);
  static const brass = Color(0xFFC6A15B);
  static const brassDark = Color(0xFF7A5A2E);
  static const parchment = Color(0xFFF4E6C8);
  static const parchmentDeep = Color(0xFFE6D0A4);
  static const ink = Color(0xFF24180F);
  static const inkSoft = Color(0xFF5C4632);
  static const inkEmph = Color(0xFF6B3E12);

  static const bg = leather;
  static const surface = leatherRaised;
  static const surfaceHigh = Color(0xFF3A291E);
  static const line = Color(0xFF5A4332);
  static const gold = Color(0xFFF0D48A);
  static const goldDim = Color(0xFFE4C98A);
  static const ember = Color(0xFFC2412D);
  static const text = Color(0xFFF6EFE2);
  static const textDim = Color(0xFFD7C7B2);
  static const hp = Color(0xFFB42318);
  static const hpLow = Color(0xFF7A120C);
  static const mana = Color(0xFF3D6BB5);
  static const success = Color(0xFF1F7A45);
  static const failure = Color(0xFFB42318);

  static const uncommon = Color(0xFF1F8A4C);
  static const rare = Color(0xFF2F6FDB);
  static const veryRare = Color(0xFF7B3FB2);
  static const legendary = Color(0xFFC9841A);
  static const artifact = Color(0xFFB7412A);
  static const common = Color(0xFF8A8175);
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
  const display = TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, color: Palette.gold);
  return base.copyWith(
    scaffoldBackgroundColor: Palette.leather,
    colorScheme: const ColorScheme.dark(
      primary: Palette.brass,
      onPrimary: Color(0xFF1A130C),
      secondary: Palette.ember,
      surface: Palette.leatherRaised,
      onSurface: Palette.text,
      error: Palette.failure,
      outline: Palette.line,
    ),
    textTheme: ink.copyWith(
      headlineMedium: display.copyWith(fontSize: 26),
      titleLarge: display.copyWith(fontSize: 22, color: Palette.ink),
      titleMedium: display.copyWith(fontSize: 16, color: Palette.text),
      bodyLarge: const TextStyle(fontFamily: 'EBGaramond', fontSize: 18, height: 1.45, color: Palette.text),
      bodyMedium: const TextStyle(fontFamily: 'EBGaramond', fontSize: 16, height: 1.45, color: Palette.text),
    ),
    cardTheme: CardThemeData(
      color: Palette.parchment,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: const BorderSide(color: Palette.brassDark, width: 1.5)),
    ),
    iconTheme: const IconThemeData(color: Palette.ink),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Palette.parchment,
      hintStyle: const TextStyle(color: Palette.inkSoft, fontFamily: 'EBGaramond'),
      labelStyle: const TextStyle(color: Palette.inkSoft, fontFamily: 'EBGaramond'),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Palette.brassDark)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Palette.brassDark)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Palette.brass, width: 2)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 48),
        backgroundColor: Palette.ember,
        foregroundColor: Colors.white,
        textStyle: const TextStyle(fontFamily: 'Cinzel', fontWeight: FontWeight.w600, fontSize: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        foregroundColor: Palette.ink,
        side: const BorderSide(color: Palette.brassDark),
        textStyle: const TextStyle(fontFamily: 'EBGaramond', fontSize: 16),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Palette.leatherRaised,
      contentTextStyle: TextStyle(color: Palette.text, fontFamily: 'EBGaramond', fontSize: 16),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Palette.brass : Palette.textDim),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Palette.brassDark : Palette.line),
    ),
  );
}

/// Fonte da narração no pergaminho.
TextStyle narrationStyle(BuildContext context, {double size = 18}) =>
    TextStyle(fontFamily: 'EBGaramond', fontSize: size, height: 1.55, color: Palette.ink);

TextStyle displayStyle({double size = 18, Color color = Palette.gold}) =>
    TextStyle(fontFamily: 'Cinzel', fontSize: size, fontWeight: FontWeight.w600, color: color);
