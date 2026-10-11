import 'package:audioplayers/audioplayers.dart';

/// Toca o MP3 de `GET /api/tts` (Kokoro, no motor). Uma narração corta a anterior.
class TableVoice {
  TableVoice._();
  static final instance = TableVoice._();

  AudioPlayer? _player;
  String? _url;

  AudioPlayer get _audio => _player ??= AudioPlayer();

  Future<void> toggle(String url) async {
    final player = _audio;
    if (_url == url && player.state == PlayerState.playing) {
      await stop();
      return;
    }
    _url = url;
    await player.stop();
    await player.play(UrlSource(url));
  }

  Future<void> stop() async {
    _url = null;
    await _player?.stop();
  }
}
