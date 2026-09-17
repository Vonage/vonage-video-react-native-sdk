import {
  addEventListener,
  clearStreams,
  dispatchEvent,
  getPublisherStream,
  removeEventListener,
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

  describe('removeEventListener', () => {
    it('removes only the matching listener and keeps the others', () => {
      // Unique sessionId per test: the module keeps a shared registry.
      const sessionId = 'session-remove-only-matching';
      const listenerA = jest.fn();
      const listenerB = jest.fn();

      addEventListener(sessionId, 'streamCreated', listenerA);
      addEventListener(sessionId, 'streamCreated', listenerB);

      removeEventListener(sessionId, 'streamCreated', listenerA);

      dispatchEvent(sessionId, 'streamCreated', { streamId: 'stream-1' });

      expect(listenerA).not.toHaveBeenCalled();
      expect(listenerB).toHaveBeenCalledWith({ streamId: 'stream-1' });
    });

    it('dispatches nothing after the last remaining listener is removed', () => {
      const sessionId = 'session-remove-last';
      const listener = jest.fn();

      addEventListener(sessionId, 'streamCreated', listener);
      removeEventListener(sessionId, 'streamCreated', listener);

      // Type key should have been cleaned up; dispatch must not throw or call.
      expect(() =>
        dispatchEvent(sessionId, 'streamCreated', { streamId: 'stream-2' })
      ).not.toThrow();
      expect(listener).not.toHaveBeenCalled();
    });

    it('is a no-op when removing a listener that was never added', () => {
      const sessionId = 'session-remove-unknown-listener';
      const registered = jest.fn();
      const neverAdded = jest.fn();

      addEventListener(sessionId, 'streamCreated', registered);

      removeEventListener(sessionId, 'streamCreated', neverAdded);

      dispatchEvent(sessionId, 'streamCreated', { streamId: 'stream-3' });

      // The registered listener survives the no-op removal.
      expect(registered).toHaveBeenCalledWith({ streamId: 'stream-3' });
      expect(neverAdded).not.toHaveBeenCalled();
    });

    it('does not throw for an unknown sessionId or type', () => {
      expect(() =>
        removeEventListener('session-never-seen', 'streamCreated', jest.fn())
      ).not.toThrow();

      const sessionId = 'session-known-unknown-type';
      addEventListener(sessionId, 'streamCreated', jest.fn());
      expect(() =>
        removeEventListener(sessionId, 'streamDestroyed', jest.fn())
      ).not.toThrow();
    });
  });

  it('sanitizes session options', () => {
    const result = sanitizeSessionOptions({
      apiUrl: 42,
      connectionEventsSuppressed: true,
    });

    expect(result.apiUrl).toBe('');
    expect(result.connectionEventsSuppressed).toBe(true);
  });
});
