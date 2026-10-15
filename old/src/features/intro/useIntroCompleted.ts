'use client';

const STORAGE_KEY = 'dndai_intro_v2_complete';

export function useIntroCompleted() {
  const isComplete = (): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  };

  const markComplete = () => {
    localStorage.setItem(STORAGE_KEY, '1');
  };

  const resetIntro = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  return { isComplete, markComplete, resetIntro };
}
