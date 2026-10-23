package com.opentokreactnative.utils;

import com.opentok.android.Session;
import com.opentok.android.Subscriber;
import com.opentokreactnative.OTRN;

public final class SubscriberCleanup {
    private SubscriberCleanup() {
    }

    // Called on the UI thread by both the TurboModule and final Fabric view teardown.
    public static void release(OTRN sharedState, String streamId, Subscriber subscriber) {
        if (subscriber == null) {
            return;
        }
        subscriber.setSubscriberListener(null);
        subscriber.setRtcStatsReportListener(null);
        subscriber.setCaptionsListener(null);
        subscriber.setAudioStatsListener(null);
        subscriber.setVideoStatsListener(null);
        subscriber.setVideoListener(null);
        subscriber.setStreamListener(null);
        subscriber.setAudioLevelListener(null);

        Session session = subscriber.getSession();
        if (session != null) {
            // destroy() alone does not unsubscribe in the current Android SDK.
            session.unsubscribe(subscriber);
        }
        if (streamId != null) {
            // A late view drop must not remove a replacement subscriber for this stream.
            sharedState.getSubscribers().remove(streamId, subscriber);
        }
        subscriber.destroy();
        // Keep subscriberStreams: the remote stream can still be live after unmount.
    }
}
