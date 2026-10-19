import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('../OTSubscriberNativeComponent', () => 'OTRNSubscriber');
jest.mock('../helpers/OTHelper', () => ({
  ...jest.requireActual('../helpers/OTHelper'),
  logOT: jest.fn(),
}));
jest.mock('../OT', () => ({
  OT: Object.fromEntries(
    [
      'initSession',
      'connect',
      'disconnect',
      'removeSubscriber',
      'onSessionConnected',
      'onStreamCreated',
      'onStreamDestroyed',
      'onSignalReceived',
      'onSessionError',
      'onConnectionCreated',
      'onConnectionDestroyed',
      'onArchiveStarted',
      'onArchiveStopped',
      'onMuteForced',
      'onSessionReconnecting',
      'onSessionReconnected',
      'onStreamPropertyChanged',
      'onSessionDisconnected',
    ].map((name) => [name, jest.fn(() => ({ remove: jest.fn() }))])
  ),
}));

import OTSession from '../OTSession';
import OTSubscriber from '../OTSubscriber';
import OTContext from '../contexts/OTContext';
import { OT } from '../OT';
import {
  addStream,
  getStreams,
  clearStreams,
} from '../helpers/OTSessionHelper';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('Actual React rendering after late subscriber mount', () => {
  let tree;
  let session;
  let subscriber;
  let emitCreated;
  let sessionId;
  let serial = 0;

  async function mount(initialStreams) {
    sessionId = `audit-late-${++serial}`;
    initialStreams.forEach((id) => addStream(sessionId, id));
    session = new OTSession({
      ...OTSession.defaultProps,
      apiKey: 'dummy',
      sessionId,
      token: 'dummy',
    });
    emitCreated = OT.onStreamCreated.mock.calls.at(-1)[0];
    await act(async () => {
      tree = TestRenderer.create(
        <OTContext.Provider value={{ sessionId }}>
          <OTSubscriber
            ref={(instance) => {
              subscriber = instance;
            }}
          />
        </OTContext.Provider>
      );
    });
  }

  async function newStream(streamId) {
    await act(async () => {
      emitCreated({ sessionId, connectionId: 'remote-peer', streamId });
    });
  }

  afterEach(async () => {
    if (tree) await act(async () => tree.unmount());
    session?.componentWillUnmount();
    clearStreams(sessionId);
    tree = null;
  });

  it('control: renders a new stream when mounted before the registry exists', async () => {
    await mount([]);
    await newStream('remote-a');
    expect(tree.root.findAllByType('OTRNSubscriber')).toHaveLength(1);
    await newStream('remote-b');
    expect(tree.root.findAllByType('OTRNSubscriber')).toHaveLength(2);
  });

  it('renders a new stream when mounted after a remote stream already exists', async () => {
    await mount(['remote-a']);
    expect(tree.root.findAllByType('OTRNSubscriber')).toHaveLength(1);
    await newStream('remote-b');
    expect(getStreams(sessionId)).toEqual(['remote-a', 'remote-b']);
    expect(subscriber.state.streams).toEqual(['remote-a', 'remote-b']);
    expect(tree.root.findAllByType('OTRNSubscriber')).toHaveLength(2);
  });

  it('control: does not duplicate a repeated remote-stream event', async () => {
    await mount(['remote-a']);
    await newStream('remote-a');
    expect(tree.root.findAllByType('OTRNSubscriber')).toHaveLength(1);
  });
});
