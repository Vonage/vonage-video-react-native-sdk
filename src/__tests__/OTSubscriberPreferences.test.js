jest.mock('../OTSubscriberNativeComponent', () => 'OTRNSubscriber');
jest.mock('../OT', () => ({ OT: { removeSubscriber: jest.fn() } }));
import OTSubscriberView from '../OTSubscriberView';
import { sanitizeStreamProperties } from '../helpers/OTSubscriberHelper';

function renderedProps(properties, streamProperties = {}) {
  const view = new OTSubscriberView({ streamId: 'remote-a' });
  view.context = {
    sessionId: 'audit-session',
    subscriberProperties: properties,
    streamProperties,
    eventHandlers: {},
  };
  return view.render().props;
}

describe('Resolution crosses the actual component/native boundary', () => {
  it('control: passes a global resolution string to the string native prop', () => {
    expect(
      renderedProps({ preferredResolution: '640x480' }).preferredResolution
    ).toBe('640x480');
  });

  it('serializes a supported public resolution object for the native string prop', () => {
    expect(
      renderedProps({ preferredResolution: { width: 640, height: 480 } })
        .preferredResolution
    ).toBe('640x480');
  });

  it('preserves the documented per-stream resolution string through sanitization', () => {
    const streamProperties = { 'remote-a': { preferredResolution: '640x480' } };
    sanitizeStreamProperties(streamProperties);
    expect(renderedProps({}, streamProperties).preferredResolution).toBe(
      '640x480'
    );
  });
});

describe('Resolution defaults and partial objects', () => {
  it('fills an omitted object dimension with the unlimited value', () => {
    expect(
      renderedProps({ preferredResolution: { width: 640 } }).preferredResolution
    ).toBe('640x32767');
  });

  it('resets a null resolution to the unlimited native string', () => {
    expect(
      renderedProps({ preferredResolution: null }).preferredResolution
    ).toBe('32767x32767');
  });

  it('serializes per-stream object dimensions after sanitization', () => {
    const streams = {
      'remote-a': { preferredResolution: { width: 640, height: 480 } },
    };
    sanitizeStreamProperties(streams);
    expect(renderedProps({}, streams).preferredResolution).toBe('640x480');
  });
});

describe('A partial per-stream override inherits global settings', () => {
  it('control: uses global volume, captions and frame rate without an override', () => {
    expect(
      renderedProps({
        audioVolume: 0,
        subscribeToCaptions: true,
        preferredFrameRate: 7,
      })
    ).toMatchObject({
      audioVolume: 0,
      subscribeToCaptions: true,
      preferredFrameRate: 7,
    });
  });

  it('keeps explicit zero and false stream overrides', () => {
    expect(
      renderedProps(
        { audioVolume: 100, subscribeToCaptions: true, preferredFrameRate: 15 },
        { 'remote-a': { audioVolume: 0, subscribeToCaptions: false } }
      )
    ).toMatchObject({
      audioVolume: 0,
      subscribeToCaptions: false,
      preferredFrameRate: 15,
    });
  });

  it('uses audible playback and unrestricted preference defaults when omitted', () => {
    expect(renderedProps({})).toMatchObject({
      audioVolume: 100,
      subscribeToCaptions: false,
      preferredFrameRate: 32767,
      preferredResolution: '32767x32767',
    });
  });

  it('keeps global volume, captions and frame rate when only scaleBehavior changes', () => {
    expect(
      renderedProps(
        { audioVolume: 0, subscribeToCaptions: true, preferredFrameRate: 7 },
        { 'remote-a': { scaleBehavior: 'fit' } }
      )
    ).toMatchObject({
      audioVolume: 0,
      subscribeToCaptions: true,
      preferredFrameRate: 7,
    });
  });
});

describe('Malformed resolution strings and undefined stream fields', () => {
  it.each(['', '640', '0x480', '640x0', 'axb', '99999x480', '640x480x2'])(
    'falls back to unlimited for malformed resolution %p',
    (preferredResolution) => {
      expect(renderedProps({ preferredResolution }).preferredResolution).toBe(
        '32767x32767'
      );
    }
  );

  it('does not let undefined stream fields erase global preferences', () => {
    expect(
      renderedProps(
        {
          audioVolume: 0,
          subscribeToCaptions: true,
          preferredFrameRate: 7,
          preferredResolution: '640x480',
        },
        {
          'remote-a': {
            scaleBehavior: 'fit',
            audioVolume: undefined,
            subscribeToCaptions: undefined,
            preferredFrameRate: undefined,
            preferredResolution: undefined,
          },
        }
      )
    ).toMatchObject({
      audioVolume: 0,
      subscribeToCaptions: true,
      preferredFrameRate: 7,
      preferredResolution: '640x480',
    });
  });
});
