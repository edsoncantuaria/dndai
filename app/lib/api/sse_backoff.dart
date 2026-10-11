/// Espera entre reconexões do SSE: 2s, 4s, 8s, 16s e teto de 30s.
Duration sseReconnectDelay(int attempt) {
  const seconds = [2, 4, 8, 16, 30];
  final i = attempt < 0 ? 0 : (attempt >= seconds.length ? seconds.length - 1 : attempt);
  return Duration(seconds: seconds[i]);
}
