import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra as
  | { webAppUrl?: string; apiUrl?: string }
  | undefined;

/** Substitui localhost no emulador Android (10.0.2.2 = host da máquina). */
export function resolveHostUrl(url: string): string {
  if (Platform.OS === 'android' && /localhost|127\.0\.0\.1/.test(url)) {
    return url.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }
  return url;
}

export function getWebAppUrl(): string {
  const raw = extra?.webAppUrl?.trim() || 'http://localhost:9002';
  return resolveHostUrl(raw.replace(/\/$/, ''));
}

export function getApiUrl(): string {
  const raw = extra?.apiUrl?.trim() || 'http://localhost:8071/api';
  return resolveHostUrl(raw.replace(/\/$/, ''));
}
