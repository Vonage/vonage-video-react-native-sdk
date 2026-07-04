// Regression test for PR #152 review: parsing iOS jsonStats must keep the
// wrapper's `stream` field and must not throw on malformed JSON.

jest.mock('react-native', () => ({}));
jest.mock('../OT', () => ({ OT: {} }));
jest.mock('../OTSubscriberNativeComponent', () => 'OTRNSubscriber');

import OTSubscriberView from '../OTSubscriberView';

function handlersFrom(eventHandlers) {
  const view = new OTSubscriberView({ streamId: 's1' });
  view.context = {
    sessionId: 'sid-1',
    subscriberProperties: {},
    streamProperties: {},
    eventHandlers,
    style: {},
  };
  const el = view.render(); // root is the <OTRNSubscriber> element
  return el.props;
}

const stream = { streamId: 's1' };

describe('OTSubscriberView network-stats parsing', () => {
  it('audio: merges parsed stats and keeps the stream field', () => {
    const spy = jest.fn();
    const props = handlersFrom({ audioNetworkStats: spy });
    props.onAudioNetworkStats({
      nativeEvent: { stream, jsonStats: JSON.stringify({ audioBytesReceived: 5, timestamp: 9 }) },
    });
    expect(spy).toHaveBeenCalledWith({ stream, audioBytesReceived: 5, timestamp: 9 });
  });

  it('video: merges parsed stats and keeps the stream field', () => {
    const spy = jest.fn();
    const props = handlersFrom({ videoNetworkStats: spy });
    props.onVideoNetworkStats({
      nativeEvent: { stream, jsonStats: JSON.stringify({ videoBytesReceived: 7, timestamp: 3 }) },
    });
    expect(spy).toHaveBeenCalledWith({ stream, videoBytesReceived: 7, timestamp: 3 });
  });

  it('does not throw on malformed jsonStats (keeps stream)', () => {
    const spy = jest.fn();
    const props = handlersFrom({ audioNetworkStats: spy });
    expect(() =>
      props.onAudioNetworkStats({ nativeEvent: { stream, jsonStats: '{not json' } })
    ).not.toThrow();
    expect(spy).toHaveBeenCalledWith({ stream });
  });

  it('passes the event through unchanged when there is no jsonStats (Android shape)', () => {
    const spy = jest.fn();
    const props = handlersFrom({ audioNetworkStats: spy });
    const native = { stream, audioBytesReceived: 1 };
    props.onAudioNetworkStats({ nativeEvent: native });
    expect(spy).toHaveBeenCalledWith(native);
  });
});
