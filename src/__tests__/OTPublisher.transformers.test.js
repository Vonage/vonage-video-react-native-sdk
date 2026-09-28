/**
 * Bug Condition Exploration Test - Transformer Methods Missing on OTPublisher Ref
 *
 * This test encodes the EXPECTED behavior after the fix is applied.
 * On UNFIXED code, these tests MUST FAIL — failure confirms the bug exists.
 *
 * Validates: Requirements 1.1, 1.2
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

// Mock OT.js to spy on setVideoTransformers and setAudioTransformers
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
  v4: () => 'mock-publisher-id-1234',
}));

// Mock OTContext
jest.mock('../contexts/OTContext', () => {
  const React = require('react');
  const context = React.createContext({ sessionId: 'test-session-id' });
  return { __esModule: true, default: context };
});

import OTPublisher from '../OTPublisher';
import { OT } from '../OT';

describe('Bug Condition: Transformer Methods Missing on OTPublisher Ref', () => {
  let instance;
  const mockSessionId = 'test-session-id';
  const mockPublisherId = 'mock-publisher-id-1234';

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

  describe('setVideoTransformers', () => {
    it('should be a callable function on the OTPublisher instance', () => {
      // This test will FAIL on unfixed code with:
      // TypeError: instance.setVideoTransformers is not a function
      expect(typeof instance.setVideoTransformers).toBe('function');
    });

    it('should delegate to OT.setVideoTransformers with sessionId, publisherId, and transformers', () => {
      // This test will FAIL on unfixed code with:
      // TypeError: instance.setVideoTransformers is not a function
      const transformers = [
        { name: 'BackgroundBlur', properties: '{ "radius": "High" }' },
      ];

      instance.setVideoTransformers(transformers);

      expect(OT.setVideoTransformers).toHaveBeenCalledWith(
        mockSessionId,
        mockPublisherId,
        transformers
      );
    });
  });

  describe('setAudioTransformers', () => {
    it('should be a callable function on the OTPublisher instance', () => {
      // This test will FAIL on unfixed code with:
      // TypeError: instance.setAudioTransformers is not a function
      expect(typeof instance.setAudioTransformers).toBe('function');
    });

    it('should delegate to OT.setAudioTransformers with sessionId, publisherId, and transformers', () => {
      // This test will FAIL on unfixed code with:
      // TypeError: instance.setAudioTransformers is not a function
      const transformers = [{ name: 'NoiseSuppression' }];

      instance.setAudioTransformers(transformers);

      expect(OT.setAudioTransformers).toHaveBeenCalledWith(
        mockSessionId,
        mockPublisherId,
        transformers
      );
    });
  });
});
