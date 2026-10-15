import AsyncStorage from '@react-native-async-storage/async-storage';

/** Mesma chave conceitual que o web (`dndai_intro_v2_complete`). */
export const INTRO_STORAGE_KEY = 'dndai_intro_v2_complete';

export async function isIntroComplete(): Promise<boolean> {
  const v = await AsyncStorage.getItem(INTRO_STORAGE_KEY);
  return v === '1';
}

export async function markIntroComplete(): Promise<void> {
  await AsyncStorage.setItem(INTRO_STORAGE_KEY, '1');
}

export async function resetIntro(): Promise<void> {
  await AsyncStorage.removeItem(INTRO_STORAGE_KEY);
}
