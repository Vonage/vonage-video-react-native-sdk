import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  OTSession,
  OTPublisher,
  OTSubscriber,
} from '@vonage/client-sdk-video-react-native';
import ButtonComponent from '../../components/ButtonComponent';
import { credentials } from '../config/credentials';

/**
 * Demonstrates the waiting-room (lobby) pattern using the previewOnly prop.
 *
 * Mode 1 — standalone preview: an OTPublisher outside any OTSession renders
 * the local camera without a session or credentials.
 *
 * Mode 2 — in-session lobby: an OTPublisher inside OTSession with
 * previewOnly renders the local camera while the session connects; nothing
 * is published until previewOnly flips to false, which publishes the same
 * native publisher without restarting the camera.
 */
const WaitingRoomScreen = () => {
  const [mode, setMode] = useState<'standalone' | 'session'>('standalone');
  const [joined, setJoined] = useState(false);
  const [publishAudio, setPublishAudio] = useState(true);
  const [publishVideo, setPublishVideo] = useState(true);
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>(
    'front'
  );
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioLevelCount, setAudioLevelCount] = useState(0);
  const [lastEvent, setLastEvent] = useState('none');

  const publisherProperties = {
    publishAudio,
    publishVideo,
    cameraPosition,
    allowAudioCaptureWhileMuted: true,
  };

  const publisherEventHandlers = {
    audioLevel: (event: { audioLevel: number }) => {
      setAudioLevel(event.audioLevel);
      setAudioLevelCount((count) => count + 1);
    },
    streamCreated: () => setLastEvent('publisher streamCreated'),
    streamDestroyed: () => setLastEvent('publisher streamDestroyed'),
    error: (event: unknown) =>
      setLastEvent(`publisher error: ${JSON.stringify(event)}`),
  };

  const renderPublisher = (previewOnly: boolean) => (
    <OTPublisher
      previewOnly={previewOnly}
      properties={publisherProperties}
      eventHandlers={publisherEventHandlers}
      style={styles.publisher}
    />
  );

  const renderControls = () => (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>Mic</Text>
        <Switch value={publishAudio} onValueChange={setPublishAudio} />
        <Text style={styles.label}>Camera</Text>
        <Switch value={publishVideo} onValueChange={setPublishVideo} />
      </View>
      <ButtonComponent
        label={`Camera: ${cameraPosition}`}
        handleSubmit={() =>
          setCameraPosition(cameraPosition === 'front' ? 'back' : 'front')
        }
        testID="flip-camera"
      />
      <Text style={styles.meter} testID="audio-level">
        Audio level: {audioLevel.toFixed(3)} (events: {audioLevelCount}){' '}
        {'█'.repeat(Math.round(audioLevel * 20))}
      </Text>
      <Text style={styles.status} testID="last-event">
        Last publisher event: {lastEvent}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Waiting Room (previewOnly)</Text>
      <View style={styles.row}>
        <ButtonComponent
          label={mode === 'standalone' ? 'Mode: standalone' : 'Mode: session'}
          handleSubmit={() => {
            setJoined(false);
            setMode(mode === 'standalone' ? 'session' : 'standalone');
          }}
          testID="toggle-mode"
        />
      </View>

      {mode === 'standalone' ? (
        <View style={styles.content}>
          <Text style={styles.status}>
            Standalone preview — no OTSession, nothing published
          </Text>
          {renderPublisher(true)}
          {renderControls()}
        </View>
      ) : (
        <View style={styles.content}>
          <OTSession
            apiKey={credentials.apiKey || '00000000'}
            sessionId={credentials.sessionId || 'invalid-session-for-preview'}
            token={credentials.token || 'invalid-token-for-preview'}
            options={{}}
            eventHandlers={{
              sessionConnected: () => setLastEvent('sessionConnected'),
              error: (event: unknown) =>
                setLastEvent(`session error: ${JSON.stringify(event)}`),
            }}
            style={styles.session}
          >
            <Text style={styles.status}>
              {joined ? 'Published to session' : 'In-session lobby (preview)'}
            </Text>
            {renderPublisher(!joined)}
            {joined ? <OTSubscriber style={styles.subscriber} /> : null}
          </OTSession>
          <ButtonComponent
            label={joined ? 'Joined' : 'Join call'}
            handleSubmit={() => setJoined(true)}
            testID="join-call"
          />
          {renderControls()}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  content: {
    flex: 1,
  },
  session: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 4,
  },
  label: {
    color: '#fff',
  },
  publisher: {
    flex: 1,
    margin: 8,
  },
  subscriber: {
    height: 120,
    margin: 8,
  },
  meter: {
    color: '#0f0',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  status: {
    color: '#ccc',
    textAlign: 'center',
    margin: 4,
  },
});

export default WaitingRoomScreen;
