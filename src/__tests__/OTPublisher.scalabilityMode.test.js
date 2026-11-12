jest.mock('../NativeOpentok', () => ({
  __esModule: true,
  default: {
    publish: jest.fn(),
    unpublish: jest.fn(),
    setTargetScalabilityMode: jest.fn(),
    getTargetScalabilityMode: jest.fn(),
    addNativeEvents: jest.fn(),
  },
}));

jest.mock('../OT', () => ({
  OT: {
    publish: jest.fn(),
    unpublish: jest.fn(),
    setTargetScalabilityMode: jest.fn(),
    getTargetScalabilityMode: jest.fn(),
  },
  checkAndroidPermissions: jest.fn(() => Promise.resolve()),
  nativeEvents: {},
}));

jest.mock('../helpers/OTSessionHelper', () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  isConnected: jest.fn(() => false),
  getPublisherStream: jest.fn(() => null),
}));

jest.mock('../OTPublisherNativeComponent', () => 'OTRNPublisher');

jest.mock('react-native-uuid', () => ({ v4: () => 'pub-1' }));

jest.mock('../contexts/OTContext', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.createContext({ sessionId: 'sid-1' }),
  };
});

import OTPublisher from '../OTPublisher';
import { OT } from '../OT';

const VALID_MODES = [
  'L1T1',
  'L1T2',
  'L1T3',
  'L2T1',
  'L2T2',
  'L2T3',
  'L3T1',
  'L3T2',
  'L3T3',
];

const nativeError = (code, message) =>
  Object.assign(new Error(message), { code });

describe('OTPublisher target scalability mode', () => {
  let publisher;

  beforeEach(() => {
    jest.clearAllMocks();
    OT.setTargetScalabilityMode.mockReset();
    OT.setTargetScalabilityMode.mockResolvedValue(undefined);
    OT.getTargetScalabilityMode.mockReset();
    publisher = new OTPublisher({ eventHandlers: {}, properties: {} });
    publisher.context = { sessionId: 'sid-1' };
    publisher.state = { ...publisher.state, publisherId: 'pub-1' };
  });

  describe('setTargetScalabilityMode', () => {
    it.each(VALID_MODES)('forwards %s to the native module', async (mode) => {
      await expect(
        publisher.setTargetScalabilityMode(mode)
      ).resolves.toBeUndefined();
      expect(OT.setTargetScalabilityMode).toHaveBeenCalledWith(
        'sid-1',
        'pub-1',
        mode
      );
    });

    it.each(['', 'L4T1', 'l1t1', null, undefined, 3])(
      'rejects invalid mode %p without calling native',
      async (mode) => {
        await expect(publisher.setTargetScalabilityMode(mode)).rejects.toThrow(
          `setTargetScalabilityMode: mode must be one of L1T1, L1T2, L1T3, L2T1, L2T2, L2T3, L3T1, L3T2, L3T3 (got "${mode}").`
        );
        expect(OT.setTargetScalabilityMode).not.toHaveBeenCalled();
      }
    );

    it('rejects with the native error when the publisher does not exist', async () => {
      OT.setTargetScalabilityMode.mockRejectedValue(
        nativeError('OT_INVALID_STATE', 'Publisher not found.')
      );

      await expect(
        publisher.setTargetScalabilityMode('L1T2')
      ).rejects.toMatchObject({ code: 'OT_INVALID_STATE' });
    });

    it('rejects with the native error when the SDK refuses the mode', async () => {
      OT.setTargetScalabilityMode.mockRejectedValue(
        nativeError('OT_INVALID_PARAMETER', 'Invalid scalability mode')
      );

      await expect(
        publisher.setTargetScalabilityMode('L1T2')
      ).rejects.toMatchObject({ code: 'OT_INVALID_PARAMETER' });
    });
  });

  describe('getTargetScalabilityMode', () => {
    it('resolves the value reported by the native module', async () => {
      OT.getTargetScalabilityMode.mockResolvedValue('L2T3');

      await expect(publisher.getTargetScalabilityMode()).resolves.toBe('L2T3');
      expect(OT.getTargetScalabilityMode).toHaveBeenCalledWith(
        'sid-1',
        'pub-1'
      );
    });

    it('maps a native null to undefined', async () => {
      OT.getTargetScalabilityMode.mockResolvedValue(null);

      await expect(
        publisher.getTargetScalabilityMode()
      ).resolves.toBeUndefined();
    });

    it('rejects with the native error when the publisher does not exist', async () => {
      OT.getTargetScalabilityMode.mockRejectedValue(
        nativeError('OT_INVALID_STATE', 'Publisher not found.')
      );

      await expect(publisher.getTargetScalabilityMode()).rejects.toMatchObject({
        code: 'OT_INVALID_STATE',
      });
    });
  });
});
