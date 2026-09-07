import { PermissionsAndroid, Platform } from 'react-native';
import { each } from 'underscore';

import OpentokReactNative from './NativeOpentok';
const nativeEvents = {}; // To do. Impliment callbacks from native.
const OT = OpentokReactNative;

// Used by OTPublisher:
const checkAndroidPermissions = (audioTrack, videoTrack, isScreenSharing) =>
  new Promise((resolve, reject) => {
    // Permissions we request but whose denial must NOT block publishing.
    // BLUETOOTH_CONNECT only enables routing audio to a Bluetooth headset.
    const optionalPermissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ];
    const permissionsToCheck = [
      ...(audioTrack
        ? [
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            // BLUETOOTH_CONNECT is a dangerous runtime permission on Android 12+
            // (API 31+); without it the OS blocks routing audio to BT headsets.
            ...(Platform.OS === 'android' && Number(Platform.Version) >= 31
              ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
              : []),
          ]
        : []),
      ...(videoTrack && !isScreenSharing
        ? [PermissionsAndroid.PERMISSIONS.CAMERA]
        : []),
    ];
    PermissionsAndroid.requestMultiple(permissionsToCheck)
      .then((result) => {
        const permissionsError = {};
        permissionsError.permissionsDenied = [];
        each(result, (permissionValue, permissionType) => {
          // Check if the permission is denied or set to 'never_ask_again'.
          if (
            permissionValue === 'denied' ||
            permissionValue === 'never_ask_again'
          ) {
            // A denied optional permission (e.g. BLUETOOTH_CONNECT) must not
            // block publishing — log it and carry on with audio + video.
            if (optionalPermissions.indexOf(permissionType) !== -1) {
              console.warn(
                `OpenTok: optional permission ${permissionType} denied; ` +
                  'continuing to publish without it.'
              );
              return;
            }
            permissionsError.permissionsDenied.push(permissionType);
            permissionsError.type = 'Permissions error';
          }
        });
        if (permissionsError.permissionsDenied.length > 0) {
          reject(permissionsError);
        } else {
          resolve();
        }
      })
      .catch((error) => {
        reject(error);
      });
  });

export { OT, nativeEvents, checkAndroidPermissions };
