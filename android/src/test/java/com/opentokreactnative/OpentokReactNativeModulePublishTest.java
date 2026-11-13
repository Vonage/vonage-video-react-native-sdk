package com.opentokreactnative;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UiThreadUtil;
import com.opentok.android.Publisher;
import com.opentok.android.Session;

import org.junit.After;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import org.mockito.MockedStatic;

import java.lang.reflect.Field;

/**
 * Covers the publish()/unpublish() null-safety guards and the pending-publish handshake
 * (publish() before the publisher view attaches records a pending request; unpublish()
 * cancels it).
 *
 * Runs on the plain JVM, so no Publisher instance can exist: PublisherKit's static
 * initializer calls into libopentok. Session can be mocked once the SDK's native library
 * is marked as loaded. UiThreadUtil.runOnUiThread runs inline.
 */
public class OpentokReactNativeModulePublishTest {

    private OTRN sharedState;
    private OpentokReactNativeModule module;
    private Session session;
    private MockedStatic<UiThreadUtil> uiThread;

    @BeforeClass
    public static void skipNativeLibraryLoad() throws Exception {
        Field loaded = Class.forName("com.opentok.android.Loader").getDeclaredField("loaded");
        loaded.setAccessible(true);
        loaded.setBoolean(null, true);
    }

    @Before
    public void setUp() {
        uiThread = mockStatic(UiThreadUtil.class);
        uiThread.when(() -> UiThreadUtil.runOnUiThread(any(Runnable.class)))
                .thenAnswer(invocation -> {
                    invocation.<Runnable>getArgument(0).run();
                    return null;
                });
        sharedState = OTRN.getSharedState();
        clearSharedState();
        session = mock(Session.class);
        sharedState.getSessions().put("session1", session);
        module = new OpentokReactNativeModule(mock(ReactApplicationContext.class));
    }

    @After
    public void tearDown() {
        clearSharedState();
        uiThread.close();
    }

    private void clearSharedState() {
        sharedState.getSessions().clear();
        sharedState.getPublishers().clear();
        sharedState.getPendingPublishers().clear();
    }

    @Test
    public void publish_withNullSessionId_doesNothing() {
        module.publish(null, "pub1");

        assertFalse(sharedState.getPendingPublishers().containsKey("pub1"));
        verify(session, never()).publish((Publisher) any());
    }

    @Test
    public void publish_withNullPublisherId_doesNothing() {
        module.publish("session1", null);

        assertTrue(sharedState.getPendingPublishers().isEmpty());
        verify(session, never()).publish((Publisher) any());
    }

    @Test
    public void publish_withUnknownSessionId_doesNothing() {
        module.publish("missing-session", "pub1");

        assertFalse(sharedState.getPendingPublishers().containsKey("pub1"));
    }

    @Test
    public void publish_beforePublisherViewAttached_recordsPendingPublish() {
        module.publish("session1", "pub1");

        assertTrue("publishStream() completes the publish once the view attaches",
                sharedState.getPendingPublishers().containsKey("pub1"));
        verify(session, never()).publish((Publisher) any());
    }

    @Test
    public void unpublish_withNullSessionId_doesNothing() {
        sharedState.getPendingPublishers().put("pub1", Boolean.TRUE);

        module.unpublish(null, "pub1");

        assertTrue("pending request is untouched when sessionId is null",
                sharedState.getPendingPublishers().containsKey("pub1"));
    }

    @Test
    public void unpublish_withNullPublisherId_doesNothing() {
        module.unpublish("session1", null);

        verify(session, never()).unpublish((Publisher) any());
    }

    @Test
    public void unpublish_withUnknownPublisherId_doesNotTouchSession() {
        module.unpublish("session1", "missing-pub");

        verify(session, never()).unpublish((Publisher) any());
    }

    @Test
    public void unpublish_cancelsPendingPublish() {
        sharedState.getPendingPublishers().put("pub1", Boolean.TRUE);

        module.unpublish("session1", "pub1");

        assertFalse("a late-attaching view must not publish after unpublish()",
                sharedState.getPendingPublishers().containsKey("pub1"));
    }
}
