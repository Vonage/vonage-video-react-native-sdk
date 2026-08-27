import React, { Component } from 'react';
import { View } from 'react-native';
import PropTypes from 'prop-types';
import { OT } from './OT';
import {
  dispatchEvent,
  setIsConnected,
  addStream,
  removeStream,
  clearStreams,
} from './helpers/OTSessionHelper';
import { handleError } from './OTError';
import { logOT } from './helpers/OTHelper';
import OTContext from './contexts/OTContext';
import { sanitizeSessionOptions } from './helpers/OTSessionHelper';
import { OTRN_PACKAGE_INFO } from './generated/packageInfo';

export default class OTSession extends Component {
  eventHandlers = {};

  constructor(props) {
    super(props);
    this.validateProps();
    this.eventHandlers = props.eventHandlers;
    this.initComponent();
  }

  validateProps() {
    const { apiKey, applicationId } = this.props;
    const packageName = OTRN_PACKAGE_INFO.name;
    
    // Check if using an OpenTok package
    const isOpentokPackage = packageName.includes('opentok');
    
    if (isOpentokPackage && applicationId) {
      console.error(
        `[${packageName}] Error: The "applicationId" prop is not supported in OpenTok packages. ` +
        'Please use "apiKey" instead. ' +
        'If you need to use applicationId, install @vonage/client-sdk-video-react-native.'
      );
      throw new Error(
        `applicationId is not supported in ${packageName}. Use apiKey instead.`
      );
    }
    
    if (isOpentokPackage && apiKey == null) {
      throw new Error(
        `apiKey is required for ${packageName}. Please provide the apiKey prop.`
      );
    }
    
    if (apiKey == null && applicationId == null) {
      throw new Error(
        'Either apiKey or applicationId must be provided.'
      );
    }
  }

  async initSession(apiKey, sessionId, token) {
    if (apiKey && sessionId && token) {
      logOT({
        apiKey,
        sessionId,
        action: 'rn_initialize',
        proxyUrl: this.props.options?.proxyUrl,
      });
    } else {
      handleError('Please check your credentials.');
    }
    OT.onSessionConnected((event) => {
      if (event.sessionId !== sessionId) return;
      this.connectionId = event.connectionId;
      setIsConnected(sessionId, true);
      this.eventHandlers?.sessionConnected?.(event);
      dispatchEvent(sessionId, 'sessionConnected', event);
      if (Object.keys(this.props.signal).length > 0) {
        this.signal(this.props.signal);
      }
    });
    OT.initSession(
      apiKey,
      sessionId,
      sanitizeSessionOptions(this.props.options)
    );
    if (this.props.encryptionSecret) {
      this.setEncryptionSecret(this.props.encryptionSecret);
    }
    OT.onStreamCreated((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.streamCreated?.(event);
      if (event.connectionId !== this.connectionId) {
        addStream(sessionId, event.streamId);
      }
      dispatchEvent(sessionId, 'streamCreated', event);
    });

    OT.onStreamDestroyed((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.streamDestroyed?.(event);
      removeStream(sessionId, event.streamId);
      dispatchEvent(sessionId, 'streamDestroyed', event);
    });

    OT.onSignalReceived((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.signal?.(event);
    });

    OT.onSessionError((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.error?.(event);
    });

    OT.onConnectionCreated((event) => {
      if (event.sessionId !== sessionId) return;

      this.eventHandlers?.connectionCreated?.(event);
    });
    OT.onConnectionDestroyed((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.connectionDestroyed?.(event);
    });
    OT.onArchiveStarted((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.archiveStarted?.(event);
    });
    OT.onArchiveStopped((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.archiveStopped?.(event);
    });
    OT.onMuteForced((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.muteForced?.(event);
    });
    OT.onSessionReconnecting((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.sessionReconnecting?.(event);
    });
    OT.onSessionReconnected((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.sessionReconnected?.(event);
    });
    OT.onStreamPropertyChanged((event) => {
      if (event.sessionId !== sessionId) return;
      this.eventHandlers?.streamPropertyChanged?.(event);
    });

    OT.connect(sessionId, token);
  }

  initComponent = () => {
    const { apiKey, applicationId, token, sessionId} = this.props;
    this.initSession(applicationId || apiKey, sessionId, token);
  };

  reportIssue() {
    return OT.reportIssue(this.props.sessionId);
  }

  getCapabilities() {
    return OT.getCapabilities(this.props.sessionId);
  }

  forceMuteAll(excludedStreamIds) {
    return OT.forceMuteAll(this.props.sessionId, excludedStreamIds || []);
  }

  forceMuteStream(streamId) {
    return OT.forceMuteStream(this.props.sessionId, streamId);
  }

  disableForceMute() {
    return OT.disableForceMute(this.props.sessionId);
  }

  signal(signalObj) {
    OT.sendSignal(
      this.props.sessionId,
      signalObj.type || '',
      signalObj.data || '',
      signalObj.to || ''
    );
  }

  setEncryptionSecret(value) {
    OT.setEncryptionSecret(this.props.sessionId, value);
  }

  forceDisconnect(connectionId) {
    return OT.forceDisconnect(this.props.sessionId, connectionId);
  }

  disconnectSession(sessionId) {
    OT.disconnect(sessionId);
  }

  componentDidUpdate(previousProps) {
    // Keep the handler references current. The native event callbacks are
    // registered once (in initComponent) but read `this.eventHandlers` at call
    // time, so refreshing it here lets a parent that re-renders with new handler
    // closures (e.g. useCallback deps changed) receive subsequent events.
    this.eventHandlers = this.props.eventHandlers;

    const shouldUseDefault = (value, defaultValue) =>
      value === undefined ? defaultValue : value;

    const shouldUpdate = (key, defaultValue) => {
      const previous = shouldUseDefault(previousProps[key], defaultValue);
      const current = shouldUseDefault(this.props[key], defaultValue);
      return previous !== current;
    };

    const updateSessionProperty = (key, defaultValue) => {
      if (shouldUpdate(key, defaultValue)) {
        const value = shouldUseDefault(this.props[key], defaultValue);
        if (key === 'signal') {
          this.signal(value);
        }
        if (key === 'encryptionSecret') {
          this.setEncryptionSecret(value);
        }
      }
    };

    updateSessionProperty('signal', {});
    updateSessionProperty('encryptionSecret', undefined);
  }

  componentWillUnmount() {
    this.disconnectSession(this.props.sessionId);
    clearStreams(this.props.sessionId);
  }

  render() {
    const { style, children, sessionId, applicationId, token } = this.props;
    const apiKey = applicationId || this.props.apiKey;

    if (children && sessionId && apiKey && token) {
      return (
        <OTContext.Provider
          value={{ sessionId, connectionId: this.connectionId }}
        >
          <View style={style}>{children}</View>
        </OTContext.Provider>
      );
    }
    return <View />;
  }
}

OTSession.propTypes = {
  apiKey: PropTypes.string,
  applicationId: PropTypes.string,
  sessionId: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.element,
    PropTypes.arrayOf(PropTypes.element),
  ]),
  style: PropTypes.any,
  eventHandlers: PropTypes.object,
  options: PropTypes.object,
  signal: PropTypes.object,
  encryptionSecret: PropTypes.string,
};

OTSession.defaultProps = {
  eventHandlers: {},
  options: {},
  signal: {},
  style: {
    flex: 1,
  },
};
