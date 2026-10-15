import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

enum VoiceStatus { idle, loading, playing, error }

/// Toca o MP3 de `GET /api/tts` (Kokoro, no motor). Uma narração corta a anterior.
class TableVoice {
  TableVoice._() {
    _initListeners();
  }
  static final instance = TableVoice._();

  AudioPlayer? _player;
  String? _url;
  Timer? _errorTimer;

  final ValueNotifier<VoiceStatus> statusNotifier = ValueNotifier<VoiceStatus>(VoiceStatus.idle);
  final ValueNotifier<String?> currentKeyNotifier = ValueNotifier<String?>(null);

  VoiceStatus get status => statusNotifier.value;
  String? get currentKey => currentKeyNotifier.value;

  AudioPlayer get _audio {
    if (_player == null) {
      _player = AudioPlayer();
      _initListeners();
    }
    return _player!;
  }

  void _initListeners() {
    final p = _player;
    if (p == null) return;
    p.onPlayerComplete.listen((_) {
      statusNotifier.value = VoiceStatus.idle;
      _url = null;
      currentKeyNotifier.value = null;
    });
    p.onPlayerStateChanged.listen((state) {
      if (state == PlayerState.stopped || state == PlayerState.completed) {
        if (statusNotifier.value == VoiceStatus.playing) {
          statusNotifier.value = VoiceStatus.idle;
        }
      }
    });
  }

  void _resetErrorTimer() {
    _errorTimer?.cancel();
    _errorTimer = Timer(const Duration(seconds: 4), () {
      if (statusNotifier.value == VoiceStatus.error) {
        statusNotifier.value = VoiceStatus.idle;
        _url = null;
        currentKeyNotifier.value = null;
      }
    });
  }

  Future<void> toggle(String url, {String? key}) async {
    final player = _audio;
    if (_url == url && (player.state == PlayerState.playing || statusNotifier.value == VoiceStatus.playing)) {
      await stop();
      return;
    }
    if (statusNotifier.value == VoiceStatus.loading && _url == url) {
      await stop();
      return;
    }

    _errorTimer?.cancel();
    await stop();
    _url = url;
    currentKeyNotifier.value = key;
    statusNotifier.value = VoiceStatus.loading;

    try {
      final uri = Uri.parse(url);
      final response = await http.get(uri).timeout(const Duration(seconds: 25));
      if (response.statusCode == 200 && response.bodyBytes.isNotEmpty) {
        statusNotifier.value = VoiceStatus.playing;
        await player.play(BytesSource(response.bodyBytes));
      } else {
        statusNotifier.value = VoiceStatus.error;
        _resetErrorTimer();
      }
    } catch (_) {
      statusNotifier.value = VoiceStatus.error;
      _resetErrorTimer();
    }
  }

  Future<void> stop() async {
    _errorTimer?.cancel();
    _url = null;
    currentKeyNotifier.value = null;
    statusNotifier.value = VoiceStatus.idle;
    try {
      await _player?.stop();
    } catch (_) {}
  }
}
