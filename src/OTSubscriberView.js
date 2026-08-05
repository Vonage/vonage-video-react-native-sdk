import React from 'react';
import PropTypes from 'prop-types';
import { OT } from './OT';
import OTRNSubscriber from './OTSubscriberNativeComponent';
import OTContext from './contexts/OTContext';

export default class OTSubscriberView extends React.Component {
  static defaultProps = {
    subscribeToAudio: true,
    subscribeToVideo: true,
    scaleBehavior: 'fill',
    style: {
      flex: 1,
    },
  };

  getRtcStatsReport() {
    //NOSONAR - this method is exposed externally
    OT.getSubscriberRtcStatsReport(this.context.sessionId);
  }

  componentWillUnmount() {
    OT.removeSubscriber(this.context.sessionId, this.props.streamId);
  }

  render() {
    const { streamId } = this.props;
    const subscriberProperties = this.context.subscriberProperties || {};
    const eventHandlers = this.context.eventHandlers;
    const streamProperties = this.context.streamProperties
      ? this.context.streamProperties[streamId]
      : undefined;
    let {
      audioVolume,
      preferredFrameRate,
      preferredResolution,
      subscribeToCaptions,
    } = subscriberProperties;
    if (streamProperties) {
      ({
        audioVolume,
        preferredFrameRate,
        preferredResolution,
        subscribeToCaptions,
      } = streamProperties);
    }
    const subscribeToVideo =
      streamProperties?.subscribeToVideo ??
      subscriberProperties?.subscribeToVideo ??
      true;
    const subscribeToAudio =
      streamProperties?.subscribeToAudio ??
      subscriberProperties?.subscribeToAudio ??
      true;
    const scaleBehavior =
      streamProperties?.scaleBehavior ??
      subscriberProperties?.scaleBehavior ??
      'fill';
    const style = streamProperties?.style || this.context.style;
    return (
      <OTRNSubscriber
        sessionId={this.context.sessionId}
        streamId={streamId}
        subscribeToAudio={subscribeToAudio}
        subscribeToVideo={subscribeToVideo}
        scaleBehavior={scaleBehavior}
        subscribeToCaptions={subscribeToCaptions}
        preferredFrameRate={preferredFrameRate}
        preferredResolution={preferredResolution}
        audioVolume={audioVolume}
        onAudioLevel={(event) => {
          eventHandlers.audioLevel?.(event.nativeEvent);
        }}
        onAudioNetworkStats={(event) => {
          // iOS ships these stats wrapped as { stream, jsonStats: "<string>" }.
          // Parse the structured stats but keep the wrapper's other fields (e.g.
          // stream), and guard the parse so malformed JSON can't crash the JS thread.
          const { jsonStats, ...rest } = event.nativeEvent;
          let eventData = event.nativeEvent;
          if (jsonStats) {
            try {
              eventData = { ...rest, ...JSON.parse(jsonStats) };
            } catch (e) {
              eventData = rest;
            }
          }
          eventHandlers.audioNetworkStats?.(eventData);
        }}
        onSubscriberConnected={(event) => {
          eventHandlers.connected?.(event.nativeEvent);
          eventHandlers.subscriberConnected?.(event.nativeEvent);
        }}
        onSubscriberDisconnected={(event) => {
          eventHandlers.disconnected?.(event.nativeEvent);
        }}
        onSubscriberError={(event) => {
          eventHandlers.error?.(event.nativeEvent);
        }}
        onCaptionReceived={(event) => {
          eventHandlers.captionReceived?.(event.nativeEvent);
        }}
        onVideoDataReceived={(event) => {
          eventHandlers.videoDataReceived?.(event.nativeEvent);
        }}
        onVideoDisabled={(event) => {
          eventHandlers.videoDisabled?.(event.nativeEvent);
        }}
        onVideoDisableWarning={(event) => {
          eventHandlers.videoDisableWarning?.(event.nativeEvent);
        }}
        onVideoDisableWarningLifted={(event) => {
          eventHandlers.videoDisableWarningLifted?.(event.nativeEvent);
        }}
        onRtcStatsReport={(event) => {
          eventHandlers.rtcStatsReport?.(event.nativeEvent);
        }}
        onVideoEnabled={(event) => {
          eventHandlers.videoEnabled?.(event.nativeEvent);
        }}
        onReconnected={(event) => {
          eventHandlers.reconnected?.(event.nativeEvent);
        }}
        onVideoNetworkStats={(event) => {
          // iOS ships these stats wrapped as { stream, jsonStats: "<string>" }.
          // Parse the structured stats but keep the wrapper's other fields (e.g.
          // stream), and guard the parse so malformed JSON can't crash the JS thread.
          const { jsonStats, ...rest } = event.nativeEvent;
          let eventData = event.nativeEvent;
          if (jsonStats) {
            try {
              eventData = { ...rest, ...JSON.parse(jsonStats) };
            } catch (e) {
              eventData = rest;
            }
          }
          eventHandlers.videoNetworkStats?.(eventData);
        }}
        style={style}
      />
    );
  }
}

OTSubscriberView.propTypes = {
  streamId: PropTypes.string.isRequired,
};

OTSubscriberView.contextType = OTContext;
