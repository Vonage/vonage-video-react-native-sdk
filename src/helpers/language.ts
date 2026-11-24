// Same list as the native SDK: native-sdk-src src/otkit/src/otkit/main/caption_language_validation.cpp
export const LANGUAGE_CODES = [
  'af-ZA', 'ar-AE', 'ar-SA', 'eu-ES', 'ca-ES', 'zh-HK', 'zh-CN', 'zh-TW',
  'hr-HR', 'cs-CZ', 'da-DK', 'nl-NL', 'en-AU', 'en-GB', 'en-IN', 'en-IE',
  'en-NZ', 'en-AB', 'en-ZA', 'en-US', 'en-WL', 'fa-IR', 'fi-FI', 'fr-FR',
  'fr-CA', 'gl-ES', 'de-DE', 'de-CH', 'el-GR', 'he-IL', 'hi-IN', 'id-ID',
  'it-IT', 'ja-JP', 'ko-KR', 'lv-LV', 'ms-MY', 'no-NO', 'pl-PL', 'pt-PT',
  'pt-BR', 'ro-RO', 'ru-RU', 'sr-RS', 'sk-SK', 'so-SO', 'es-ES', 'es-US',
  'sv-SE', 'tl-PH', 'th-TH', 'uk-UA', 'vi-VN', 'zu-ZA',
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export type TranslationLanguage = {
  languageCode: LanguageCode | null;
};

const LOWER_CASE_CODES = new Set<string>(
  LANGUAGE_CODES.map((code) => code.toLowerCase())
);

export const isLanguageCode = (value: unknown): value is string =>
  typeof value === 'string' && LOWER_CASE_CODES.has(value.toLowerCase());

const INVALID = Symbol('invalid');

// Returns the code ('' = no language) or INVALID.
const parseLanguageCode = (value: unknown): string | typeof INVALID => {
  if (value === undefined || value === null) return '';
  return isLanguageCode(value) ? value : INVALID;
};

// Same rules as the JS SDK: null, or an object with only `languageCode`.
const parseTranslationLanguage = (value: unknown): string | typeof INVALID => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'object' || Array.isArray(value)) return INVALID;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'languageCode') return INVALID;
  return parseLanguageCode((value as { languageCode: unknown }).languageCode);
};

/**
 * Returns a function that turns a property value into the string sent to the
 * native component ('' means no language).
 *
 * - No language (undefined, null, or { languageCode: null }): ''.
 * - A supported code in any case: the code unchanged (the native SDK
 *   normalizes the case). If it is the language already applied in another
 *   case, the applied value is kept, so native is not called again.
 * - Anything else: the language applied before, and one warning for that value.
 *
 * Keep one resolver per component instance.
 */
const createResolver =
  (
    propertyName: string,
    parse: (value: unknown) => string | typeof INVALID
  ) => {
    let applied = '';
    let lastWarnedKey: string | undefined;

    return (value: unknown): string => {
      const code = parse(value);
      if (code !== INVALID) {
        if (code.toLowerCase() !== applied.toLowerCase()) {
          applied = code;
        }
        lastWarnedKey = undefined;
        return applied;
      }
      const key = safeStringify(value);
      if (key !== lastWarnedKey) {
        lastWarnedKey = key;
        console.warn(
          `${propertyName}: unsupported value ${key}. Keeping the current language ${JSON.stringify(
            applied || null
          )}.`
        );
      }
      return applied;
    };
  };

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

export const createTranslationLanguageResolver = () =>
  createResolver('translationLanguage', parseTranslationLanguage);

export const createInputLanguageResolver = () =>
  createResolver('inputLanguage', parseLanguageCode);
