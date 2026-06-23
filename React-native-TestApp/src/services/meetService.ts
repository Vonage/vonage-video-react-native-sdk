import sdkConfig from '../../sdk-config.json';

export interface MeetCredentials {
  apiKey: string;
  sessionId: string;
  token: string;
}

export const fetchMeetCredentials = async (
  roomName: string
): Promise<MeetCredentials> => {
  if (!roomName) {
    throw new Error('Room name is required');
  }

  const roomUri = `${sdkConfig.credentials.meet.baseUrl}/${roomName}?tokenRole=moderator`;

  const response = await fetch(roomUri, {
    method: 'GET',
    headers: {
      'X-OPENTOK-MEET-AUTH': sdkConfig.credentials.meet.authHeader,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Response error:', errorText);
    throw new Error(
      `Failed to retrieve meet data: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();

  if (!data.apiKey || !data.sessionId || !data.token) {
    throw new Error('Invalid response: Missing credentials');
  }

  return {
    apiKey: data.apiKey,
    sessionId: data.sessionId,
    token: data.token,
  };
};
