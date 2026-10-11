import 'package:dndai/api/sse_backoff.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('reconexão do SSE espera 2, 4, 8, 16 e no máximo 30 segundos', () {
    expect(sseReconnectDelay(0), const Duration(seconds: 2));
    expect(sseReconnectDelay(1), const Duration(seconds: 4));
    expect(sseReconnectDelay(2), const Duration(seconds: 8));
    expect(sseReconnectDelay(3), const Duration(seconds: 16));
    expect(sseReconnectDelay(4), const Duration(seconds: 30));
    expect(sseReconnectDelay(9), const Duration(seconds: 30));
  });
}
