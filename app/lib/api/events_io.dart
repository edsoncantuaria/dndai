import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// SSE no celular: lê o stream HTTP linha a linha e emite a cada `event: change`.
/// Qualquer linha (inclusive `: ping`) renova o prazo de 45s; sem sinal, a stream cai.
Stream<void> sseChanges(Uri uri, Map<String, String> headers) {
  final controller = StreamController<void>();
  final client = http.Client();
  StreamSubscription<String>? sub;
  Timer? heartbeat;
  controller.onListen = () async {
    try {
      final req = http.Request('GET', uri)..headers.addAll({...headers, 'accept': 'text/event-stream'});
      final res = await client.send(req);
      if (res.statusCode != 200) throw Exception('SSE ${res.statusCode}');
      void arm() {
        heartbeat?.cancel();
        heartbeat = Timer(const Duration(seconds: 45), () {
          controller.addError(Exception('SSE sem sinal do servidor (45s).'));
          controller.close();
        });
      }

      arm();
      sub = res.stream.transform(utf8.decoder).transform(const LineSplitter()).listen(
        (line) {
          arm();
          if (line.startsWith('data:')) controller.add(null);
        },
        onError: controller.addError,
        onDone: () {
          heartbeat?.cancel();
          controller.close();
        },
      );
    } catch (e) {
      controller.addError(e);
      await controller.close();
    }
  };
  controller.onCancel = () async {
    heartbeat?.cancel();
    await sub?.cancel();
    client.close();
  };
  return controller.stream;
}
