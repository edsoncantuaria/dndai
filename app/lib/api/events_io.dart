import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// SSE no celular: lê o stream HTTP linha a linha e emite a cada `event: change`.
Stream<void> sseChanges(Uri uri, Map<String, String> headers) {
  final controller = StreamController<void>();
  final client = http.Client();
  StreamSubscription<String>? sub;
  controller.onListen = () async {
    try {
      final req = http.Request('GET', uri)..headers.addAll({...headers, 'accept': 'text/event-stream'});
      final res = await client.send(req);
      if (res.statusCode != 200) throw Exception('SSE ${res.statusCode}');
      sub = res.stream.transform(utf8.decoder).transform(const LineSplitter()).listen(
        (line) {
          if (line.startsWith('data:')) controller.add(null);
        },
        onError: controller.addError,
        onDone: controller.close,
      );
    } catch (e) {
      controller.addError(e);
      await controller.close();
    }
  };
  controller.onCancel = () async {
    await sub?.cancel();
    client.close();
  };
  return controller.stream;
}
