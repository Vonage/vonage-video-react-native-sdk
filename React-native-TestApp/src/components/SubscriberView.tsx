import React, { Component } from 'react';
import { OTSubscriber } from '@vonage/client-sdk-video-react-native';
import { styles } from '../styles/styles';

interface Props {
  subscriberProperties: any;
  subscriberEventHandlers: any;
}

class SubscriberView extends Component<Props> {
  render() {
    return (
      <OTSubscriber
        properties={this.props.subscriberProperties}
        style={styles.video}
        eventHandlers={this.props.subscriberEventHandlers}
      />
    );
  }
}

export default SubscriberView;
