// OpenTok/Vonage Video API credentials
// Credentials are now stored in sdk-config.json
import sdkConfig from '../../sdk-config.json';

export const credentials = {
  apiKey: sdkConfig.credentials.video.apiKey,
  sessionId: sdkConfig.credentials.video.sessionId,
  token: sdkConfig.credentials.video.token,
  apiUrl: sdkConfig.credentials.video.apiUrl || '',
};
