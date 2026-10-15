const STORAGE_KEY = 'narration:autoSpeak';

type Listener = () => void;

let autoSpeak = false;
let isInitialized = false;
const listeners = new Set<Listener>();

const ensureInitialized = () => {
  if (isInitialized) return;
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      autoSpeak = stored === null ? true : stored === '1';
    } catch {
      autoSpeak = false;
    }
  }
  isInitialized = true;
};

export const getAutoSpeak = () => {
  ensureInitialized();
  return autoSpeak;
};

export const setAutoSpeak = (value: boolean) => {
  ensureInitialized();
  autoSpeak = value;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      // ignore
    }
  }
  listeners.forEach(listener => listener());
};

export const subscribeAutoSpeak = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
