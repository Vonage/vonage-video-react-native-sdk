// Mock the native module boundary so importing OTSubscriber never touches
// the TurboModule / native side in the jest environment.
jest.mock('../OT', () => ({
  OT: {
    getSubscriberRtcStatsReport: jest.fn(),
  },
  nativeEvents: {},
  checkAndroidPermissions: jest.fn(),
}));

// OTSubscriberView is only used inside render(); we never render here, but
// mocking it keeps the import graph free of native dependencies.
jest.mock('../OTSubscriberView', () => 'OTSubscriberView');

import OTSubscriber from '../OTSubscriber';

// Build a real OTSubscriber instance without rendering it. The constructor
// registers event listeners and sets initial state, then we exercise the
// production `streamCreatedHandler` directly. `setState` is replaced with a
// spy that captures the updater function so we can assert its semantics
// against a simulated prevState (per the design's Testing Strategy).
const createSubscriber = () => {
  const context = { sessionId: 'session-subscriber-dedupe' };
  const props = {
    properties: {},
    eventHandlers: {},
    streamProperties: {},
    containerStyle: {},
    subscribeToSelf: false,
    getRtcStatsReport: {},
  };
  const instance = new OTSubscriber(props, context);
  // React sets this.context from contextType during real mounting; set it
  // manually since we bypass the renderer.
  instance.context = context;
  return instance;
};

// Applies the setState updater the same way React would: call the updater
// with prevState and merge the (possibly null) partial state back.
const applyStreamCreated = (instance, prevState, stream) => {
  let updater;
  instance.setState = jest.fn((fn) => {
    updater = fn;
  });
  instance.streamCreatedHandler(stream);
  expect(instance.setState).toHaveBeenCalledTimes(1);
  const partial = updater(prevState);
  const nextState =
    partial === null ? prevState : { ...prevState, ...partial };
  return { partial, nextState };
};

describe('OTSubscriber streamCreatedHandler dedupe', () => {
  it('adds a new streamId as a brand-new array (no mutation of prevState)', () => {
    const instance = createSubscriber();
    const prevStreams = ['existing-stream'];
    const prevState = { streams: prevStreams };

    const { partial, nextState } = applyStreamCreated(instance, prevState, {
      streamId: 'new-stream',
    });

    // A partial state was returned (not a no-op).
    expect(partial).not.toBeNull();
    // The stream was added exactly once.
    expect(nextState.streams).toEqual(['existing-stream', 'new-stream']);
    // The returned array is a new reference, not the same as prevState's.
    expect(partial.streams).not.toBe(prevStreams);
    // prevState.streams was not mutated in place.
    expect(prevStreams).toEqual(['existing-stream']);
  });

  it('returns null (no-op) when the streamId is already tracked', () => {
    const instance = createSubscriber();
    const prevStreams = ['already-tracked'];
    const prevState = { streams: prevStreams };

    const { partial, nextState } = applyStreamCreated(instance, prevState, {
      streamId: 'already-tracked',
    });

    // No new state -> React skips the re-render.
    expect(partial).toBeNull();
    // No duplicate was introduced.
    expect(nextState.streams).toEqual(['already-tracked']);
    // prevState untouched.
    expect(prevStreams).toEqual(['already-tracked']);
  });

  it('does not duplicate when the same stream is added twice in sequence', () => {
    const instance = createSubscriber();
    let state = { streams: [] };

    // First add: new array with the stream.
    const first = applyStreamCreated(instance, state, {
      streamId: 'stream-x',
    });
    expect(first.partial).not.toBeNull();
    state = first.nextState;
    expect(state.streams).toEqual(['stream-x']);

    // Second add of the SAME stream: no-op.
    const second = applyStreamCreated(instance, state, {
      streamId: 'stream-x',
    });
    expect(second.partial).toBeNull();
    expect(second.nextState.streams).toEqual(['stream-x']);
  });
});
