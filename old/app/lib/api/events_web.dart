import 'dart:async';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

/// SSE na web: EventSource nativo do navegador (o token vai em ?token=, já presente na URI).
Stream<void> sseChanges(Uri uri, Map<String, String> headers) {
  final controller = StreamController<void>();
  web.EventSource? source;
  controller.onListen = () {
    source = web.EventSource(uri.toString());
    source!.addEventListener('change', ((web.Event _) => controller.add(null)).toJS);
    source!.onerror = ((web.Event _) {
      if (source!.readyState == web.EventSource.CLOSED) {
        controller.addError(Exception('SSE fechado'));
        controller.close();
      }
    }).toJS;
  };
  controller.onCancel = () => source?.close();
  return controller.stream;
}
