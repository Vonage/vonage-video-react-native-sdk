// Checked by `npm run typecheck`, not by Jest.
import type {
  LanguageCode,
  OTPublisherProperties,
  OTSubscriberProperties,
  TranslationLanguage,
} from '../index';

export const code: LanguageCode = 'es-ES';
export const translation: TranslationLanguage = { languageCode: null };

export const subscriberProperties: OTSubscriberProperties[] = [
  { translationLanguage: { languageCode: 'fr-FR' } },
  { translationLanguage: { languageCode: null } },
  { translationLanguage: null },
  {},
  // @ts-expect-error unsupported language code
  { translationLanguage: { languageCode: 'xx-YY' } },
  // @ts-expect-error a plain string is not a TranslationLanguage
  { translationLanguage: 'fr-FR' },
];

export const publisherProperties: OTPublisherProperties[] = [
  { publishCaptions: true, inputLanguage: 'en-US' },
  { inputLanguage: null },
  // @ts-expect-error unsupported language code
  { inputLanguage: 'english' },
];
