import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getAutoSpeak, setAutoSpeak, subscribeAutoSpeak } from './narrationPreferenceStore';

export const useNarrationSpeech = () => {
  const autoSpeak = useSyncExternalStore(subscribeAutoSpeak, getAutoSpeak, getAutoSpeak);

  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeak(!autoSpeak);
  }, [autoSpeak]);

  const setAutoSpeakPreference = useCallback((value: boolean) => {
    setAutoSpeak(value);
  }, []);

  return useMemo(
    () => ({
      autoSpeak,
      toggleAutoSpeak,
      setAutoSpeak: setAutoSpeakPreference,
      isSupported: true,
      isSpeaking: false,
      speakEntries: () => {},
      cancelSpeech: () => {},
    }),
    [autoSpeak, toggleAutoSpeak, setAutoSpeakPreference]
  );
};

export type NarrationSpeechControls = ReturnType<typeof useNarrationSpeech>;
