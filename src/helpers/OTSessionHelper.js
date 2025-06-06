import { Platform } from 'react-native';
import { reassignEvents } from './OTHelper';
import { handleSignalError, handleError } from '../OTError';
import {
  each,
  isNull,
  isEmpty,
  isString,
  isBoolean,
  isObject,
  isArray
} from 'underscore';

const validateString = (value) => (isString(value) ? value : '');

const validateBoolean = (value) => (isBoolean(value) ? value : false);

const validateObject = (value) => (isObject(value) ? value : {});

const validateArray = (value) => (isArray(value) ? value : []);

const sanitizeSessionEvents = (sessionId, events) => {
  if (typeof events !== 'object') {
    return {};
  }
  const customEvents = {
    ios: {
      streamCreated: 'streamCreated',
      streamDestroyed: 'streamDestroyed',
      sessionConnected: 'sessionDidConnect',
      sessionDisconnected: 'sessionDidDisconnect',
      signal: 'signal',
      connectionCreated: 'connectionCreated',
      connectionDestroyed: 'connectionDestroyed',
      error: 'didFailWithError',
      sessionReconnected: 'sessionDidReconnect',
      sessionReconnecting: 'sessionDidBeginReconnecting',
      archiveStarted: 'archiveStartedWithId',
      archiveStopped: 'archiveStoppedWithId',
      streamPropertyChanged: 'streamPropertyChanged',
      muteForced: 'muteForced',
    },
    android: {
      streamCreated: 'onStreamReceived',
      streamDestroyed: 'onStreamDropped',
      sessionConnected: 'onConnected',
      sessionDisconnected: 'onDisconnected',
      signal: 'onSignalReceived',
      connectionCreated: 'onConnectionCreated',
      connectionDestroyed: 'onConnectionDestroyed',
      error: 'onError',
      sessionReconnected: 'onReconnected',
      sessionReconnecting: 'onReconnecting',
      archiveStarted: 'onArchiveStarted',
      archiveStopped: 'onArchiveStopped',
      streamPropertyChanged: 'onStreamPropertyChanged',
      muteForced: 'onMuteForced',
    }
  };
  return reassignEvents('session', customEvents, events, sessionId);
};

const sanitizeCustomTurnOptions = (options) => {
  let sessionOptions = {};
  if (typeof options !== 'object') {
    return {};
  }
  const validCustomTurnOptions = {
    includeServers: 'string',
    transportPolicy: 'string',
    filterOutLanCandidates: 'boolean',
    customServers: 'Array'
  };

  const customTurnOptions = {
    includeServers: 'all',
    transportPolicy: 'all',
    filterOutLanCandidates: 'boolean',
    customServers: []
  };

  each(options, (value, key) => {
    const optionType = validCustomTurnOptions[key];
    if (optionType !== undefined) {
      if (optionType === 'string') {
        sessionOptions[key] = validateString(value);
      } else if (optionType === 'Array') {
        sessionOptions[key] = validateArray(value);
      } else if (optionType === 'boolean') {
        sessionOptions[key] = validateBoolean(value);
      }
    } else {
      handleError(`${key} is not a valid option`);
    }
  });
  return sessionOptions;
};

const sanitizeSessionOptions = (options) => {
  const platform = Platform.OS;
  let sessionOptions;

  if (platform === 'android') {
    sessionOptions = {
      connectionEventsSuppressed: false,
      ipWhitelist: false,
      iceConfig: {},
      proxyUrl: '',
      useTextureViews: false,
      enableStereoOutput: false,
      androidOnTop: '', // 'publisher' || 'subscriber'
      androidZOrder: '', // 'mediaOverlay' || 'onTop'
      enableSinglePeerConnection: false,
      sessionMigration: false,
    };
  } else {
    sessionOptions = {
      connectionEventsSuppressed: false,
      ipWhitelist: false,
      iceConfig: {},
      proxyUrl: '',
      enableStereoOutput: false,
      enableSinglePeerConnection: false,
      sessionMigration: false,
    };
  }

  if (typeof options !== 'object') {
    return sessionOptions;
  }

  const validSessionOptions = {
    ios: {
      connectionEventsSuppressed: 'boolean',
      ipWhitelist: 'boolean',
      iceConfig: 'object',
      proxyUrl: 'string',
      enableStereoOutput: 'boolean',
      enableSinglePeerConnection: 'boolean',
      sessionMigration: 'boolean',
    },
    android: {
      connectionEventsSuppressed: 'boolean',
      useTextureViews: 'boolean',
      androidOnTop: 'string',
      androidZOrder: 'string',
      ipWhitelist: 'boolean',
      iceConfig: 'object',
      proxyUrl: 'string',
      enableStereoOutput: 'boolean',
      enableSinglePeerConnection: 'boolean',
      sessionMigration: 'boolean',
    },
  };

  each(options, (value, key) => {
    const optionType = validSessionOptions[platform][key];
    if (optionType !== undefined) {
      if (optionType === 'boolean') {
        sessionOptions[key] = validateBoolean(value);
      } else if (optionType === 'string') {
        sessionOptions[key] = validateString(value);
      } else if (optionType === 'object') {
        sessionOptions[key] = validateObject(value);
      }
    } else {
      handleError(`${key} is not a valid option`);
    }
  });

  if (sessionOptions.iceConfig) {
    const customTurnOptions = sanitizeCustomTurnOptions(
      sessionOptions.iceConfig
    );
    each(customTurnOptions, (value, key) => {
      sessionOptions[key] = customTurnOptions[key];
    });
  }
  return sessionOptions;
};

const sanitizeSignalData = (signal) => {
  if (typeof signal !== 'object') {
    return {
      signal: {
        type: '',
        data: '',
        to: ''
      },
      errorHandler: handleSignalError
    };
  }
  return {
    signal: {
      type: validateString(signal.type),
      data: validateString(signal.data),
      to: validateString(signal.to)
    },
    errorHandler:
      typeof signal.errorHandler !== 'function'
        ? handleSignalError
        : signal.errorHandler,
  };
};

const sanitizeEncryptionSecret = (secret) => {
  if (typeof secret !== undefined) {
    return String(secret);
  }
};

const sanitizeCredentials = (credentials) => {
  const _credentials = {};
  if (!credentials.applicationId && !credentials.apiKey) {
    handleError('Please add the applicationId');
  }

  if (credentials.applicationId) {
    credentials.apiKey = credentials.applicationId;
    delete credentials.applicationId;
  }

  each(credentials, (value, key) => {
    if (!isString(value) || isEmpty(value) || isNull(value)) {
      handleError(`Please add the ${key}`);
    } else {
      _credentials[key] = value;
    }
  });
  return _credentials;
};

const getConnectionStatus = (connectionStatus) => {
  switch (connectionStatus) {
    case 0:
      return 'not connected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'reconnecting';
    case 4:
      return 'disconnecting';
    case 5:
      return 'failed';
  }
};

const isConnected = (connectionStatus) =>
  getConnectionStatus(connectionStatus) === 'connected';

export {
  sanitizeSessionEvents,
  sanitizeSessionOptions,
  sanitizeSignalData,
  sanitizeEncryptionSecret,
  sanitizeCredentials,
  getConnectionStatus,
  isConnected
};
