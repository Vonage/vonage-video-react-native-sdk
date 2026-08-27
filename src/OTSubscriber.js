import React, { Component } from 'react';
import { View } from 'react-native';
import PropTypes from 'prop-types';
import { isEqual } from 'underscore';
import { OT } from './OT';
import {
  addEventListener,
  removeEventListener,
  getStreams,
  getPublisherStream,
} from './helpers/OTSessionHelper';
import OTSubscriberView from './OTSubscriberView';

import {
  sanitizeProperties,
  sanitizeStreamProperties,
} from './helpers/OTSubscriberHelper';

import OTContext from './contexts/OTContext';

export default class OTSubscriber extends Component {

  constructor(props, context) {
    super(props, context);
    let initialStreams = getStreams(this.context.sessionId);
    let initialPublisherStream = getPublisherStream(this.context.sessionId);
    if (props.subscribeToSelf && initialPublisherStream) {
      initialStreams.push(initialPublisherStream);
    }
    sanitizeStreamProperties(props.streamProperties);
    this.state = {
      streams: initialStreams,
      properties: props.properties,
      streamProperties: props.streamProperties,
      subscribeToSelf: props.subscribeToSelf || false,
    };
    this.initComponent();
  }

  initComponent = () => {
    addEventListener(
      this.context.sessionId,
      'streamCreated',
      this.streamCreatedHandler
    );
    addEventListener(
      this.context.sessionId,
      'publisherStreamCreated',
      this.publisherStreamCreatedHandler
    );
    addEventListener(
      this.context.sessionId,
      'publisherStreamDestroyed',
      this.publisherStreamDestroyedHandler
    );
    addEventListener(
      this.context.sessionId,
      'streamDestroyed',
      this.streamDestroyedHandler
    );
    addEventListener(
      this.context.sessionId,
      'subscriberConnected',
      this.subscriberConnectedHandler
    );
  };

  componentDidUpdate() {
    const { streamProperties, properties } = this.props;
    if (!isEqual(this.state.properties, properties)) {
      sanitizeProperties(properties);
      this.setState((prevState) => ({
        properties,
      }));
    }

    if (!isEqual(this.state.streamProperties, streamProperties)) {
      sanitizeStreamProperties(streamProperties);
      this.setState((prevState) => ({
        streamProperties,
      }));
    }
  }

  publisherStreamCreatedHandler = (stream) => {
    if (this.props.subscribeToSelf) {
      this.streamCreatedHandler(stream);
    }
  };

  streamCreatedHandler = (stream) => {
    this.setState((prevState) => {
      const modifiedStreams = prevState.streams;
      if (!modifiedStreams.includes(stream.streamId)) {
        modifiedStreams.push(stream.streamId);
      }
      return { streams: modifiedStreams };
    });
  };
  streamDestroyedHandler = (stream) => {
    this.setState((prevState) => ({
      streams: prevState.streams.filter((item) => item !== stream.streamId),
    }));
  };

  subscriberConnectedHandler = (event) => {
    this.props.eventHandlers?.subscriberConnected?.(event.nativeEvent);
  };

  publisherStreamDestroyedHandler = (stream) => {
    if (this.state.subscribeToSelf) {
      this.streamDestroyedHandler(stream);
    }
  };
  getRtcStatsReport() {
    OT.getSubscriberRtcStatsReport(this.context.sessionId);
  }

  componentWillUnmount() {
    removeEventListener('streamCreated', this.streamCreatedHandler);
    removeEventListener(
      this.context.sessionId,
      'publisherStreamCreated',
      this.publisherStreamCreatedHandler
    );
    removeEventListener(
      this.context.sessionId,
      'publisherStreamDestroyed',
      this.publisherStreamDestroyedHandler
    );
    removeEventListener(
      this.context.sessionId,
      'streamDestroyed',
      this.streamDestroyedHandler
    );
    removeEventListener(
      this.context.sessionId,
      'subscriberConnected',
      this.subscriberConnectedHandler
    );
  }

  render() {
    const contextValue = {
      sessionId: this.context.sessionId,
      subscriberProperties: this.state.properties,
      streamProperties: this.state.streamProperties,
      eventHandlers: this.props.eventHandlers,
      style: this.props.style,
    };

    // `children` is a render-prop function. Only invoke it when it actually is
    // one; any other value (undefined, or element children passed by mistake)
    // falls back to the default subscriber-view rendering instead of throwing
    // "children is not a function" from render.
    if (typeof this.props.children !== 'function') {
      const containerStyle = this.props.containerStyle;
      const childrenWithStreams = this.state.streams.map((streamId) => (
        <OTSubscriberView
          key={streamId}
          streamId={streamId}
          style={this.props.style}
        />
      ));
      return (
        <OTContext.Provider value={contextValue}>
          <View style={containerStyle}>{childrenWithStreams}</View>
        </OTContext.Provider>
      );
    }

    const renderedChildren = this.props.children(this.state.streams);
    if (renderedChildren) {
      return (
        <OTContext.Provider value={contextValue}>
          {renderedChildren}
        </OTContext.Provider>
      );
    }

    return null;
  }
}

const viewPropTypes = View.propTypes;
OTSubscriber.propTypes = {
  ...viewPropTypes,
  children: PropTypes.func,
  properties: PropTypes.object,
  eventHandlers: PropTypes.object,
  streamProperties: PropTypes.object,
  containerStyle: PropTypes.object,
  getRtcStatsReport: PropTypes.object,
  subscribeToSelf: PropTypes.bool,
};

OTSubscriber.defaultProps = {
  properties: {},
  eventHandlers: {},
  streamProperties: {},
  containerStyle: {},
  subscribeToSelf: false,
  getRtcStatsReport: {},
};

OTSubscriber.contextType = OTContext;
