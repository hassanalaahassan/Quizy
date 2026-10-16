import { Injectable, computed, signal } from '@angular/core';
import enTranslations from '../i18n/en.json';
import arTranslations from '../i18n/ar.json';

export type Language = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

const STORAGE_KEY = 'quiziyyy_lang';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: enTranslations as Record<string, string>,
  ar: arTranslations as Record<string, string>,
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _lang = signal<Language>(this.getInitialLanguage());

  readonly lang = this._lang.asReadonly();

  readonly dir = computed<Direction>(() => (this._lang() === 'ar' ? 'rtl' : 'ltr'));

  readonly isRtl = computed<boolean>(() => this._lang() === 'ar');

  constructor() {
    this.applyLanguage(this._lang());
  }

  setLanguage(lang: Language): void {
    if (this._lang() === lang) return;
    this._lang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    this.applyLanguage(lang);
  }

  toggleLanguage(): void {
    const next: Language = this._lang() === 'en' ? 'ar' : 'en';
    this.setLanguage(next);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const currentLang = this._lang();
    let text = TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS.en[key] || key;

    if (params) {
      for (const [paramKey, val] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      }
    }

    return text;
  }

  private getInitialLanguage(): Language {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'ar') {
        return stored;
      }
      // Check browser language
      if (navigator.language && navigator.language.startsWith('ar')) {
        return 'ar';
      }
    } catch {
      // Fallback
    }
    return 'en';
  }

  private applyLanguage(lang: Language): void {
    if (typeof document !== 'undefined') {
      const isArabic = lang === 'ar';
      document.documentElement.lang = lang;
      document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
    }
  }
}
