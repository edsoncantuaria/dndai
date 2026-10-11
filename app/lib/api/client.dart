import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'events_stub.dart' if (dart.library.io) 'events_io.dart' if (dart.library.js_interop) 'events_web.dart' as events;
import 'models.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

/// Cliente do `dnd serve` (engine/API.md). Mesma API no celular e na web.
class ApiClient {
  ApiClient({required this.baseUrl, this.token});
  final String baseUrl;
  final String? token;
  final http.Client _http = http.Client();

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = Uri.parse(baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl);
    return base.replace(path: '${base.path}$path', queryParameters: {...?query, if (token != null && token!.isNotEmpty) 'token': token!});
  }

  Map<String, String> get _headers => {
        'content-type': 'application/json',
        if (token != null && token!.isNotEmpty) 'authorization': 'Bearer $token',
      };

  Future<dynamic> _decode(http.Response r) async {
    final body = r.body.isEmpty ? null : jsonDecode(utf8.decode(r.bodyBytes));
    if (r.statusCode >= 400) {
      final msg = body is Map && body['error'] is String ? body['error'] as String : 'Erro ${r.statusCode}';
      throw ApiException(r.statusCode, msg);
    }
    return body;
  }

  Future<List<Campaign>> campaigns() async {
    final r = await _http.get(_uri('/api/campaigns'), headers: _headers).timeout(const Duration(seconds: 15));
    return ((await _decode(r)) as List).cast<Map>().map((e) => Campaign.fromJson(e.cast())).toList();
  }

  Future<GameView> state(String campaign) async {
    final r = await _http.get(_uri('/api/state', {'campaign': campaign}), headers: _headers).timeout(const Duration(seconds: 20));
    return GameView.fromJson(((await _decode(r)) as Map).cast());
  }

  Future<dynamic> _post(String path, String campaign, Object body) async {
    final r = await _http
        .post(_uri(path, {'campaign': campaign}), headers: _headers, body: jsonEncode(body))
        .timeout(const Duration(seconds: 60));
    return _decode(r);
  }

  Future<RollOutcome> roll(String campaign, int id, List<int> dice) async =>
      RollOutcome.fromJson(((await _post('/api/rolls/$id', campaign, {'dice': dice})) as Map).cast());

  Future<String> itemAction(String campaign, String action, String item) async =>
      ((await _post('/api/actions', campaign, {'action': action, 'item': item})) as Map)['text'] as String;

  Future<void> message(String campaign, String text) => _post('/api/messages', campaign, {'text': text});

  /// Eventos de mudança (SSE). Cada evento = "releia o estado".
  Stream<void> changes(String campaign) => events.sseChanges(_uri('/api/events', {'campaign': campaign}), _headers);

  void close() => _http.close();
}
