import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'dndai_jwt';

export async function getStoredToken(): Promise<string | null> {
  const t = await SecureStore.getItemAsync(TOKEN_KEY);
  return t?.trim() ? t : null;
}

export async function setStoredToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
}

export async function clearStoredToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* item inexistente */
  }
}

/** API/WS corretos no WebView (evita localhost embutido no bundle Next). */
export function buildRuntimeConfigInjectionScript(apiUrl: string, wsUrl: string): string {
  return `(function(){window.__DNDAI_RUNTIME_CONFIG__={apiUrl:${JSON.stringify(apiUrl)},wsUrl:${JSON.stringify(wsUrl)}};})();true;`;
}

export function deriveWsUrlFromApi(apiUrl: string): string {
  const origin = apiUrl.replace(/\/api\/?$/, '');
  return origin.replace(/^http/, 'ws') + '/';
}

/** Injeta JWT no localStorage do Next antes do bundle rodar (chave `token`, igual ao web). */
export function buildBootstrapInjectionScript(
  apiUrl: string,
  wsUrl: string,
  token: string | null,
): string {
  return `${buildRuntimeConfigInjectionScript(apiUrl, wsUrl)}${buildTokenInjectionScript(token)}`;
}

export function buildTokenInjectionScript(token: string | null): string {
  if (!token) return 'true;';
  const safe = token.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `(function(){try{localStorage.setItem('token','${safe}');}catch(e){}})();true;`;
}

/** Observa login/logout no WebView e sincroniza com SecureStore. */
export const AUTH_BRIDGE_SCRIPT = `
(function() {
  if (window.__dndaiAuthBridge) return;
  window.__dndaiAuthBridge = true;
  function notify() {
    try {
      var t = localStorage.getItem('token') || '';
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'auth', token: t })
      );
    } catch (e) {}
  }
  notify();
  var orig = localStorage.setItem;
  localStorage.setItem = function(k, v) {
    orig.apply(this, arguments);
    if (k === 'token') notify();
  };
  var origRemove = localStorage.removeItem;
  localStorage.removeItem = function(k) {
    origRemove.apply(this, arguments);
    if (k === 'token') notify();
  };
})();
true;
`;

export type WebViewBridgeMessage =
  | { type: 'auth'; token: string }
  | { type: 'reload' };

export function parseBridgeMessage(raw: string): WebViewBridgeMessage | null {
  try {
    const data = JSON.parse(raw) as WebViewBridgeMessage;
    if (data?.type === 'auth' && typeof data.token === 'string') return data;
    return null;
  } catch {
    return null;
  }
}
