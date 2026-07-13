package com.opentokreactnative;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.facebook.react.bridge.ReactApplicationContext;
import com.opentok.android.Publisher;
import com.opentok.android.Session;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/**
 * Covers the publish()/unpublish() null-safety guards added in #226, including the
 * publishers.remove(publisherId) fix (it was previously removing by Publisher instance
 * instead of by the map's String key, which silently failed to evict the entry).
 */
public class OpentokReactNativeModulePublishTest {

    private OTRN sharedState;
    private OpentokReactNativeModule module;

    @Before
    public void setUp() {
        sharedState = OTRN.getSharedState();
        sharedState.getSessions().clear();
        sharedState.getPublishers().clear();
        module = new OpentokReactNativeModule(mock(ReactApplicationContext.class));
    }

    @After
    public void tearDown() {
        sharedState.getSessions().clear();
        sharedState.getPublishers().clear();
    }

    @Test
    public void publish_withNullSessionId_doesNothing() {
        Session session = mock(Session.class);
        Publisher publisher = mock(Publisher.class);
        sharedState.getSessions().put("session1", session);
        sharedState.getPublishers().put("pub1", publisher);

        module.publish(null, "pub1");

        verify(session, never()).publish(publisher);
    }

    @Test
    public void publish_withNullPublisherId_doesNothing() {
        Session session = mock(Session.class);
        sharedState.getSessions().put("session1", session);

        module.publish("session1", null);

        verify(session, never()).publish((Publisher) org.mockito.ArgumentMatchers.any());
    }

    @Test
    public void publish_withUnknownSessionId_doesNothing() {
        Publisher publisher = mock(Publisher.class);
        sharedState.getPublishers().put("pub1", publisher);

        // No exception for a session that isn't in sharedState.
        module.publish("missing-session", "pub1");
    }

    @Test
    public void publish_withUnknownPublisherId_doesNotCallSessionPublish() {
        Session session = mock(Session.class);
        sharedState.getSessions().put("session1", session);

        module.publish("session1", "missing-pub");

        verify(session, never()).publish((Publisher) org.mockito.ArgumentMatchers.any());
    }

    @Test
    public void publish_withKnownSessionAndPublisher_publishesOnSession() {
        Session session = mock(Session.class);
        Publisher publisher = mock(Publisher.class);
        sharedState.getSessions().put("session1", session);
        sharedState.getPublishers().put("pub1", publisher);

        module.publish("session1", "pub1");

        verify(session).publish(publisher);
    }

    @Test
    public void unpublish_withNullSessionId_doesNothing() {
        Publisher publisher = mock(Publisher.class);
        sharedState.getPublishers().put("pub1", publisher);

        module.unpublish(null, "pub1");

        assertTrue("publisher map is untouched when sessionId is null",
                sharedState.getPublishers().containsKey("pub1"));
    }

    @Test
    public void unpublish_withNullPublisherId_doesNothing() {
        Session session = mock(Session.class);
        sharedState.getSessions().put("session1", session);

        module.unpublish("session1", null);

        verify(session, never()).unpublish((Publisher) org.mockito.ArgumentMatchers.any());
    }

    @Test
    public void unpublish_withUnknownPublisherId_doesNotTouchSessionOrMap() {
        Session session = mock(Session.class);
        sharedState.getSessions().put("session1", session);

        module.unpublish("session1", "missing-pub");

        verify(session, never()).unpublish((Publisher) org.mockito.ArgumentMatchers.any());
    }

    @Test
    public void unpublish_withKnownSessionAndPublisher_unpublishesAndEvictsMapEntryByKey() {
        Session session = mock(Session.class);
        Publisher publisher = mock(Publisher.class);
        sharedState.getSessions().put("session1", session);
        sharedState.getPublishers().put("pub1", publisher);

        module.unpublish("session1", "pub1");

        verify(session).unpublish(publisher);
        // Regression check for the publishers.remove(publisher) -> publishers.remove(publisherId)
        // fix: the map is keyed by String publisherId, not by the Publisher instance.
        assertFalse("publisher entry must be evicted from the map by its String key",
                sharedState.getPublishers().containsKey("pub1"));
    }
}
