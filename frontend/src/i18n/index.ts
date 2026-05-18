import { useLangStore } from '../store/langStore';
import { translations } from './translations';
import type { Lang } from '../store/langStore';

type TranslationKey = keyof typeof translations['es'];

/** React hook — use inside components */
export function useT() {
  const lang = useLangStore(s => s.lang);
  return (key: TranslationKey, fallback?: string): string =>
    translations[lang][key] ?? fallback ?? key;
}

/** Imperative helper — use outside React (e.g. in stores, utils) */
export function t(key: TranslationKey, fallback?: string): string {
  const lang: Lang = useLangStore.getState().lang;
  return translations[lang][key] ?? fallback ?? key;
}

/** Date with day-of-week, adapted to current lang */
export function formatDateI18n(
  dateStr: string | null | undefined,
  lang: Lang,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  return d.toLocaleDateString(locale, opts ?? {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
