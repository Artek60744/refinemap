import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  MESSAGES,
  SUPPORTED_LANGUAGES,
} from "./catalog";
import type { Lang } from "./catalog";

export type TranslateParams = Record<string, string | number>;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: TranslateParams) => string;
  label: (prefix: string, value: string | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLanguage(value: string | null | undefined): Lang {
  const short = (value ?? "").trim().toLowerCase().slice(0, 2);
  return short in SUPPORTED_LANGUAGES ? (short as Lang) : DEFAULT_LANGUAGE;
}

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function initialLanguage(): Lang {
  return normalizeLanguage(readCookie(LANGUAGE_COOKIE) ?? navigator.language);
}

function translate(lang: Lang, key: string, params?: TranslateParams): string {
  const entry = MESSAGES[key];
  const template = entry ? (lang === "en" ? entry[0] : entry[1]) : key;
  if (!params) {
    return template;
  }
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    template,
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    // The backend reads the same cookie to localize API messages.
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setLangState(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
      label: (prefix, rawValue) => {
        if (!rawValue) {
          return "";
        }
        const key = `${prefix}.${String(rawValue).trim().toLowerCase()}`;
        return key in MESSAGES ? translate(lang, key) : String(rawValue);
      },
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return context;
}
