import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Paleta cinematográfica (fantasia sombria, ouro e brasa). Mobile first: alvos de toque >= 48dp.
class Palette {
  static const bg = Color(0xFF0E0B0A);
  static const surface = Color(0xFF17120F);
  static const surfaceHigh = Color(0xFF221A15);
  static const line = Color(0xFF3A2E25);
  static const gold = Color(0xFFD8B26A);
  static const goldDim = Color(0xFF8C7246);
  static const ember = Color(0xFFC2412D);
  static const text = Color(0xFFEDE3D3);
  static const textDim = Color(0xFFA89A86);
  static const hp = Color(0xFF4FA36A);
  static const hpLow = Color(0xFFB8452E);
  static const mana = Color(0xFF5D7FD6);
  static const success = Color(0xFF6FBF73);
  static const failure = Color(0xFFD9573F);
}

ThemeData buildTheme() {
  final base = ThemeData(useMaterial3: true, brightness: Brightness.dark);
  final body = GoogleFonts.interTextTheme(base.textTheme).apply(bodyColor: Palette.text, displayColor: Palette.text);
  return base.copyWith(
    scaffoldBackgroundColor: Palette.bg,
    colorScheme: const ColorScheme.dark(
      primary: Palette.gold,
      onPrimary: Color(0xFF1A130C),
      secondary: Palette.ember,
      surface: Palette.surface,
      onSurface: Palette.text,
      error: Palette.failure,
      outline: Palette.line,
    ),
    textTheme: body.copyWith(
      headlineMedium: GoogleFonts.cinzel(textStyle: body.headlineMedium, color: Palette.gold, fontWeight: FontWeight.w600),
      titleLarge: GoogleFonts.cinzel(textStyle: body.titleLarge, color: Palette.gold, fontWeight: FontWeight.w600),
      titleMedium: GoogleFonts.cinzel(textStyle: body.titleMedium, color: Palette.text, fontWeight: FontWeight.w600),
    ),
    cardTheme: CardThemeData(
      color: Palette.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Palette.line)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Palette.surface,
      indicatorColor: Palette.gold.withValues(alpha: 0.18),
      labelTextStyle: WidgetStatePropertyAll(GoogleFonts.inter(fontSize: 11, color: Palette.textDim)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Palette.surfaceHigh,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Palette.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Palette.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Palette.gold)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(minimumSize: const Size(48, 48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: Palette.surfaceHigh, contentTextStyle: TextStyle(color: Palette.text)),
  );
}

/// Fonte da narração (leitura longa, estilo livro).
TextStyle narrationStyle(BuildContext context, {double size = 17}) =>
    GoogleFonts.lora(fontSize: size, height: 1.6, color: Palette.text);
