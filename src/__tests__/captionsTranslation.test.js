jest.mock('../OTSubscriberNativeComponent', () => 'OTRNSubscriber');
jest.mock('../OTPublisherNativeComponent', () => 'OTRNPublisher');
jest.mock('../OT', () => ({
  OT: { removeSubscriber: jest.fn(), publish: jest.fn(), unpublish: jest.fn() },
  checkAndroidPermissions: jest.fn(() => Promise.resolve()),
  nativeEvents: {},
}));
jest.mock('../helpers/OTSessionHelper', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  isConnected: jest.fn(() => false),
  getPublisherStream: jest.fn(() => null),
  clearPublisherStream: jest.fn(),
}));

import OTSubscriberView from '../OTSubscriberView';
import OTPublisher from '../OTPublisher';
import { sanitizeStreamProperties } from '../helpers/OTSubscriberHelper';

let warn;

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

describe('OTSubscriberView translationLanguage', () => {
  const createView = (streamId = 'stream-a') => {
    const view = new OTSubscriberView({ streamId });
    const render = (properties = {}, streamProperties = {}) => {
      view.context = {
        sessionId: 'session',
        subscriberProperties: properties,
        streamProperties,
        eventHandlers: {},
      };
      return view.render().props.translationLanguage;
    };
    return render;
  };

  it('sends an empty string when the property is not set', () => {
    expect(createView()()).toBe('');
  });

  it('sends the language from properties', () => {
    expect(createView()({ translationLanguage: { languageCode: 'es-ES' } })).toBe(
      'es-ES'
    );
  });

  it('uses streamProperties before properties', () => {
    const streamProperties = {
      'stream-a': { translationLanguage: { languageCode: 'fr-FR' } },
    };
    sanitizeStreamProperties(streamProperties);
    const properties = { translationLanguage: { languageCode: 'es-ES' } };
    expect(createView('stream-a')(properties, streamProperties)).toBe('fr-FR');
    expect(createView('stream-b')(properties, streamProperties)).toBe('es-ES');
  });

  it('changes the language at runtime and turns it off with null', () => {
    const render = createView();
    expect(render({ translationLanguage: { languageCode: 'es-ES' } })).toBe('es-ES');
    expect(render({ translationLanguage: { languageCode: 'de-DE' } })).toBe('de-DE');
    expect(render({ translationLanguage: { languageCode: null } })).toBe('');
    render({ translationLanguage: { languageCode: 'de-DE' } });
    expect(render({ translationLanguage: null })).toBe('');
  });

  it('keeps the previous language and warns for invalid values', () => {
    const render = createView();
    render({ translationLanguage: { languageCode: 'fr-FR' } });
    expect(render({ translationLanguage: { languageCode: 'xx-YY' } })).toBe('fr-FR');
    expect(render({ translationLanguage: 'es-ES' })).toBe('fr-FR');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('keeps state per stream', () => {
    const renderA = createView('stream-a');
    const renderB = createView('stream-b');
    renderA({ translationLanguage: { languageCode: 'fr-FR' } });
    expect(renderB({ translationLanguage: { languageCode: 'xx-YY' } })).toBe('');
  });
});

describe('OTPublisher inputLanguage', () => {
  const createPublisher = (properties) => {
    const publisher = new OTPublisher({
      ...OTPublisher.defaultProps,
      properties,
    });
    publisher.setState = (update) => {
      const next =
        typeof update === 'function' ? update(publisher.state) : update;
      publisher.state = { ...publisher.state, ...next };
    };
    const update = (nextProperties) => {
      publisher.props = { ...publisher.props, properties: nextProperties };
      publisher.componentDidUpdate();
      return publisher.state.publisherProperties.inputLanguage;
    };
    return {
      initial: publisher.state.publisherProperties.inputLanguage,
      update,
      current: () => publisher.state.publisherProperties,
    };
  };

  it('defaults to an empty string', () => {
    expect(createPublisher({}).initial).toBe('');
  });

  it('applies the language set at mount', () => {
    expect(
      createPublisher({ publishCaptions: true, inputLanguage: 'it-IT' })
        .initial
    ).toBe('it-IT');
  });

  it('changes the language while publishing and resets it with null', () => {
    const { update } = createPublisher({ inputLanguage: 'it-IT' });
    expect(update({ inputLanguage: 'en-US' })).toBe('en-US');
    expect(update({ inputLanguage: null })).toBe('');
  });

  it('applies no language and warns for an invalid value at mount', () => {
    expect(createPublisher({ inputLanguage: 'english' }).initial).toBe(
      ''
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('inputLanguage');
  });

  it('keeps the previous language for an invalid value at runtime', () => {
    const { update } = createPublisher({ inputLanguage: 'it-IT' });
    expect(update({ inputLanguage: 'xx-YY' })).toBe('it-IT');
  });

  it('keeps the other sanitized properties', () => {
    const { update, current } = createPublisher({ publishCaptions: true });
    update({ publishCaptions: true, inputLanguage: 'es-ES' });
    expect(current()).toMatchObject({
      publishCaptions: true,
      publishAudio: true,
      inputLanguage: 'es-ES',
    });
  });
});
