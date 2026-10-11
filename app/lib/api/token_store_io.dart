import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _secure = FlutterSecureStorage();
const _key = 'token';

Future<String?> readStoredToken(SharedPreferences prefs) async {
  final current = await _secure.read(key: _key);
  if (current != null && current.isNotEmpty) return current;
  final legacy = prefs.getString(_key);
  if (legacy != null && legacy.isNotEmpty) {
    await _secure.write(key: _key, value: legacy);
    await prefs.remove(_key);
    return legacy;
  }
  return current;
}

Future<void> writeStoredToken(SharedPreferences prefs, String token) async {
  await prefs.remove(_key);
  if (token.isEmpty) {
    await _secure.delete(key: _key);
    return;
  }
  await _secure.write(key: _key, value: token);
}
