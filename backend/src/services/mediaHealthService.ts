import { checkObjectStorageHealth } from './objectStorageService.js';
import { getTtsStatus, isTtsAvailable } from './ttsService.js';

export type MediaHealthSnapshot = {
  ok: boolean;
  tts: {
    enabled: boolean;
    mode: 'http' | 'local' | 'off';
    httpUrl?: string;
    storageReady: boolean;
  };
  objectStorage: {
    ok: boolean;
    message: string;
  };
};

export const getMediaHealth = async (): Promise<MediaHealthSnapshot> => {
  const tts = getTtsStatus();
  const objectStorage = await checkObjectStorageHealth();
  const ok = tts.enabled && objectStorage.ok;

  return {
    ok,
    tts: {
      enabled: tts.enabled,
      mode: tts.mode,
      httpUrl: tts.httpUrl,
      storageReady: tts.storageReady,
    },
    objectStorage: {
      ok: objectStorage.ok,
      message: objectStorage.message,
    },
  };
};

export const isMediaPipelineReady = async (): Promise<boolean> => {
  const snapshot = await getMediaHealth();
  return snapshot.ok;
};
