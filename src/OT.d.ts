import type { Spec } from './NativeOpentok';
import type { CallingServicesAPI } from './types';

export declare const OT: Spec;
export declare const nativeEvents: Record<string, unknown>;
export declare function checkAndroidPermissions(
  audioTrack: boolean,
  videoTrack: boolean,
  isScreenSharing: boolean
): Promise<void>;

export declare const isCallingServicesModeAvailable: CallingServicesAPI['isCallingServicesModeAvailable'];
export declare const enableCallingServicesMode: CallingServicesAPI['enableCallingServicesMode'];
export declare const preconfigureAudioSessionForCall: CallingServicesAPI['preconfigureAudioSessionForCall'];
export declare const notifyAudioSessionActivated: CallingServicesAPI['notifyAudioSessionActivated'];
export declare const notifyAudioSessionDeactivated: CallingServicesAPI['notifyAudioSessionDeactivated'];
export declare const setRequestAudioFocus: CallingServicesAPI['setRequestAudioFocus'];
export declare const notifyAudioFocusActivated: CallingServicesAPI['notifyAudioFocusActivated'];
export declare const notifyAudioFocusDeactivated: CallingServicesAPI['notifyAudioFocusDeactivated'];
