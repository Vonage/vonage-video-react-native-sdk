import React, { useState } from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import {
  isCallingServicesModeAvailable,
  enableCallingServicesMode,
  preconfigureAudioSessionForCall,
  notifyAudioSessionActivated,
  notifyAudioSessionDeactivated,
  setRequestAudioFocus,
  notifyAudioFocusActivated,
  notifyAudioFocusDeactivated,
} from '@vonage/client-sdk-video-react-native';
import ButtonComponent from '../../components/ButtonComponent';
import TextComponent from '../../components/TextComponent';
import { styles } from '../styles/styles';

// Exercises the calling-services bridge. In a real app these calls are driven
// by CXProviderDelegate (iOS) / ConnectionService (Android), typically via
// react-native-callkeep. Note: on iOS, enabling calling-services mode stops
// the SDK activating the audio session itself, so sessions in this app run
// silent until "Activated" is pressed or the app is relaunched.
type Step = { label: string; testID: string; run: () => Promise<unknown> };

const STEPS: Step[] = [
  { label: 'Available?', testID: 'csAvailable', run: isCallingServicesModeAvailable },
  { label: 'Enable mode', testID: 'csEnable', run: enableCallingServicesMode },
  { label: 'Preconfigure', testID: 'csPreconfigure', run: () => preconfigureAudioSessionForCall() },
  { label: 'Session on', testID: 'csSessionActivated', run: notifyAudioSessionActivated },
  { label: 'Session off', testID: 'csSessionDeactivated', run: notifyAudioSessionDeactivated },
  { label: 'Req focus', testID: 'csRequestFocus', run: () => setRequestAudioFocus(true) },
  { label: 'Focus on', testID: 'csFocusActivated', run: notifyAudioFocusActivated },
  { label: 'Focus off', testID: 'csFocusDeactivated', run: notifyAudioFocusDeactivated },
];

const describeError = (e: any) => `error ${e?.code ?? ''} ${e?.message ?? e}`.trim();

const CallingServicesPanel: React.FC = () => {
  const [lastResult, setLastResult] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const runStep = async (step: Step) => {
    let result: string;
    try {
      const value = await step.run();
      result = `${step.testID}: ok${value === undefined ? '' : ` ${value}`}`;
    } catch (e) {
      result = `${step.testID}: ${describeError(e)}`;
    }
    setLastResult(result);
    setLog((prev) => [result, ...prev].slice(0, 20));
    return result;
  };

  // Mirrors the order CallKit / Telecom invoke things when answering a call.
  const runSequence = async () => {
    const results: string[] = [];
    for (const step of STEPS) {
      results.push(await runStep(step));
    }
    const failed = results.filter((r) => !/: ok/.test(r));
    setLastResult(failed.length === 0 ? 'sequence: ok' : `sequence: failed ${failed.join('; ')}`);
  };

  return (
    <ScrollView style={{ maxHeight: 200 }}>
      <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>
        Calling services ({Platform.OS})
      </Text>
      <View style={styles.controlsGrid}>
        {STEPS.map((step) => (
          <ButtonComponent
            key={step.testID}
            testID={step.testID}
            handleSubmit={() => runStep(step)}
            label={step.label}
          />
        ))}
        <ButtonComponent testID="csRunSequence" handleSubmit={runSequence} label="Run all" />
      </View>
      <TextComponent testID="csLastResult">{lastResult}</TextComponent>
      {log.map((line, i) => (
        <Text key={i} style={{ fontSize: 10, color: '#555' }}>
          {line}
        </Text>
      ))}
    </ScrollView>
  );
};

export default CallingServicesPanel;
