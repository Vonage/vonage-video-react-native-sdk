package com.opentok.android;

import java.util.Arrays;

public final class Subscriber {
    Session session;
    private final Object[] listeners = new Object[8];

    public Subscriber() {
        Arrays.fill(listeners, new Object());
    }

    public Session getSession() { return session; }
    public void setSubscriberListener(Object listener) { listeners[0] = listener; }
    public void setRtcStatsReportListener(Object listener) { listeners[1] = listener; }
    public void setCaptionsListener(Object listener) { listeners[2] = listener; }
    public void setAudioStatsListener(Object listener) { listeners[3] = listener; }
    public void setVideoStatsListener(Object listener) { listeners[4] = listener; }
    public void setVideoListener(Object listener) { listeners[5] = listener; }
    public void setStreamListener(Object listener) { listeners[6] = listener; }
    public void setAudioLevelListener(Object listener) { listeners[7] = listener; }

    public boolean listenersCleared() {
        return Arrays.stream(listeners).allMatch(listener -> listener == null);
    }

    // Matches client-sdk-video 2.35.2-alpha.0: destroy() does not unsubscribe.
    public void destroy() {
    }
}
