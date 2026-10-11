import 'package:shared_preferences/shared_preferences.dart';

Future<String?> readStoredToken(SharedPreferences prefs) async => prefs.getString('token');

Future<void> writeStoredToken(SharedPreferences prefs, String token) async {
  if (token.isEmpty) {
    await prefs.remove('token');
    return;
  }
  await prefs.setString('token', token);
}
