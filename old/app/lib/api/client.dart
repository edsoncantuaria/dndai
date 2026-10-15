import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'events_stub.dart'
    if (dart.library.io) 'events_io.dart'
    if (dart.library.js_interop) 'events_web.dart'
    as events;
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
  ApiClient({required String baseUrl, this.token, http.Client? httpClient})
    : baseUrl = _normalizeUrl(baseUrl),
      _http = httpClient ?? http.Client();
  final String baseUrl;
  final String? token;
  final http.Client _http;

  static String _normalizeUrl(String raw) {
    var url = raw.trim();
    if (url.isEmpty) return 'http://100.91.215.59:8790';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://$url';
    }
    while (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }
    return url;
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = Uri.parse(baseUrl);
    final params = {...?query};
    // Fora da web o token vai só no header Authorization. Na web o EventSource não define header.
    if (kIsWeb && token != null && token!.isNotEmpty) params['token'] = token!;
    return base.replace(
      path: '${base.path}$path',
      queryParameters: params.isEmpty ? null : params,
    );
  }

  Map<String, String> get _headers => {
    'content-type': 'application/json',
    if (token != null && token!.isNotEmpty) 'authorization': 'Bearer $token',
  };

  Future<dynamic> _decode(http.Response r) async {
    final body = r.body.isEmpty ? null : jsonDecode(utf8.decode(r.bodyBytes));
    if (r.statusCode >= 400) {
      final msg = body is Map && body['error'] is String
          ? body['error'] as String
          : 'Erro ${r.statusCode}';
      throw ApiException(r.statusCode, msg);
    }
    return body;
  }

  Future<Map<String, dynamic>> login(String login, String password) async {
    final r = await _http
        .post(
          _uri('/api/auth/login'),
          headers: {'content-type': 'application/json'},
          body: jsonEncode({'login': login, 'password': password}),
        )
        .timeout(const Duration(seconds: 15));
    return ((await _decode(r)) as Map).cast<String, dynamic>();
  }

  Future<List<Campaign>> campaigns() async {
    final r = await _http
        .get(_uri('/api/campaigns'), headers: _headers)
        .timeout(const Duration(seconds: 15));
    return ((await _decode(r)) as List)
        .cast<Map>()
        .map((e) => Campaign.fromJson(e.cast()))
        .toList();
  }

  Future<Campaign> createCampaign(
    String name, {
    String? slug,
    String? premise,
    String? tone,
  }) async {
    final cleanSlug = (slug != null && slug.trim().isNotEmpty)
        ? slug.trim()
        : name
              .toLowerCase()
              .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
              .replaceAll(RegExp(r'^-+|-+$'), '');
    final r = await _http
        .post(
          _uri('/api/campaigns/new'),
          headers: _headers,
          body: jsonEncode({
            'slug': cleanSlug.isEmpty
                ? 'campanha-${DateTime.now().millisecondsSinceEpoch}'
                : cleanSlug,
            'name': name.trim(),
            'premise': premise ?? '',
            'tone': tone ?? '',
          }),
        )
        .timeout(const Duration(seconds: 15));
    final data = ((await _decode(r)) as Map).cast<String, dynamic>();
    return Campaign(data['slug'] as String, data['name'] as String);
  }

  Future<void> createPc(String campaign, Map<String, dynamic> pcData) async {
    final r = await _http
        .post(
          _uri('/api/pc/create', {'campaign': campaign}),
          headers: _headers,
          body: jsonEncode(pcData),
        )
        .timeout(const Duration(seconds: 20));
    await _decode(r);
  }

  Future<CharacterCreationOptions> characterCreationOptions({
    required String race,
    required String characterClass,
    required String background,
  }) async {
    final r = await _http
        .get(
          _uri('/api/pc/creation-options', {
            'race': race,
            'class': characterClass,
            'background': background,
          }),
          headers: _headers,
        )
        .timeout(const Duration(seconds: 15));
    return CharacterCreationOptions.fromJson(
      ((await _decode(r)) as Map).cast<String, dynamic>(),
    );
  }

  Future<LevelUpOptions> levelUpOptions(
    String campaign, {
    String? subclass,
  }) async {
    final query = <String, String>{
      'campaign': campaign,
      if (subclass != null && subclass.isNotEmpty) 'subclass': subclass,
    };
    final r = await _http
        .get(
          _uri('/api/pc/levelup-options', query),
          headers: _headers,
        )
        .timeout(const Duration(seconds: 15));
    return LevelUpOptions.fromJson(
      ((await _decode(r)) as Map).cast<String, dynamic>(),
    );
  }

  Future<String> levelUp(
    String campaign, {
    String hpMode = 'media',
    String? subclass,
    String? asi,
    String? feat,
    Map<String, List<String>>? choices,
  }) async {
    final r = await _http
        .post(
          _uri('/api/pc/levelup', {'campaign': campaign}),
          headers: _headers,
          body: jsonEncode({
            'hpMode': hpMode,
            if (subclass != null && subclass.isNotEmpty) 'subclass': subclass,
            if (asi != null && asi.isNotEmpty) 'asi': asi,
            if (feat != null && feat.isNotEmpty) 'feat': feat,
            'choices': ?choices,
          }),
        )
        .timeout(const Duration(seconds: 20));
    final data = ((await _decode(r)) as Map).cast<String, dynamic>();
    return data['text'] as String? ?? 'Subida de nível concluída!';
  }

  Future<String> rest(
    String campaign, {
    String kind = 'short',
    int dice = 1,
  }) async {
    final r = await _http
        .post(
          _uri('/api/pc/rest', {'campaign': campaign}),
          headers: _headers,
          body: jsonEncode({'kind': kind, 'dice': dice}),
        )
        .timeout(const Duration(seconds: 15));
    final data = ((await _decode(r)) as Map).cast<String, dynamic>();
    return data['text'] as String? ?? 'Descanso concluído.';
  }

  Future<GameView> state(String campaign) async {
    final r = await _http
        .get(_uri('/api/state', {'campaign': campaign}), headers: _headers)
        .timeout(const Duration(seconds: 20));
    return GameView.fromJson(((await _decode(r)) as Map).cast());
  }

  Future<dynamic> _post(String path, String campaign, Object body) async {
    final r = await _http
        .post(
          _uri(path, {'campaign': campaign}),
          headers: _headers,
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 60));
    return _decode(r);
  }

  Future<RollOutcome> roll(String campaign, int id, List<int> dice) async =>
      RollOutcome.fromJson(
        ((await _post('/api/rolls/$id', campaign, {'dice': dice})) as Map)
            .cast(),
      );

  Future<String> itemAction(
    String campaign,
    String action,
    String item,
  ) async =>
      ((await _post('/api/actions', campaign, {'action': action, 'item': item}))
              as Map)['text']
          as String;

  Future<void> message(String campaign, String text) =>
      _post('/api/messages', campaign, {'text': text});
  Future<String> useResource(
    String campaign,
    String resource,
    int amount,
  ) async =>
      ((await _post('/api/resources', campaign, {
            'resource': resource,
            'amount': amount,
          })) as Map)['text']
          as String;

  /// MP3 da narração (`key` = `chat-<id>` ou `turn-<n>`). O player não manda o header Bearer, então o token vai na query, como o contrato pede para `<audio>`.
  Uri ttsUri(String campaign, String key) {
    final base = Uri.parse(
      baseUrl.endsWith('/')
          ? baseUrl.substring(0, baseUrl.length - 1)
          : baseUrl,
    );
    return base.replace(
      path: '${base.path}/api/tts',
      queryParameters: {
        'campaign': campaign,
        'key': key,
        if (token != null && token!.isNotEmpty) 'token': token!,
      },
    );
  }

  /// Eventos de mudança (SSE). Cada evento = "releia o estado".
  Stream<void> changes(String campaign) =>
      events.sseChanges(_uri('/api/events', {'campaign': campaign}), _headers);

  void close() => _http.close();
}
