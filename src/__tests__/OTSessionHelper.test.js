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

  describe('addStream', () => {
    afterEach(() => {
      clearStreams('test-session');
    });

    it('initializes array and stores the first stream of a session', () => {
      addStream('test-session', 'stream-1');
      expect(getStreams('test-session')).toEqual(['stream-1']);
    });

    it('does not duplicate an already-added stream', () => {
      addStream('test-session', 'stream-1');
      addStream('test-session', 'stream-1');
      expect(getStreams('test-session')).toEqual(['stream-1']);
    });

    it('stores multiple distinct streams', () => {
      addStream('test-session', 'stream-1');
      addStream('test-session', 'stream-2');
      expect(getStreams('test-session')).toEqual(['stream-1', 'stream-2']);
    });
  });
});
