import React, { Component } from 'react';
import { View, Text, ScrollView, ImageBackground, Alert } from 'react-native';
import { OTSession, OTPublisher, OTSubscriber } from '@vonage/client-sdk-video-react-native';
import { State, DegradationPreference, VideoStats } from '../types';
import { fetchMeetCredentials } from '../services/meetService';
import { createSessionHandlers } from '../handlers/sessionHandlers';
import { createPublisherHandlers } from '../handlers/publisherHandlers';
import { createSubscriberHandlers } from '../handlers/subscriberHandlers';
import { parsePublisherProperty, parseSubscriberProperty } from '../utils/propertyUpdaters';
import { styles } from '../styles/styles';
import { credentials } from '../config/credentials';
import TextBoxComponent from '../../components/TextBoxComponent';
import ButtonComponent from '../../components/ButtonComponent';
import TextComponent from '../../components/TextComponent';

class VideoCallScreen extends Component<{}, State> {
  streamId = '';
  shouldLogNextSubscriberVideoStats = false;
  statsUpdateInterval: NodeJS.Timeout | null = null;
  sessionRef: React.RefObject<OTSession>;
  pubRef: React.RefObject<OTPublisher>;
  subRef: React.RefObject<OTSubscriber>;

  constructor(props: {}) {
    super(props);
    this.sessionRef = React.createRef<OTSession>();
    this.pubRef = React.createRef<OTPublisher>();
    this.subRef = React.createRef<OTSubscriber>();
  }

  state: State = {
    connectedToSession: false,
    isScreenSharing: false,
    showRecIndicator: false,
    forceDisconnect: false,
    publisherProps: '',
    subscriberProps: '',
    connectionMode: 'manual',
    codecPreference: 'vp8',
    customCodecOrder: ['vp8', 'vp9', 'h264'],
    isLoadingMeetCredentials: false,
    input: {
      apiKey: credentials.apiKey,
      sessionId: credentials.sessionId,
      token: credentials.token,
      encryptionSecret: '',
      meetRoomName: 'test-room-name',
      userInitials: 'AB',
      signal: { data: 'hi' },
    },
    sessionEvents: {
      archiveStart: false,
      archiveStop: false,
      connectionCreated: false,
      connectionDestroyed: false,
      error: false,
      forceMute: false,
      sessionConnected: false,
      sessionDisconnected: false,
      signalReceived: false,
      streamCreated: false,
      streamDestroyed: false,
      streamPropertyChanged: false,
    },
    publisherEvents: {
      audioLevel: false,
      audioNetworkStats: false,
      forceMute: false,
      rtcStatsReport: true,
      streamCreated: false,
      streamDestroyed: false,
      videoNetworkStats: false,
    },
    subscriberEvents: {
      audioLevel: false,
      audioNetworkStats: false,
      connected: false,
      disconnected: false,
      reconnected: false,
      subscriberConnected: false,
      rtcStatsReport: false,
      videoDataReceived: false,
      videoDisabled: false,
      videoEnabled: false,
      videoNetworkStats: true,
    },
    publisherProperties: {
      cameraTorch: false,
      scaleBehavior: 'fit',
      cameraZoomFactor: 1,
      cameraPosition: 'back',
      preferredVideoCodecs: ['vp8'], //vp8 is default, can be overridden by codecPreference state
      publishSenderStats: true,
      degradationPreference: DegradationPreference.NotSet,
    },
    subscriberProperties: {},
    streams: [],
    publisherVideoStats: null,
  };

  componentDidMount() {
    this.applyCodecPreference();
  }

  componentDidUpdate(prevProps: {}, prevState: State) {
    // Start stats polling when connected and publishing
    if (this.state.connectedToSession && !this.state.forceDisconnect && !prevState.connectedToSession) {
      this.startStatsPolling();
    }
    // Stop stats polling when disconnected or stopped publishing
    if ((!this.state.connectedToSession || this.state.forceDisconnect) && 
        (prevState.connectedToSession && !prevState.forceDisconnect)) {
      this.stopStatsPolling();
    }
  }

  componentWillUnmount() {
    this.stopStatsPolling();
  }

  startStatsPolling = () => {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
    }
    
    // Delay first request to ensure publisher is ready
    setTimeout(() => {
      this.publisherMethodGetRtcStatsReport();
    }, 1000);
    
    // Poll for stats every second
    this.statsUpdateInterval = setInterval(() => {
      this.publisherMethodGetRtcStatsReport();
    }, 1000);
  };

  stopStatsPolling = () => {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }
  };

  updateEvent = (eventGroup: string, eventType: string, eventValue: any) => {
    this.setState((prevState) => ({
      ...prevState,
      [eventGroup]: {
        ...(prevState as any)[eventGroup],
        [eventType]: eventValue,
      },
    }));
  };

  sessionMethodGetCapabilities = async () => {
    if (this.state.sessionEvents.sessionConnected && this.sessionRef.current) {
      await this.sessionRef.current.getCapabilities();
    }
  };

  handleStreamCreated = (stream: any) => {
    if (!stream || !stream.streamId) {
      return;
    }
    this.setState((prevState) => {
      const streamExists = prevState.streams.some(s => s.streamId === stream.streamId);
      if (streamExists) {
        return null;
      }
      return {
        streams: [...prevState.streams, {
          streamId: stream.streamId,
          name: stream.name,
          connectionId: stream.connectionId,
        }]
      };
    });
  };

  handleStreamDestroyed = (streamId: string) => {
    if (!streamId) {
      return;
    }
    this.setState((prevState) => ({
      streams: prevState.streams.filter(s => s.streamId !== streamId),
    }));
  };

  sessionEventHandlers = createSessionHandlers(
    this.updateEvent,
    this.sessionMethodGetCapabilities,
    (show) => this.setState({ showRecIndicator: show }),
    this.handleStreamCreated,
    this.handleStreamDestroyed
  );

  handlePublisherVideoStats = (event: any) => {
    this.updateEvent('publisherEvents', 'rtcStatsReport', true);
    
    let stats: VideoStats | null = null;
    
    // Extract JSON data from event structure
    let jsonData = null;
    if (event) {
      if (event.jsonArrayOfReports) {
        jsonData = event.jsonArrayOfReports;
      } else if (event[0]) {
        if (typeof event[0] === 'object' && event[0].jsonArrayOfReports) {
          jsonData = event[0].jsonArrayOfReports;
        } else if (typeof event[0] === 'string') {
          jsonData = event[0];
        }
      }
    }
    
    if (jsonData) {
      try {
        const reports = JSON.parse(jsonData);
        
        // Find the outbound-rtp video track
        const videoReport = reports.find((report: any) => 
          report.type === 'outbound-rtp' && report.kind === 'video'
        );
        
        if (videoReport) {
          stats = {
            frameRate: Math.round(videoReport.framesPerSecond || 0),
            width: videoReport.frameWidth || 0,
            height: videoReport.frameHeight || 0,
          };
        }
      } catch (e) {
        console.error('Error parsing rtcStatsReport:', e);
      }
      
      if (stats && (stats.width > 0 || stats.height > 0 || stats.frameRate > 0)) {
        this.setState({ publisherVideoStats: stats });
      }
    }
  };

  publisherEventHandlers = {
    ...createPublisherHandlers(
      this.updateEvent,
      (streamId) => (this.streamId = streamId),
      this.state.publisherEvents
    ),
    rtcStatsReport: this.handlePublisherVideoStats,
  };

  logNextSubscriberVideoStats = () => {
    this.shouldLogNextSubscriberVideoStats = true;
  };

  logSubscriberVideoStatsOnce = (event: any) => {
    if (this.shouldLogNextSubscriberVideoStats) {
      this.shouldLogNextSubscriberVideoStats = false;
      console.log('Subscriber videoNetworkStats: ', JSON.stringify(event));
    }
  };

  subscriberEventHandlers = createSubscriberHandlers(
    this.updateEvent,
    this.state.subscriberEvents,
    this.logSubscriberVideoStatsOnce
  );

  handleFetchMeetCredentials = async () => {
    const { meetRoomName } = this.state.input;

    if (!meetRoomName.trim()) {
      Alert.alert('Error', 'Room name is required');
      return;
    }

    this.setState({ isLoadingMeetCredentials: true });

    try {
      const credentials = await fetchMeetCredentials(meetRoomName.trim());
      
      this.setState({
        input: {
          ...this.state.input,
          ...credentials,
        },
        isLoadingMeetCredentials: false,
      });

      Alert.alert('Success', `Joining room: ${meetRoomName}`);
      
      setTimeout(() => {
        this.setState({ connectedToSession: true });
      }, 100);
    } catch (error: any) {
      Alert.alert('Connection Error', error.message || 'Failed to connect to meet room');
      this.setState({ isLoadingMeetCredentials: false });
    }
  };

  connectOrDisconnect = () => {
    if (!this.state.connectedToSession) {
      if (this.state.connectionMode === 'meet') {
        this.handleFetchMeetCredentials();
      } else {
        this.setState({ connectedToSession: true });
      }
    } else {
      this.setState({ connectedToSession: false });
    }
  };

  sessionMethodForceMuteAll = async () => {
    if (this.state.sessionEvents.sessionConnected && this.sessionRef.current) {
      await this.sessionRef.current.forceMuteAll([]);
      this.updateEvent('sessionEvents', 'forceMute', true);
      this.updateEvent('publisherEvents', 'forceMute', true);
    }
  };

  sessionMethodDisableForceMute = async () => {
    if (this.state.sessionEvents.sessionConnected && this.sessionRef.current) {
      await this.sessionRef.current.disableForceMute();
      this.updateEvent('sessionEvents', 'forceMute', false);
      this.updateEvent('publisherEvents', 'forceMute', false);
    }
  };

  sessionMethodMuteStream = async (streamId: string) => {
    if (this.state.sessionEvents.sessionConnected && this.sessionRef.current) {
      await this.sessionRef.current.forceMuteStream(streamId);
    }
  };

  updatePublisherProperty = (prop: string) => {
    this.setState({ publisherProps: prop });
    const parsed = parsePublisherProperty(prop);
    if (parsed) {
      this.updateEvent('publisherProperties', parsed.key, parsed.value);
    }
  };

  updateSubscriberProperty = (prop: string) => {
    this.setState({ subscriberProps: prop });
    const parsed = parseSubscriberProperty(prop);
    if (parsed) {
      this.updateEvent('subscriberProperties', parsed.key, parsed.value);
    }
  };

  toggleVideoSubscription = () => {
    const current = this.state.subscriberProperties.subscribeToVideo;
    this.updateEvent('subscriberProperties', 'subscribeToVideo', !current);
  };

  toggleScreenShare = async () => {
    const { isScreenSharing } = this.state;

    try {
      this.setState({ forceDisconnect: true }, () => {
        const newVideoSource = isScreenSharing ? 'camera' : 'screen';

        if (newVideoSource === 'screen') {
          this.updateEvent('publisherProperties', 'publishAudio', false);
        } else {
          this.updateEvent('publisherProperties', 'publishAudio', true);
        }

        this.updateEvent('publisherProperties', 'videoSource', newVideoSource);

        setTimeout(() => {
          this.setState({
            isScreenSharing: !isScreenSharing,
            forceDisconnect: false,
          });
        }, 500);
      });
    } catch (error) {
      console.error('Screen share toggle failed:', error);
    }
  };

  startOrstopPublishing = () => {
    this.setState({ forceDisconnect: !this.state.forceDisconnect });
  };

  publisherMethodGetRtcStatsReport = () => {
    if (this.pubRef.current) {
      this.pubRef.current.getRtcStatsReport();
    }
  };

  subscriberMethodGetRtcStatsReport = () => {
    if (this.subRef.current) {
      this.subRef.current.getRtcStatsReport();
    }
  };

  renderConnectionInputs() {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connection Settings</Text>
        
        <View style={styles.modeSelector}>
          <View style={styles.modeSelectorButton}>
            <ButtonComponent
              testID="manualModeButton"
              handleSubmit={() => this.setState({ connectionMode: 'manual' })}
              label={this.state.connectionMode === 'manual' ? '✓ Manual' : 'Manual'}
            />
          </View>
          <View style={styles.modeSelectorButton}>
            <ButtonComponent
              testID="meetModeButton"
              handleSubmit={() => this.setState({ connectionMode: 'meet' })}
              label={this.state.connectionMode === 'meet' ? '✓ Meet Room' : 'Meet Room'}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          {this.state.connectionMode === 'manual' ? (
            <>
              <TextBoxComponent
                testID="apiKeyInput"
                placeholder="API Key"
                onChangeText={(text: string) => this.updateEvent('input', 'apiKey', text)}
                value={this.state.input.apiKey}
              />
              <TextBoxComponent
                testID="sessionIdInput"
                placeholder="Session ID"
                onChangeText={(text: string) => this.updateEvent('input', 'sessionId', text)}
                value={this.state.input.sessionId}
              />
              <TextBoxComponent
                testID="tokenInput"
                placeholder="Token"
                onChangeText={(text: string) => this.updateEvent('input', 'token', text)}
                value={this.state.input.token}
              />
            </>
          ) : (
            <>
              <TextBoxComponent
                testID="meetRoomNameInput"
                placeholder="Room Name"
                onChangeText={(text: string) => this.updateEvent('input', 'meetRoomName', text)}
                value={this.state.input.meetRoomName}
              />
              <TextBoxComponent
                testID="userInitialsInput"
                placeholder="Your Initials (optional)"
                onChangeText={(text: string) => this.updateEvent('input', 'userInitials', text)}
                value={this.state.input.userInitials}
              />
            </>
          )}
        </View>

        <View style={styles.connectionButton}>
          <ButtonComponent
            testID={this.state.connectedToSession ? 'disconnectSession' : 'submitButton'}
            handleSubmit={this.connectOrDisconnect}
            label={
              this.state.isLoadingMeetCredentials
                ? 'Loading...'
                : this.state.connectedToSession
                ? 'Disconnect'
                : 'Connect'
            }
          />
        </View>
      </View>
    );
  }

  renderVideoSection() {
    if (!this.state.connectedToSession) return null;

    return (
      <View style={styles.videoContainer}>
        <Text style={styles.participantCount}>
          👥 Connected
        </Text>
        <OTSession
          apiKey={this.state.input.apiKey}
          sessionId={this.state.input.sessionId}
          token={this.state.input.token}
          encryptionSecret={this.state.input.encryptionSecret}
          signal={this.state.input.signal}
          options={{ apiUrl: credentials.apiUrl || undefined }}
          eventHandlers={this.sessionEventHandlers}
          ref={this.sessionRef}>
          <View style={styles.videoLayout}>
            {!this.state.forceDisconnect && (
              <View testID="publisher" style={styles.video}>
                <OTPublisher
                  properties={this.state.publisherProperties}
                  style={{ flex: 1 }}
                  eventHandlers={this.publisherEventHandlers}
                  ref={this.pubRef}>
                  {this.state.showRecIndicator && (
                    <Text style={styles.recording}>● REC</Text>
                  )}
                </OTPublisher>
              </View>
            )}
            {/* Try auto-subscribe mode - no streamId specified */}
            <View testID="subscriber" style={styles.video}>
              <OTSubscriber
                properties={this.state.subscriberProperties}
                containerStyle={{ flex: 1 }}
                style={{ flex: 1 }}
                eventHandlers={this.subscriberEventHandlers}
              />
            </View>
          </View>
        </OTSession>
      </View>
    );
  }

  renderControls() {
    const videoLabel = this.state.publisherProperties?.publishVideo !== false ? 'Video Off' : 'Video On';
    const audioLabel = this.state.publisherProperties?.publishAudio !== false ? 'Audio Off' : 'Audio On';

    return (
      <View style={styles.controlsGrid}>
          <ButtonComponent
            testID="stopPublishing"
            handleSubmit={this.startOrstopPublishing}
            label={this.state.forceDisconnect ? 'Publish' : 'Unpublish'}
          />
          <ButtonComponent
            testID="hasVideo"
            handleSubmit={() =>
              this.updateEvent(
                'publisherProperties',
                'publishVideo',
                !this.state.publisherProperties?.publishVideo
              )
            }
            label={videoLabel}
          />
          <ButtonComponent
            testID="hasAudio"
            handleSubmit={() =>
              this.updateEvent(
                'publisherProperties',
                'publishAudio',
                !this.state.publisherProperties?.publishAudio
              )
            }
            label={audioLabel}
          />
          <ButtonComponent
            testID="toggleCameraPosition"
            handleSubmit={() =>
              this.updateEvent(
                'publisherProperties',
                'cameraPosition',
                this.state.publisherProperties?.cameraPosition === 'back' ? 'front' : 'back'
              )
            }
            label={
              this.state.publisherProperties?.cameraPosition === 'front'
                ? 'Back Camera'
                : 'Front Camera'
            }
          />
          <ButtonComponent
            testID="toggleScreenShare"
            handleSubmit={this.toggleScreenShare}
            label={this.state.isScreenSharing ? 'Stop Share' : 'Screen Share'}
          />
          <ButtonComponent
            testID="muteAll"
            handleSubmit={this.sessionMethodForceMuteAll}
            label="Mute All"
          />
          <ButtonComponent
          testID="toggleSubscribeVideo"
          handleSubmit={this.toggleVideoSubscription}
          label="Toggle Sub Video"
        />
        <ButtonComponent
            testID="logNextSubscriberVideoStats"
            handleSubmit={this.logNextSubscriberVideoStats}
            label="Log Subscriber Stats"
        />
      </View>
    );
  }

  applyCodecPreference = () => {
    const { codecPreference, customCodecOrder } = this.state;
    let preferredVideoCodecs: 'automatic' | ['vp8' | 'vp9' | 'h264', ...('vp8' | 'vp9' | 'h264')[]] | undefined;

    if (codecPreference === 'default') {
      preferredVideoCodecs = undefined;
    } else if (codecPreference === 'automatic') {
      preferredVideoCodecs = 'automatic';
    } else if (codecPreference === 'custom') {
      preferredVideoCodecs = customCodecOrder as ['vp8' | 'vp9' | 'h264', ...('vp8' | 'vp9' | 'h264')[]];
    } else {
      // Single codec selected (vp8, vp9, or h264)
      preferredVideoCodecs = [codecPreference] as ['vp8' | 'vp9' | 'h264', ...('vp8' | 'vp9' | 'h264')[]];
    }

    this.updateEvent('publisherProperties', 'preferredVideoCodecs', preferredVideoCodecs);
  };

  moveCodecUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...this.state.customCodecOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    this.setState({ customCodecOrder: newOrder });
  };

  moveCodecDown = (index: number) => {
    if (index === this.state.customCodecOrder.length - 1) return;
    const newOrder = [...this.state.customCodecOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    this.setState({ customCodecOrder: newOrder });
  };

  renderDegradationPreferenceSettings() {
    if (!this.state.connectedToSession) return null;

    const currentPref = this.state.publisherProperties.degradationPreference ?? DegradationPreference.NotSet;
    const { publisherVideoStats } = this.state;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ Degradation Preference</Text>
        <Text style={styles.description}>
          Control how video quality adapts under limited bandwidth/CPU conditions.
          Changes are applied immediately.
        </Text>

        <View style={styles.statsBox}>
          <Text style={styles.statsTitle}>📊 Live Video Stats</Text>
          {publisherVideoStats ? (
            <>
              <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>Resolution:</Text>
                <Text style={styles.statsValue}>
                  {publisherVideoStats.width} × {publisherVideoStats.height}
                </Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>Frame Rate:</Text>
                <Text style={styles.statsValue}>
                  {publisherVideoStats.frameRate} fps
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.statsLabel}>Waiting for video stats...</Text>
          )}
        </View>

        <View style={styles.codecGrid}>
          <ButtonComponent
            testID="degradationNotSet"
            handleSubmit={() => this.updateEvent('publisherProperties', 'degradationPreference', DegradationPreference.NotSet)}
            label={currentPref === DegradationPreference.NotSet ? '✓ Not Set (Default)' : 'Not Set (Default)'}
          />
          <ButtonComponent
            testID="degradationMaintainBoth"
            handleSubmit={() => this.updateEvent('publisherProperties', 'degradationPreference', DegradationPreference.MaintainFrameRateAndResolution)}
            label={currentPref === DegradationPreference.MaintainFrameRateAndResolution ? '✓ Maintain Both' : 'Maintain Both'}
          />
          <ButtonComponent
            testID="degradationMaintainFrameRate"
            handleSubmit={() => this.updateEvent('publisherProperties', 'degradationPreference', DegradationPreference.MaintainFrameRate)}
            label={currentPref === DegradationPreference.MaintainFrameRate ? '✓ Maintain FPS' : 'Maintain FPS'}
          />
          <ButtonComponent
            testID="degradationMaintainResolution"
            handleSubmit={() => this.updateEvent('publisherProperties', 'degradationPreference', DegradationPreference.MaintainResolution)}
            label={currentPref === DegradationPreference.MaintainResolution ? '✓ Maintain Resolution' : 'Maintain Resolution'}
          />
          <ButtonComponent
            testID="degradationBalanced"
            handleSubmit={() => this.updateEvent('publisherProperties', 'degradationPreference', DegradationPreference.Balanced)}
            label={currentPref === DegradationPreference.Balanced ? '✓ Balanced' : 'Balanced'}
          />
        </View>

        <View style={styles.infoBox}>
          <TextComponent testID="degradationInfo">ℹ️ Info:</TextComponent>
          <Text style={styles.infoText}>
            • <Text style={styles.bold}>Not Set:</Text> SDK decides optimal policy{('\n')}
            • <Text style={styles.bold}>Maintain Both:</Text> No degradation applied{('\n')}
            • <Text style={styles.bold}>Maintain FPS:</Text> Keeps frame rate, may reduce resolution{('\n')}
            • <Text style={styles.bold}>Maintain Resolution:</Text> Keeps resolution, may reduce FPS{('\n')}
            • <Text style={styles.bold}>Balanced:</Text> Balances resolution and FPS reduction{('\n')}
            {('\n')}
            <Text style={styles.bold}>To test:</Text> Simulate network conditions or CPU load to see degradation behavior.
          </Text>
        </View>
      </View>
    );
  }

  renderCodecSettings() {
    if (!this.state.connectedToSession) return null;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎥 Video Codec Preference</Text>
        <Text style={styles.description}>
          Select preferred video codec priority. Changes require republishing.
          Check chrome://webrtc-internals on the browser side to verify codec.
        </Text>

        <View style={styles.codecGrid}>
          <ButtonComponent
            testID="codecDefault"
            handleSubmit={() => this.setState({ codecPreference: 'default' })}
            label={this.state.codecPreference === 'default' ? '✓ Default' : 'Default'}
          />
          <ButtonComponent
            testID="codecAutomatic"
            handleSubmit={() => this.setState({ codecPreference: 'automatic' })}
            label={this.state.codecPreference === 'automatic' ? '✓ Automatic' : 'Automatic'}
          />
          <ButtonComponent
            testID="codecVP8"
            handleSubmit={() => this.setState({ codecPreference: 'vp8' })}
            label={this.state.codecPreference === 'vp8' ? '✓ VP8 Only' : 'VP8 Only'}
          />
          <ButtonComponent
            testID="codecVP9"
            handleSubmit={() => this.setState({ codecPreference: 'vp9' })}
            label={this.state.codecPreference === 'vp9' ? '✓ VP9 Only' : 'VP9 Only'}
          />
          <ButtonComponent
            testID="codecH264"
            handleSubmit={() => this.setState({ codecPreference: 'h264' })}
            label={this.state.codecPreference === 'h264' ? '✓ H264 Only' : 'H264 Only'}
          />
          <ButtonComponent
            testID="codecCustom"
            handleSubmit={() => this.setState({ codecPreference: 'custom' })}
            label={this.state.codecPreference === 'custom' ? '✓ Custom Order' : 'Custom Order'}
          />
        </View>

        {this.state.codecPreference === 'custom' && (
          <View style={styles.customCodecOrder}>
            <Text style={styles.subtitle}>Custom Priority Order (Top = Highest):</Text>
            {this.state.customCodecOrder.map((codec, index) => (
              <View key={codec} style={styles.codecOrderRow}>
                <Text style={styles.codecOrderLabel}>{index + 1}. {codec.toUpperCase()}</Text>
                <View style={styles.codecOrderButtons}>
                  <ButtonComponent
                    testID={`moveUp${codec}`}
                    handleSubmit={() => this.moveCodecUp(index)}
                    label="↑"
                  />
                  <ButtonComponent
                    testID={`moveDown${codec}`}
                    handleSubmit={() => this.moveCodecDown(index)}
                    label="↓"
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.applyButtonContainer}>
          <ButtonComponent
            testID="applyCodecPreference"
            handleSubmit={() => {
              this.applyCodecPreference();
              Alert.alert(
                'Codec Preference Updated',
                'Unpublish and republish to apply the new codec preference.',
                [{ text: 'OK' }]
              );
            }}
            label="Apply Codec Preference"
          />
        </View>

        <View style={styles.infoBox}>
          <TextComponent testID="codecInfo">ℹ️ Info:</TextComponent>
          <Text style={styles.infoText}>
            • <Text style={styles.bold}>Default:</Text> Uses project settings{'\n'}
            • <Text style={styles.bold}>Automatic:</Text> SDK selects codec{'\n'}
            • <Text style={styles.bold}>Single Codec:</Text> Prioritizes one codec{'\n'}
            • <Text style={styles.bold}>Custom Order:</Text> Set your own priority{'\n'}
            {'\n'}
            <Text style={styles.bold}>To verify:</Text> Open chrome://webrtc-internals in the browser and search for "codec"
          </Text>
        </View>
      </View>
    );
  }

  renderEventIndicators() {
    if (!this.state.connectedToSession) return null;

    return (
      <View testID="eventIndicators" style={{ padding: 4 }}>
        {this.state.sessionEvents.signalReceived && (
          <Text testID="signalReceivedIndicator">signal-received</Text>
        )}
        {this.state.sessionEvents.forceMute && (
          <Text testID="forceMuteActiveIndicator">force-mute-active</Text>
        )}
        {this.state.sessionEvents.streamCreated && (
          <Text testID="streamCreatedIndicator">stream-created</Text>
        )}
      </View>
    );
  }

  render() {
    return (
      <ImageBackground source={require('../../assets/background.jpg')} style={styles.background}>
        <View style={{ flex: 1 }}>
          <ScrollView testID="mainScrollView" style={styles.container} contentContainerStyle={styles.scrollContent}>
            {this.renderConnectionInputs()}
            {this.renderVideoSection()}
            {this.renderEventIndicators()}
            {this.renderDegradationPreferenceSettings()}
            {this.renderCodecSettings()}
          </ScrollView>

          {this.state.connectedToSession && (
            <View testID="actionBar" style={styles.actionBar}>
              {this.renderControls()}
            </View>
          )}
        </View>
      </ImageBackground>
    );
  }
}

export default VideoCallScreen;
