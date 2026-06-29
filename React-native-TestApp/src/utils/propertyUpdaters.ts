export const parsePublisherProperty = (prop: string): { key: string; value: any } | null => {
  const arr = prop.replace(/\s/g, '').split(':');
  const key = arr[0];
  let value: any;

  switch (key) {
    case 'audioBitrate':
    case 'frameRate':
      value = parseInt(arr[1], 10);
      break;
    case 'audioTrack':
    case 'videoTrack':
    case 'publishAudio':
    case 'publishVideo':
    case 'publishCaptions':
      value = arr[1].toLowerCase() === 'true';
      break;
    case 'cameraPosition':
    case 'name':
    case 'videoSource':
      value = String(arr[1]);
      break;
    default:
      return null;
  }

  return { key, value };
};

export const parseSubscriberProperty = (prop: string): { key: string; value: any } | null => {
  const arr = prop.replace(/\s/g, '').split(':');
  const key = arr[0];
  let value: any;

  switch (key) {
    case 'audioVolume':
    case 'preferredFrameRate':
      value = parseInt(arr[1], 10);
      break;
    case 'subscribeToAudio':
    case 'subscribeToVideo':
    case 'subscribeToCaptions':
      value = arr[1].toLowerCase() === 'true';
      break;
    case 'preferredResolution':
      value = String(arr[1]);
      break;
    default:
      return null;
  }

  return { key, value };
};
