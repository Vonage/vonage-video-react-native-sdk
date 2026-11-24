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

  it.each(LANGUAGE_CODES)('accepts %s', (code) => {
    expect(isLanguageCode(code)).toBe(true);
  });

  it.each(['es-es', 'ES-ES', 'Es-eS'])('accepts any case: %s', (code) => {
    expect(isLanguageCode(code)).toBe(true);
  });

  it.each([
    'xx-YY',
    'english',
    'es',
    'es_ES',
    ' es-ES',
    '',
    42,
    {},
    [],
    true,
    null,
    undefined,
  ])('rejects %p', (value) => {
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
      expect(warn).not.toHaveBeenCalled();
    }
  );

  it('returns the language code of the object', () => {
    expect(resolve({ languageCode: 'fr-FR' })).toBe('fr-FR');
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns a valid code in a different case unchanged', () => {
    expect(resolve({ languageCode: 'de-de' })).toBe('de-de');
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the applied value when the same language comes in another case', () => {
    expect(resolve({ languageCode: 'es-ES' })).toBe('es-ES');
    expect(resolve({ languageCode: 'es-es' })).toBe('es-ES');
  });

  it('turns translation off with null or languageCode null', () => {
    resolve({ languageCode: 'es-ES' });
    expect(resolve({ languageCode: null })).toBe('');
    resolve({ languageCode: 'es-ES' });
    expect(resolve(null)).toBe('');
  });

  it.each([
    ['a plain string', 'es-ES'],
    ['an unsupported code', { languageCode: 'xx-YY' }],
    ['a missing languageCode', {}],
    ['an unknown key', { languageCode: 'es-ES', captionsLanguageCode: 'fr-FR' }],
    ['only an unknown key', { code: 'es-ES' }],
    ['an array', ['es-ES']],
    ['a number', 42],
    ['a non-string languageCode', { languageCode: 42 }],
  ])('keeps the previous language and warns for %s', (_label, value) => {
    resolve({ languageCode: 'fr-FR' });
    expect(resolve(value)).toBe('fr-FR');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('translationLanguage');
  });

  it('keeps no language for an invalid value at the start', () => {
    expect(resolve({ languageCode: 'english' })).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns only once while the same invalid value is repeated in new objects', () => {
    resolve({ languageCode: 'xx-YY' });
    resolve({ languageCode: 'xx-YY' });
    resolve({ languageCode: 'xx-YY' });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns again when the invalid value comes back after a valid one', () => {
    resolve({ languageCode: 'xx-YY' });
    resolve({ languageCode: 'es-ES' });
    resolve({ languageCode: 'xx-YY' });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('createInputLanguageResolver', () => {
  let resolve;

  beforeEach(() => {
    resolve = createInputLanguageResolver();
  });

  it('returns an empty string for undefined and null', () => {
    expect(resolve(undefined)).toBe('');
    expect(resolve(null)).toBe('');
  });

  it('returns a valid code unchanged, in any case', () => {
    expect(resolve('it-IT')).toBe('it-IT');
    expect(resolve('en-us')).toBe('en-us');
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['an unsupported code', 'english'],
    ['an object', { languageCode: 'en-US' }],
    ['a number', 42],
  ])('keeps the previous language and warns for %s', (_label, value) => {
    resolve('it-IT');
    expect(resolve(value)).toBe('it-IT');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('inputLanguage');
  });

  it('keeps state per resolver', () => {
    const other = createInputLanguageResolver();
    resolve('es-ES');
    expect(other('xx-YY')).toBe('');
  });
});
