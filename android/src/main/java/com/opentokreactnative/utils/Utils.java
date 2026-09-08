package com.opentokreactnative.utils;

import com.opentok.android.OpentokError;
import com.opentok.android.Publisher;
import com.opentok.android.PublisherKit;
import com.opentok.android.PublisherKit.AudioTransformer;
import com.opentok.android.PublisherKit.VideoTransformer;
import com.opentok.android.PublisherKit.VideoBitratePreset;
import com.opentok.android.Subscriber;
import com.opentok.android.SubscriberKit;
import com.opentok.android.BaseVideoRenderer;
import com.opentok.android.Session.Builder.TransportPolicy;
import com.opentok.android.Session.Builder.IncludeServers;
import com.opentok.android.Session.Builder.IceServer;
import com.opentok.android.BaseVideoCapturer.VideoContentHint;
import com.opentokreactnative.OTRN;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.UiThreadUtil;

import android.util.Log;

import java.util.ArrayList;
import java.util.Map;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

public final class Utils {

    /**
     * Single, safe release path for a publisher held in shared state.
     *
     * WHY THIS EXISTS
     * A publisher is only ever added to OTRN.sharedState.getPublishers() when it is
     * created, and it must be removed on EVERY terminal path or it leaks (holding its
     * native camera capturer). Historically the only removal was in
     * OTRNPublisher.onStreamDestroyed(), so publishers that never produced/destroyed a
     * stream gracefully (publish timeout / error, involuntary session disconnect,
     * rapid unpublish during screen-share toggles) were never removed and accumulated.
     *
     * SAFETY
     * Removal is posted to the main (UI) thread and the strong reference is dropped
     * there. This preserves the original ordering guarantee that avoided an NPE inside
     * Camera2VideoCapturer.destroy() when the reference was dropped while the SDK's
     * queued capturer teardown was still pending on the main Looper.
     *
     * IDEMPOTENT
     * onStreamDestroyed, onError and session onDisconnected can all fire for the same
     * publisher. ConcurrentHashMap.remove() is a no-op when the key is already gone, so
     * this is safe to call multiple times for the same id.
     *
     * @param publisherId the shared-state key (never null/blank for a real publisher).
     * @param reason short label for lifecycle logging (e.g. "streamDestroyed",
     *               "terminalError", "sessionDisconnected").
     */
    public static void releasePublisher(final String publisherId, final String reason) {
        if (publisherId == null || publisherId.isEmpty()) {
            return;
        }
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                ConcurrentHashMap<String, Publisher> publishers =
                        OTRN.sharedState.getPublishers();
                Publisher removed = publishers.remove(publisherId);
                Log.i(
                    "OTRN-LIFECYCLE",
                    "releasePublisher() publisherId=" + publisherId
                        + " reason=" + reason
                        + " removed=" + (removed != null)
                        + " publishersInState=" + publishers.size()
                );
            }
        });
    }

    public static boolean didConnectionFail(OpentokError errorCode) {

        switch (errorCode.getErrorCode()) {
            case ConnectionFailed:
                return true;
            case ConnectionRefused:
                return true;
            case ConnectionTimedOut:
                return true;
            default:
                return false;
        }
    }

    public static boolean contains(ArrayList array, String value) {

        for (int i = 0; i < array.size(); i++) {
            if (array.get(i).equals(value)) {
                return true;
            }
        }
        return false;
    }

    public static String getPublisherId(PublisherKit publisherKit) {

        Map<String, Publisher> publishers = OTRN.sharedState.getPublishers();
        for (Map.Entry<String, Publisher> entry : publishers.entrySet()) {
            Publisher mPublisher = entry.getValue();
            if (mPublisher.equals(publisherKit)) {
                return entry.getKey();
            }
        }
        return "";
    }

    public static String getStreamIdBySubscriber(SubscriberKit subscriberKit) {

        Map<String, Subscriber> subscribers = OTRN.sharedState.getSubscribers();
        for (Map.Entry<String, Subscriber> entry : subscribers.entrySet()) {
            Subscriber mSubcriber = entry.getValue();
            if (mSubcriber.equals(subscriberKit)) {
                return entry.getKey();
            }
        }
        return "";
    }

    public static IncludeServers sanitizeIncludeServer(String value) {
        IncludeServers includeServers = IncludeServers.All;
        if (value != null && value.equals("custom")) {
            includeServers = IncludeServers.Custom;
        }
        return includeServers;
    }

    public static TransportPolicy sanitizeTransportPolicy(String value) {
        TransportPolicy transportPolicy = TransportPolicy.All;
        if (value != null && value.equals("relay")) {
            transportPolicy = TransportPolicy.Relay;
        }
        return transportPolicy;
    }

    public static List<IceServer> sanitizeIceServer(ReadableArray serverList) {
        List<IceServer> iceServers = new ArrayList<>();
        if (serverList != null) {
            for (int i = 0; i < serverList.size(); i++) {
                for (int j = 0; j < serverList.getMap(i).getArray("urls").size(); j++) {
                    iceServers.add(new IceServer(
                            serverList.getMap(i).getArray("urls").getString(j),
                            serverList.getMap(i).getString("username"),
                            serverList.getMap(i).getString("credential")

                    ));
                }
            }
        }
        return iceServers;
    }

    public static ArrayList<AudioTransformer> sanitizeAudioTransformerList(PublisherKit publisher, ReadableArray transformerList) {
        ArrayList<AudioTransformer> nativeAudioTransformers = new ArrayList<>();
        if (transformerList != null) {
            for (int i = 0; i < transformerList.size(); i++) {
                String transformerName = transformerList.getMap(i).getString("name");
                AudioTransformer transformer = publisher.new AudioTransformer(
                        transformerName,
                        transformerList.getMap(i).getString("properties")
                );
                nativeAudioTransformers.add(transformer);
            }
        }
        return nativeAudioTransformers;
    }

    public static ArrayList<VideoTransformer> sanitizeVideoTransformerList(PublisherKit publisher, ReadableArray transformerList) {
        ArrayList<VideoTransformer> nativeVideoTransformers = new ArrayList<>();
        if (transformerList != null) {
            for (int i = 0; i < transformerList.size(); i++) {
                String transformerName = transformerList.getMap(i).getString("name");
                VideoTransformer transformer = publisher.new VideoTransformer(
                        transformerName,
                        transformerList.getMap(i).getString("properties")
                );
                nativeVideoTransformers.add(transformer);
            }
        }
        return nativeVideoTransformers;
    }

    public static VideoContentHint convertVideoContentHint(String videoContentHint) {

        switch (videoContentHint) {
            case "motion":
                return VideoContentHint.MOTION;
            case "detail":
                return VideoContentHint.DETAIL;
            case "text":
                return VideoContentHint.TEXT;
            default:
                return VideoContentHint.NONE;
        }
    }

    public static VideoBitratePreset convertVideoBitratePreset(String videoBitratePreset) {
        switch (videoBitratePreset) {
            case "bw_saver":
                return VideoBitratePreset.VideoBitratePresetBwSaver;
            case "extra_bw_saver":
                return VideoBitratePreset.VideoBitratePresetExtraBwSaver;
            default:
                return VideoBitratePreset.VideoBitratePresetDefault;
        }
    }

    public static PublisherKit.DegradationPreference convertDegradationPreference(int degradationPreference) {
        switch (degradationPreference) {
            case 0:
                return PublisherKit.DegradationPreference.DegradationPreferenceMaintainFrameRateAndResolution;
            case 1:
                return PublisherKit.DegradationPreference.DegradationPreferenceMaintainFrameRate;
            case 2:
                return PublisherKit.DegradationPreference.DegradationPreferenceMaintainResolution;
            case 3:
                return PublisherKit.DegradationPreference.DegradationPreferenceBalanced;
            default:
                return PublisherKit.DegradationPreference.DegradationPreferenceNotSet;
        }
    }
}