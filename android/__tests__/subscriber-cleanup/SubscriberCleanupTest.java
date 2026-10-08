import com.opentok.android.Session;
import com.opentok.android.Subscriber;
import com.opentokreactnative.OTRN;
import com.opentokreactnative.utils.SubscriberCleanup;

public final class SubscriberCleanupTest {
    private static final String STREAM_ID = "remote-stream";

    private static final class Fixture {
        final OTRN state = new OTRN();
        final Session session = new Session();
        final Subscriber subscriber = new Subscriber();
        final Object stream = new Object();

        Fixture() {
            session.subscribe(subscriber);
            state.getSubscribers().put(STREAM_ID, subscriber);
            state.getSubscriberStreams().put(STREAM_ID, stream);
        }

        void assertReleased() {
            check(session.active.isEmpty(), "Native subscription survived teardown");
            check(session.unsubscriptions == 1, "Subscription must be released exactly once");
            check(subscriber.listenersCleared(), "Callbacks still retain the dropped view");
            check(state.getSubscribers().isEmpty(), "Subscriber remains in the shared registry");
            check(state.getSubscriberStreams().get(STREAM_ID) == stream, "Live remote stream lost on unmount");
        }
    }

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    public static void main(String[] args) {
        Fixture nativeFirst = new Fixture();
        SubscriberCleanup.release(nativeFirst.state, STREAM_ID, nativeFirst.subscriber);
        // The queued bridge cleanup now finds no entry; native teardown must have released it.
        SubscriberCleanup.release(nativeFirst.state, STREAM_ID, nativeFirst.state.getSubscribers().get(STREAM_ID));
        nativeFirst.assertReleased();

        Fixture bridgeFirst = new Fixture();
        SubscriberCleanup.release(bridgeFirst.state, STREAM_ID, bridgeFirst.state.getSubscribers().get(STREAM_ID));
        // The view still holds its captured instance after bridge cleanup; repeating is safe.
        SubscriberCleanup.release(bridgeFirst.state, STREAM_ID, bridgeFirst.subscriber);
        bridgeFirst.assertReleased();

        Fixture remount = new Fixture();
        Session replacementSession = new Session();
        Subscriber replacement = new Subscriber();
        replacementSession.subscribe(replacement);
        remount.state.getSubscribers().put(STREAM_ID, replacement);
        SubscriberCleanup.release(remount.state, STREAM_ID, remount.subscriber);
        check(remount.session.active.isEmpty(), "Old subscription remains live after remount");
        check(remount.state.getSubscribers().get(STREAM_ID) == replacement, "Old view removed its replacement");
        check(replacementSession.active.contains(replacement), "Wrong session was unsubscribed");
        check(remount.state.getSubscriberStreams().get(STREAM_ID) == remount.stream, "Remount lost the live stream");

        SubscriberCleanup.release(remount.state, STREAM_ID, null);
        check(remount.state.getSubscribers().get(STREAM_ID) == replacement, "Null cleanup removed another subscriber");

        OTRN detachedState = new OTRN();
        Subscriber detached = new Subscriber();
        detachedState.getSubscribers().put(STREAM_ID, detached);
        SubscriberCleanup.release(detachedState, STREAM_ID, detached);
        check(detached.listenersCleared(), "Detached subscriber retains callbacks");
        check(detachedState.getSubscribers().isEmpty(), "Detached subscriber was not removed");

        Fixture repeated = new Fixture();
        SubscriberCleanup.release(repeated.state, STREAM_ID, repeated.subscriber);
        SubscriberCleanup.release(repeated.state, STREAM_ID, repeated.subscriber);
        repeated.assertReleased();

        Fixture noId = new Fixture();
        noId.state.getSubscribers().clear();
        SubscriberCleanup.release(noId.state, null, noId.subscriber);
        noId.assertReleased();

        System.out.println("PASS: 7 subscriber teardown scenarios (both orderings, remount, null, detached, repeated, missing ID)");
    }
}
