import { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { OTPublisher, OTSession, OTSubscriber } from '../../src';

function App() {
  const [joined, setJoined] = useState(false);

  const creds = useMemo(
    () => ({
    applicationId: 'ac5fa41b-d62f-4fff-91b6-e3c846e1c187',
      sessionId: '1_MX5hYzVmYTQxYi1kNjJmLTRmZmYtOTFiNi1lM2M4NDZlMWMxODd-fjE3Nzk4OTM2OTA1OTZ-QVVqRTJ3RmtBcE1YYUV1T3hFWVg1WWkxfn5-',
      token: 'eyJhbGciOiJSUzI1NiIsImprdSI6Imh0dHBzOi8vYW51YmlzLWNlcnRzLWMxLWV1dzEucHJvZC52MS52b25hZ2VuZXR3b3Jrcy5uZXQvandrcyIsImtpZCI6IkNOPVZvbmFnZSAxdmFwaWd3IEludGVybmFsIENBOjo4NDczNTI3NzAwMTI4Nzg4MDkxNzA1NTg2NzcxNjU2NjEwMTY2OCIsInR5cCI6IkpXVCIsIng1dSI6Imh0dHBzOi8vYW51YmlzLWNlcnRzLWMxLWV1dzEucHJvZC52MS52b25hZ2VuZXR3b3Jrcy5uZXQvdjEvY2VydHMvMWYzZTI5Y2E3OWVjYWRlYTlmYjg5NzE4MDk1OTNmZWIifQ.eyJwcmluY2lwYWwiOnsiYWNsIjp7InBhdGhzIjp7Ii8qKiI6e319fSwidmlhbUlkIjp7ImVtYWlsIjoiaWdvci5wZXJ1bm92aWNAdm9uYWdlLmNvbSIsImdpdmVuX25hbWUiOiJJZ29yIiwiZmFtaWx5X25hbWUiOiJQZXJ1bm92aWMiLCJwaG9uZV9udW1iZXIiOiIzNDYwMzExOTY2NSIsInBob25lX251bWJlcl9jb3VudHJ5IjoiRVMiLCJvcmdhbml6YXRpb25faWQiOiI5ODE0MTRhOS0yZmQ0LTRkMTgtYjM3Yi00OGUxZDljYTAwN2IiLCJhdXRoZW50aWNhdGlvbk1ldGhvZHMiOlt7ImNvbXBsZXRlZF9hdCI6IjIwMjYtMDUtMjdUMTQ6NTQ6MTguMTIyODExMTA2WiIsIm1ldGhvZCI6ImludGVybmFsIn1dLCJpcFJpc2siOnsiaXNfcHJveHkiOnRydWUsInJpc2tfbGV2ZWwiOjk0fSwidG9rZW5UeXBlIjoidmlhbSIsImF1ZCI6InBvcnR1bnVzLmlkcC52b25hZ2UuY29tIiwiZXhwIjoxNzc5ODkzOTkwLCJqdGkiOiI1MDZmOWRjNy0wODlkLTRkMzItYjM5NC1jZTgzNzRhYWExMDciLCJpYXQiOjE3Nzk4OTM2OTAsImlzcyI6IlZJQU0tSUFQIiwibmJmIjoxNzc5ODkzNjc1LCJzdWIiOiI2MmRlZGVlMS1jNmEyLTRmNTUtYjA5Yy0wMjQwNDI4Y2NkZDgifX0sImZlZGVyYXRlZEFzc2VydGlvbnMiOnsidmlkZW8tYXBpIjpbeyJhcGlLZXkiOiI1Mzc0ZTMyYiIsImFwcGxpY2F0aW9uSWQiOiJhYzVmYTQxYi1kNjJmLTRmZmYtOTFiNi1lM2M4NDZlMWMxODciLCJtYXN0ZXJBY2NvdW50SWQiOiI1Mzc0ZTMyYiIsImV4dHJhQ29uZmlnIjp7InZpZGVvLWFwaSI6eyJpbml0aWFsX2xheW91dF9jbGFzc19saXN0IjoiIiwicm9sZSI6Im1vZGVyYXRvciIsInNjb3BlIjoic2Vzc2lvbi5jb25uZWN0Iiwic2Vzc2lvbl9pZCI6IjFfTVg1aFl6Vm1ZVFF4WWkxa05qSm1MVFJtWm1ZdE9URmlOaTFsTTJNNE5EWmxNV014T0RkLWZqRTNOems0T1RNMk9UQTFPVFotUVZWcVJUSjNSbXRCY0UxWVlVVjFUM2hGV1ZnMVdXa3hmbjUtIn19fV19LCJhdWQiOiJwb3J0dW51cy5pZHAudm9uYWdlLmNvbSIsImV4cCI6MTc3OTg5NTUyMywianRpIjoiZmYzNDdiOGQtNmJhZC00NDVjLTkyZmUtNjJmNzZhOTg2NmNhIiwiaWF0IjoxNzc5ODkzNzIzLCJpc3MiOiJWSUFNLUlBUCIsIm5iZiI6MTc3OTg5MzcwOCwic3ViIjoiNjJkZWRlZTEtYzZhMi00ZjU1LWIwOWMtMDI0MDQyOGNjZGQ4In0.hNiud8f--36YmouE7hj1st-GYh6rtv3CKWCBY47EV_tSyAcOX6-moK1GCNL7U0kKEp4XKdTyPOoZEPU2eFiXjicOLT032BhL229HmtTejBAR_ROSoYxLbxZmo1o7q3y3S-TjJGGoIzqVwlZvoIB9veHmL-mlpxZvGNHFV3C_t-nErUgC46_yyDM9weENDWervj8ebDOVIq1yTvK9DwqgPHXCGFXVyNnKzVvJ-yTTlJodr20YHc6H0hdnTSdeLp1oH1XnlhuQ2zjhu9OSmOTJiKl9aTBNeHU3MlAXr-O1uKIxgNJCXSzibhox1WvbLz0rKg48zI9ZKyidnOfiAYZVow',

    }),
    []
  );

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Vonage E2E Testing App</Text>

      <TouchableOpacity
        testID="start-session-btn"
        onPress={() => setJoined(true)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Create Session + Publisher + Subscriber</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="stop-session-btn"
        onPress={() => setJoined(false)}
        style={[styles.button, styles.secondaryButton]}
      >
        <Text style={styles.buttonText}>Stop Session</Text>
      </TouchableOpacity>

      <Text testID="session-state" style={styles.stateText}>
        {joined ? 'Session Active' : 'Session Inactive'}
      </Text>

      {joined ? (
        <OTSession
          applicationId={creds.applicationId}
          sessionId={creds.sessionId}
          token={creds.token}
        >
          <OTPublisher style={{width: 200, height: 200}} />
          <OTSubscriber style={{width: 200, height: 200}} />        
        </OTSession>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
    backgroundColor: '#111827',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: '#4b5563',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  stateText: {
    color: '#d1d5db',
    marginTop: 6,
    marginBottom: 16,
  },
  videoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  videoTile: {
    width: 160,
    height: 220,
    backgroundColor: '#1f2937',
  },
});

export default App;
