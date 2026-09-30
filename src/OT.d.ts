import type { Spec } from './NativeOpentok';
import type { CallingServicesAPI } from './types';

export const OT: Spec;
export const nativeEvents: Record<string, unknown>;
export function checkAndroidPermissions(
  audioTrack: boolean,
  videoTrack: boolean,
  isScreenSharing: boolean
): Promise<void>;

export const isCallingServicesModeAvailable: CallingServicesAPI['isCallingServicesModeAvailable'];
export const enableCallingServicesMode: CallingServicesAPI['enableCallingServicesMode'];
export const preconfigureAudioSessionForCall: CallingServicesAPI['preconfigureAudioSessionForCall'];
export const notifyAudioSessionActivated: CallingServicesAPI['notifyAudioSessionActivated'];
export const notifyAudioSessionDeactivated: CallingServicesAPI['notifyAudioSessionDeactivated'];
export const setRequestAudioFocus: CallingServicesAPI['setRequestAudioFocus'];
export const notifyAudioFocusActivated: CallingServicesAPI['notifyAudioFocusActivated'];
export const notifyAudioFocusDeactivated: CallingServicesAPI['notifyAudioFocusDeactivated'];
