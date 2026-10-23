package com.opentok.android;

import java.util.HashSet;
import java.util.Set;

public final class Session {
    public final Set<Subscriber> active = new HashSet<>();
    public int unsubscriptions;

    public void subscribe(Subscriber subscriber) {
        active.add(subscriber);
        subscriber.session = this;
    }

    public void unsubscribe(Subscriber subscriber) {
        if (!subscriber.listenersCleared()) {
            throw new AssertionError("Callbacks still retain the dropped view during unsubscribe");
        }
        if (!active.remove(subscriber)) {
            throw new AssertionError("Subscriber was unsubscribed twice or from the wrong session");
        }
        subscriber.session = null;
        unsubscriptions++;
    }
}
