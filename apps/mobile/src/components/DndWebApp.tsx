import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { getWebAppUrl, getApiUrl } from '../config/env';
import {
  AUTH_BRIDGE_SCRIPT,
  buildBootstrapInjectionScript,
  clearStoredToken,
  deriveWsUrlFromApi,
  getStoredToken,
  parseBridgeMessage,
  setStoredToken,
} from '../lib/authBridge';
import { colors, fonts } from '../theme';

type LoadState = 'loading' | 'ready' | 'error';

export function DndWebApp() {
  const webRef = useRef<WebView>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [webKey, setWebKey] = useState(0);
  const webUrl = getWebAppUrl();
  const apiUrl = getApiUrl();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getStoredToken();
      if (!cancelled) {
        setToken(stored);
        setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const wsUrl = deriveWsUrlFromApi(apiUrl);
  const bootstrap = buildBootstrapInjectionScript(apiUrl, wsUrl, token);
  const injection = `${bootstrap}${AUTH_BRIDGE_SCRIPT}`;

  const handleMessage = useCallback(async (event: { nativeEvent: { data: string } }) => {
    const msg = parseBridgeMessage(event.nativeEvent.data);
    if (!msg || msg.type !== 'auth') return;
    if (msg.token.trim()) {
      await setStoredToken(msg.token);
      setToken(msg.token);
    } else {
      await clearStoredToken();
      setToken(null);
    }
  }, []);

  const reload = () => {
    setLoadState('loading');
    setWebKey((k) => k + 1);
  };

  if (!authReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      {loadState === 'error' && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Não foi possível abrir o jogo</Text>
          <Text style={styles.errorBody}>
            Confirme que o frontend está no ar e que o celular/emulador alcança o host.
          </Text>
          <Text style={styles.errorUrl}>App: {webUrl}</Text>
          <Text style={styles.errorUrl}>API: {apiUrl}</Text>
          {Platform.OS === 'android' && webUrl.includes('10.0.2.2') && (
            <Text style={styles.errorHint}>
              Emulador Android: use EXPO_PUBLIC_WEB_APP_URL com o IP da sua máquina se 10.0.2.2 falhar.
            </Text>
          )}
          <Pressable style={styles.retry} onPress={reload}>
            <Text style={styles.retryText}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}

      <WebView
        key={webKey}
        ref={webRef}
        source={{ uri: webUrl }}
        style={styles.webview}
        injectedJavaScriptBeforeContentLoaded={bootstrap}
        injectedJavaScript={injection}
        onMessage={handleMessage}
        onLoadStart={() => setLoadState('loading')}
        onLoadEnd={() => setLoadState('ready')}
        onError={() => setLoadState('error')}
        onHttpError={() => setLoadState('error')}
        onNavigationStateChange={(nav: WebViewNavigation) => {
          if (nav.loading) setLoadState('loading');
        }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        setSupportMultipleWindows={false}
        originWhitelist={['http://*', 'https://*']}
        applicationNameForUserAgent="CronicasAventurasExpo/1.0"
      />

      {loadState === 'loading' && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.loadingText}>Abrindo a mesa…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.void,
  },
  boot: {
    flex: 1,
    backgroundColor: colors.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: colors.void,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 4, 10, 0.85)',
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fonts.body,
  },
  errorBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    padding: 16,
    backgroundColor: '#2a1010',
    borderBottomWidth: 1,
    borderBottomColor: colors.ember,
    gap: 8,
  },
  errorTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  errorBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  errorUrl: {
    color: colors.goldDim,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorHint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.gold,
    borderRadius: 6,
  },
  retryText: {
    color: colors.void,
    fontWeight: '700',
  },
});
