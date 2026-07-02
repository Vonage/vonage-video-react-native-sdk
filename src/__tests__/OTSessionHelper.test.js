import {
  addEventListener,
  addStream,
  clearStreams,
  dispatchEvent,
  getPublisherStream,
  getStreams,
  sanitizeSessionOptions,
} from '../helpers/OTSessionHelper';

describe('OTSessionHelper', () => {
  it('dispatches publisher stream events and tracks publisher stream', () => {
    const sessionId = 'session-1';
    const listener = jest.fn();

    addEventListener(sessionId, 'publisherStreamCreated', listener);
    dispatchEvent(sessionId, 'publisherStreamCreated', {
      streamId: 'stream-1',
    });

    expect(listener).toHaveBeenCalledWith({ streamId: 'stream-1' });
    expect(getPublisherStream(sessionId)).toBe('stream-1');

    clearStreams(sessionId);
  });

  it('sanitizes session options', () => {
    const result = sanitizeSessionOptions({
      apiUrl: 42,
      connectionEventsSuppressed: true,
    });

    expect(result.apiUrl).toBe('');
    expect(result.connectionEventsSuppressed).toBe(true);
  });

  // Regression: addStream no-op'd on the first stream of a session because the
  // per-session array was never initialized, so the first remote stream was lost.
  it('tracks the first stream of a session', () => {
    const sessionId = 'session-addstream';

    addStream(sessionId, 'stream-1');
    addStream(sessionId, 'stream-2');
    addStream(sessionId, 'stream-1'); // dedupe

    expect(getStreams(sessionId)).toEqual(['stream-1', 'stream-2']);

    clearStreams(sessionId);
  });
});
