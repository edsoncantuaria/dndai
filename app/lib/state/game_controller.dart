import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../api/sse_backoff.dart';

/// Estado do jogo de uma campanha: espelha o motor em tempo real (SSE) e envia as ações do jogador.
/// Toda regra fica no motor; aqui só há apresentação e envio.
class GameController extends ChangeNotifier {
  GameController(this.api, this.campaign);
  final ApiClient api;
  final String campaign;

  GameView? view;
  String? error;
  bool live = false;
  bool sending = false;
  RollOutcome? lastOutcome;
  /// Resultado da última ação de item, como o motor descreveu (ex.: a cura rolada).
  String? lastActionText;

  StreamSubscription<void>? _sub;
  Timer? _retry;
  Timer? _poll;
  bool _disposed = false;
  int _sseAttempt = 0;
  bool _refreshing = false;
  bool _again = false;

  Future<void> start() async {
    await refresh();
    _listen();
    // Rede: se o SSE cair, ainda assim o estado é relido periodicamente.
    _poll = Timer.periodic(const Duration(seconds: 15), (_) => refresh());
  }

  void _listen() {
    _sub?.cancel();
    try {
      _sub = api.changes(campaign).listen(
        (_) {
          _sseAttempt = 0;
          if (!live) {
            live = true;
            _notify();
          }
          refresh();
        },
        onError: (_) => _reconnect(),
        onDone: _reconnect,
        cancelOnError: true,
      );
    } catch (_) {
      _reconnect();
    }
  }

  void _reconnect() {
    live = false;
    _notify();
    _retry?.cancel();
    if (!_disposed) _retry = Timer(sseReconnectDelay(_sseAttempt++), _listen);
  }

  /// Relê o estado; chamadas simultâneas viram uma releitura extra no fim (sem perder mudanças).
  Future<void> refresh() async {
    if (_refreshing) {
      _again = true;
      return;
    }
    _refreshing = true;
    try {
      do {
        _again = false;
        view = await api.state(campaign);
        error = null;
        _notify();
      } while (_again && !_disposed);
    } catch (e) {
      error = e.toString();
      _notify();
    } finally {
      _refreshing = false;
    }
  }

  Future<String?> send(String text) => _act(() => api.message(campaign, text));

  Future<String?> itemAction(String action, String item) => _act(() async {
        lastActionText = await api.itemAction(campaign, action, item);
      });

  Future<String?> resolveRoll(int id, List<int> dice) => _act(() async {
        lastOutcome = await api.roll(campaign, id, dice);
      });

  Future<String?> useResource(String resource, int amount) => _act(() async {
        lastActionText = await api.useResource(campaign, resource, amount);
      });

  Future<String?> levelUp({String hpMode = 'media', String? subclass, String? asi, String? feat, Map<String, List<String>>? choices}) =>
      _act(() async {
        lastActionText = await api.levelUp(campaign, hpMode: hpMode, subclass: subclass, asi: asi, feat: feat, choices: choices);
      });

  Future<String?> rest({String kind = 'short', int dice = 1}) =>
      _act(() async {
        lastActionText = await api.rest(campaign, kind: kind, dice: dice);
      });

  /// Executa e devolve a mensagem de erro (para a UI mostrar), ou null em caso de sucesso.
  Future<String?> _act(Future<void> Function() fn) async {
    sending = true;
    _notify();
    try {
      await fn();
      await refresh();
      return null;
    } on ApiException catch (e) {
      await refresh();
      return e.message;
    } catch (e) {
      return 'Sem conexão com o servidor ($e).';
    } finally {
      sending = false;
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _sub?.cancel();
    _retry?.cancel();
    _poll?.cancel();
    super.dispose();
  }
}
