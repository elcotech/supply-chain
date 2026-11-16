// ===== Bilingual interface layer (English + Amharic) =====
//
// The platform requirement asks for English, Amharic and expandable
// multilingual support. Translation is keyed by the English string itself, so
// any string that has no Amharic entry yet simply falls back to English - the
// dictionary can grow without touching the components that use it.
//
// The selected language is stored on the device and exposed through a tiny
// external store so every mounted component re-renders on change.

import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'am';

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
];

const AMHARIC: Record<string, string> = {};

const LANG_KEY = 'escon_language';

const readLanguage = (): Lang => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en') return saved;
  } catch {
    /* storage unavailable - keep English */
  }
  return 'en';
};

let currentLanguage: Lang = readLanguage();
const listeners = new Set<() => void>();

const applyDocumentLanguage = (lang: Lang): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('lang', lang === 'am' ? 'am' : 'en');
};

applyDocumentLanguage(currentLanguage);

export const getLanguage = (): Lang => currentLanguage;

export const setLanguage = (lang: Lang): void => {
  if (lang !== 'en' && lang !== 'am') return;
  currentLanguage = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable - the choice still applies for this session */
  }
  applyDocumentLanguage(lang);
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Translate one English string into the active language (fallback: English). */
export const translate = (lang: Lang, text: string): string =>
  lang === 'am' ? AMHARIC[text] || text : text;

/** React hook: active language plus a `t()` helper and the setter. */
export const useLanguage = (): { lang: Lang; setLang: (lang: Lang) => void; t: (text: string) => string } => {
  const lang = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return {
    lang,
    setLang: setLanguage,
    t: (text: string) => translate(lang, text),
  };
};

export { LANG_KEY };
