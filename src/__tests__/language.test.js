import {
  LANGUAGE_CODES,
  createInputLanguageResolver,
  createTranslationLanguageResolver,
  isLanguageCode,
} from '../helpers/language';

let warn;

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

describe('isLanguageCode', () => {
  it('has the 54 codes of the native SDK, without duplicates', () => {
    expect(LANGUAGE_CODES).toHaveLength(54);
    expect(new Set(LANGUAGE_CODES).size).toBe(54);
  });

  it('accepts a supported code in any case', () => {
    expect(isLanguageCode('es-ES')).toBe(true);
    expect(isLanguageCode('es-es')).toBe(true);
  });

  it.each(['xx-YY', 42])('rejects %p', (value) => {
    expect(isLanguageCode(value)).toBe(false);
  });
});

describe('createTranslationLanguageResolver', () => {
  let resolve;

  beforeEach(() => {
    resolve = createTranslationLanguageResolver();
  });

  it.each([undefined, null, { languageCode: null }])(
    'returns an empty string for %p',
    (value) => {
      expect(resolve(value)).toBe('');
    }
  );

  it('returns the language code unchanged, in any case', () => {
    expect(resolve({ languageCode: 'de-de' })).toBe('de-de');
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the applied value when the same language comes in another case', () => {
    resolve({ languageCode: 'es-ES' });
    expect(resolve({ languageCode: 'es-es' })).toBe('es-ES');
  });

  it.each([
    ['a plain string', 'es-ES'],
    ['an unsupported code', { languageCode: 'xx-YY' }],
    ['an unknown key', { languageCode: 'es-ES', captionsLanguageCode: 'fr-FR' }],
  ])('keeps the previous language and warns for %s', (_label, value) => {
    resolve({ languageCode: 'fr-FR' });
    expect(resolve(value)).toBe('fr-FR');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('translationLanguage');
  });

  it('warns once per invalid value, and again after a valid one', () => {
    resolve({ languageCode: 'xx-YY' });
    resolve({ languageCode: 'xx-YY' });
    expect(warn).toHaveBeenCalledTimes(1);
    resolve({ languageCode: 'es-ES' });
    resolve({ languageCode: 'xx-YY' });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('createInputLanguageResolver', () => {
  it('takes a plain code and rejects an object', () => {
    const resolve = createInputLanguageResolver();
    expect(resolve('it-IT')).toBe('it-IT');
    expect(resolve({ languageCode: 'en-US' })).toBe('it-IT');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('inputLanguage');
  });
});
