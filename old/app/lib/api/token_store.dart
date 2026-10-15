import 'token_store_stub.dart' if (dart.library.io) 'token_store_io.dart' if (dart.library.js_interop) 'token_store_web.dart';

/// Token da mesa. Fora da web fica no armazenamento seguro; na web, nas preferências
/// (o EventSource do navegador só consegue mandar o token em ?token=).
Future<String?> readToken(dynamic prefs) => readStoredToken(prefs);

Future<void> writeToken(dynamic prefs, String token) => writeStoredToken(prefs, token);
