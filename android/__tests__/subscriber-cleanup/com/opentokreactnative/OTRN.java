package com.opentokreactnative;

import com.opentok.android.Subscriber;
import java.util.concurrent.ConcurrentHashMap;

public final class OTRN {
    private final ConcurrentHashMap<String, Subscriber> subscribers = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Object> subscriberStreams = new ConcurrentHashMap<>();

    public ConcurrentHashMap<String, Subscriber> getSubscribers() { return subscribers; }
    public ConcurrentHashMap<String, Object> getSubscriberStreams() { return subscriberStreams; }
}
