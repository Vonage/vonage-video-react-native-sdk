/**
 * Preservation Property Tests - Existing Instance Methods and Lifecycle Unchanged
 *
 * These tests verify that existing OTPublisher behavior is preserved.
 * They MUST PASS on the UNFIXED code — passing confirms baseline behavior.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import React from 'react';

// Mock the NativeOpentok TurboModule
jest.mock('../NativeOpentok', () => ({
  __esModule: true,
  default: {
    initSession: jest.fn(),
    connect: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
    getPublisherRtcStatsReport: jest.fn(),
    setVideoTransformers: jest.fn(),
    setAudioTransformers: jest.fn(),
    addNativeEvents: jest.fn(),
  },
}));

// Mock OT.js to spy on getPublisherRtcStatsReport, publish, unpublish
jest.mock('../OT', () => ({
  OT: {
    initSession: jest.fn(),
    connect: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
    getPublisherRtcStatsReport: jest.fn(),
    setVideoTransformers: jest.fn(),
    setAudioTransformers: jest.fn(),
  },
  checkAndroidPermissions: jest.fn(() => Promise.resolve()),
  nativeEvents: {},
}));

// Mock helpers/OTSessionHelper
jest.mock('../helpers/OTSessionHelper', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  isConnected: jest.fn(() => false),
  getPublisherStream: jest.fn(() => null),
}));

// Mock helpers/OTPublisherHelper
jest.mock('../helpers/OTPublisherHelper', () => ({
  sanitizeProperties: jest.fn((props) => ({
    publishAudio: true,
    publishVideo: true,
    audioTrack: true,
    videoTrack: true,
    videoSource: 'camera',
    ...props,
  })),
}));

// Mock OTPublisherNativeComponent (Fabric component)
jest.mock('../OTPublisherNativeComponent', () => 'OTRNPublisher');

// Mock react-native-uuid
jest.mock('react-native-uuid', () => ({
  v4: () => 'mock-publisher-id-preservation',
}));

// Mock OTContext
jest.mock('../contexts/OTContext', () => {
  const React = require('react');
  const context = React.createContext({ sessionId: 'test-session-id' });
  return { __esModule: true, default: context };
});

import OTPublisher from '../OTPublisher';
import { OT } from '../OT';
import {
  addEventListener,
  removeEventListener,
  dispatchEvent,
  isConnected,
  getPublisherStream,
} from '../helpers/OTSessionHelper';

describe('Preservation: Existing Instance Methods and Lifecycle Unchanged', () => {
  let instance;
  const mockSessionId = 'test-session-id';
  const mockPublisherId = 'mock-publisher-id-preservation';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create an instance of OTPublisher with mocked context
    instance = new OTPublisher({
      eventHandlers: {},
      properties: {},
      style: { flex: 1 },
    });

    // Manually set context (simulating React context injection)
    instance.context = { sessionId: mockSessionId };
    // Ensure state has publisherId
    instance.state = {
      ...instance.state,
      publisherId: mockPublisherId,
    };
  });

  describe('Property: getRtcStatsReport() delegates to OT.getPublisherRtcStatsReport', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * Property: For all valid sessionId/publisherId combinations,
     * getRtcStatsReport() delegates to OT.getPublisherRtcStatsReport(sessionId, publisherId)
     */

    it('should be a callable function on the OTPublisher instance', () => {
      expect(typeof instance.getRtcStatsReport).toBe('function');
    });

    it('should delegate to OT.getPublisherRtcStatsReport with sessionId and publisherId', () => {
      instance.getRtcStatsReport();

      expect(OT.getPublisherRtcStatsReport).toHaveBeenCalledWith(
        mockSessionId,
        mockPublisherId
      );
    });

    it.each([
      ['session-abc-123', 'pub-xyz-789'],
      ['session-empty', 'pub-001'],
      ['s1', 'p1'],
      ['long-session-id-with-many-characters-12345', 'long-pub-id-67890'],
    ])(
      'should delegate with sessionId=%s and publisherId=%s',
      (sessionId, publisherId) => {
        instance.context = { sessionId };
        instance.state = { ...instance.state, publisherId };

        instance.getRtcStatsReport();

        expect(OT.getPublisherRtcStatsReport).toHaveBeenCalledWith(
          sessionId,
          publisherId
        );
      }
    );
  });

  describe('Property: Event handlers are registered and callable', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * Property: For all valid event handler configurations,
     * event handlers are registered and callable
     */

    it.each([
      'streamCreated',
      'streamDestroyed',
      'error',
      'audioLevel',
      'audioNetworkStats',
      'rtcStatsReport',
      'videoDisabled',
      'videoDisableWarning',
      'videoDisableWarningLifted',
      'videoEnabled',
      'videoNetworkStats',
    ])('should register %s event handler from props', (eventName) => {
      const handler = jest.fn();
      const eventHandlers = { [eventName]: handler };

      const publisherInstance = new OTPublisher({
        eventHandlers,
        properties: {},
        style: { flex: 1 },
      });

      // Verify the handler was stored
      expect(publisherInstance.eventHandlers[eventName]).toBe(handler);
    });

    it('should accept an empty eventHandlers object without errors', () => {
      expect(() => {
        const publisherInstance = new OTPublisher({
          eventHandlers: {},
          properties: {},
          style: { flex: 1 },
        });
      }).not.toThrow();
    });

    it('should accept multiple event handlers simultaneously', () => {
      const handlers = {
        streamCreated: jest.fn(),
        error: jest.fn(),
        audioLevel: jest.fn(),
        videoEnabled: jest.fn(),
      };

      const publisherInstance = new OTPublisher({
        eventHandlers: handlers,
        properties: {},
        style: { flex: 1 },
      });

      expect(publisherInstance.eventHandlers.streamCreated).toBe(
        handlers.streamCreated
      );
      expect(publisherInstance.eventHandlers.error).toBe(handlers.error);
      expect(publisherInstance.eventHandlers.audioLevel).toBe(
        handlers.audioLevel
      );
      expect(publisherInstance.eventHandlers.videoEnabled).toBe(
        handlers.videoEnabled
      );
    });
  });

  describe('Lifecycle: Component mount triggers OT.publish when session is connected', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * Test: component mount triggers OT.publish(sessionId, publisherId)
     * when session is connected
     */

    it('should call OT.publish on sessionConnected callback (iOS path)', () => {
      // Simulate the onSessionConnected callback being triggered
      // which happens when session connects after component mount
      jest.clearAllMocks();

      const publisherInstance = new OTPublisher({
        eventHandlers: {},
        properties: {},
        style: { flex: 1 },
      });
      publisherInstance.context = { sessionId: mockSessionId };
      publisherInstance.state = {
        ...publisherInstance.state,
        publisherId: mockPublisherId,
      };

      // Simulate the session connected event (iOS path - no permissions check)
      // On iOS, onSessionConnected directly calls OT.publish
      publisherInstance.onSessionConnected();

      expect(OT.publish).toHaveBeenCalledWith(mockSessionId, mockPublisherId);
    });

    it('should register sessionConnected event listener on componentDidMount', () => {
      jest.clearAllMocks();

      const publisherInstance = new OTPublisher({
        eventHandlers: {},
        properties: {},
        style: { flex: 1 },
      });
      publisherInstance.context = { sessionId: mockSessionId };

      publisherInstance.componentDidMount();

      expect(addEventListener).toHaveBeenCalledWith(
        mockSessionId,
        'sessionConnected',
        publisherInstance.onSessionConnected
      );
    });
  });

  describe('Lifecycle: Component unmount triggers OT.unpublish', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * Test: component unmount triggers OT.unpublish(sessionId, publisherId)
     */

    it('should call OT.unpublish on componentWillUnmount', () => {
      jest.clearAllMocks();
      getPublisherStream.mockReturnValue(null);

      const publisherInstance = new OTPublisher({
        eventHandlers: {},
        properties: {},
        style: { flex: 1 },
      });
      publisherInstance.context = { sessionId: mockSessionId };
      publisherInstance.state = {
        ...publisherInstance.state,
        publisherId: mockPublisherId,
      };

      publisherInstance.componentWillUnmount();

      expect(OT.unpublish).toHaveBeenCalledWith(
        mockSessionId,
        mockPublisherId
      );
    });

    it('should remove sessionConnected event listener on componentWillUnmount', () => {
      jest.clearAllMocks();
      getPublisherStream.mockReturnValue(null);

      const publisherInstance = new OTPublisher({
        eventHandlers: {},
        properties: {},
        style: { flex: 1 },
      });
      publisherInstance.context = { sessionId: mockSessionId };
      publisherInstance.state = {
        ...publisherInstance.state,
        publisherId: mockPublisherId,
      };

      publisherInstance.componentWillUnmount();

      expect(removeEventListener).toHaveBeenCalledWith(
        mockSessionId,
        'sessionConnected',
        publisherInstance.onSessionConnected
      );
    });

    it('should dispatch publisherStreamDestroyed if there is an active publisher stream', () => {
      jest.clearAllMocks();
      const mockStreamId = 'stream-123';
      getPublisherStream.mockReturnValue(mockStreamId);

      const streamDestroyedHandler = jest.fn();
      const publisherInstance = new OTPublisher({
        eventHandlers: { streamDestroyed: streamDestroyedHandler },
        properties: {},
        style: { flex: 1 },
      });
      publisherInstance.context = { sessionId: mockSessionId };
      publisherInstance.state = {
        ...publisherInstance.state,
        publisherId: mockPublisherId,
      };

      publisherInstance.componentWillUnmount();

      expect(OT.unpublish).toHaveBeenCalledWith(
        mockSessionId,
        mockPublisherId
      );
      expect(dispatchEvent).toHaveBeenCalledWith(
        mockSessionId,
        'publisherStreamDestroyed',
        {
          streamId: mockStreamId,
          nativeEvent: { streamId: mockStreamId },
        }
      );
      expect(streamDestroyedHandler).toHaveBeenCalledWith({ streamId: mockStreamId });
    });
  });
});
