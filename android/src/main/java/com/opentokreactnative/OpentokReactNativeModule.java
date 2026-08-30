package com.opentokreactnative;

import android.util.Log;

import java.util.List;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.opentok.android.Connection;
import com.opentok.android.MuteForcedInfo;
import com.opentok.android.OpentokError;
import com.opentok.android.Publisher;
import com.opentok.android.PublisherKit;
import com.opentok.android.Session;
import com.opentok.android.Session.Builder.TransportPolicy;
import com.opentok.android.Session.Builder.IncludeServers;
import com.opentok.android.Session.Builder.IceServer;
import com.opentok.android.Session.SessionOptions;
import com.opentok.android.Session.SessionListener;
import com.opentok.android.Session.SignalListener;
import com.opentok.android.Stream;
import com.opentok.android.Subscriber;
import com.opentokreactnative.utils.EventUtils;
import com.opentokreactnative.utils.Utils;


@ReactModule(name = OpentokReactNativeModule.NAME)
public class OpentokReactNativeModule extends NativeOpentokSpec implements
        SessionListener,
        SignalListener,
        Session.ConnectionListener,
        Session.ReconnectionListener,
        Session.ArchiveListener,
        Session.MuteListener,
        Session.StreamPropertiesListener,
        Session.StreamCaptionsPropertiesListener,
        LifecycleEventListener {
    public static final String NAME = "OpentokReactNative";

    private ReactApplicationContext context = null;
    private OTRN sharedState = OTRN.getSharedState();

    @Override
    public String getName() {
        return NAME;
    }

    public OpentokReactNativeModule(ReactApplicationContext reactContext) {
        super(reactContext);
        context = reactContext;
        reactContext.addLifecycleEventListener(this);
        installCamera2CrashGuard();
    }

    // -----------------------------------------------------------------------
    // Camera2VideoCapturer.destroy() crash guard
    //
    // The native Vonage Video SDK (v2.34.0) has a bug where
    // Camera2VideoCapturer.destroy() calls ImageReader.close() without a
    // null-check. The destroy is posted to the main thread via a Handler
    // lambda from onCaptureDestroyJNI, making it impossible to catch with
    // a try-catch around session.unpublish()/disconnect().
    //
    // This handler intercepts ONLY that specific NPE. All other exceptions
    // are forwarded to the default handler unchanged. Every suppressed
    // occurrence is logged to logcat at WARN level so it remains visible
    // during development and CI.
    // -----------------------------------------------------------------------

    private static final String TAG = "OTCamera2CrashGuard";
    private static final AtomicBoolean sCrashGuardInstalled = new AtomicBoolean(false);

    private static void installCamera2CrashGuard() {
        if (!sCrashGuardInstalled.compareAndSet(false, true)) {
            return; // Already installed (module re-created across reloads)
        }
        final Thread mainThread = android.os.Looper.getMainLooper().getThread();
        final Thread.UncaughtExceptionHandler previousHandler = mainThread.getUncaughtExceptionHandler();

        mainThread.setUncaughtExceptionHandler((thread, throwable) -> {
            if (isCamera2DestroyNPE(throwable)) {
                Log.w(TAG,
                    "Suppressed known native SDK crash in Camera2VideoCapturer.destroy() " +
                    "(ImageReader was null during publisher teardown). " +
                    "This is a bug in VonageClientSDKVideo — report to native team.",
                    throwable);
                return;
            }
            // Everything else goes to the previous handler (React Native / system)
            if (previousHandler != null) {
                previousHandler.uncaughtException(thread, throwable);
            }
        });
    }

    /**
     * Matches ONLY:
     *  - NullPointerException
     *  - with Camera2VideoCapturer.destroy() in the stack
     *  - called from PublisherKit (onCaptureDestroyJNI lambda)
     *
     * This tight filter ensures we never accidentally suppress unrelated NPEs.
     */
    private static boolean isCamera2DestroyNPE(Throwable throwable) {
        if (!(throwable instanceof NullPointerException)) {
            return false;
        }
        StackTraceElement[] stack = throwable.getStackTrace();
        if (stack == null || stack.length == 0) {
            return false;
        }
        boolean hasCamera2Destroy = false;
        boolean hasPublisherKit = false;
        for (StackTraceElement el : stack) {
            String cls = el.getClassName();
            if (cls != null) {
                if (cls.contains("Camera2VideoCapturer") && "destroy".equals(el.getMethodName())) {
                    hasCamera2Destroy = true;
                }
                if (cls.contains("PublisherKit")) {
                    hasPublisherKit = true;
                }
            }
            if (hasCamera2Destroy && hasPublisherKit) {
                return true;
            }
        }
        return false;
    }

    @Override
    public void initSession(String apiKey, String sessionId, ReadableMap options) {

        final boolean useTextureViews = options.getBoolean("useTextureViews");
        final boolean connectionEventsSuppressed = options.getBoolean("connectionEventsSuppressed");
        final boolean ipWhitelist = options.getBoolean("ipWhitelist");
        final List<IceServer> iceServersList = Utils.sanitizeIceServer(options.getArray("customServers"));
        final IncludeServers includeServers = Utils.sanitizeIncludeServer(options.getString("includeServers"));
        final TransportPolicy transportPolicy = Utils.sanitizeTransportPolicy(options.getString("transportPolicy"));
        final String proxyUrl = options.getString("proxyUrl");
        final String apiUrl = options.getString("apiUrl");
        final String androidOnTop = options.getString("androidOnTop");
        final String androidZOrder = options.getString("androidZOrder");
        final boolean singlePeerConnection = options.getBoolean("enableSinglePeerConnection");
        final boolean sessionMigration = options.getBoolean("sessionMigration");
        ConcurrentHashMap<String, String> androidOnTopMap = sharedState.getAndroidOnTopMap();
        ConcurrentHashMap<String, String> androidZOrderMap = sharedState.getAndroidZOrderMap();

        Session.Builder sessionBuilder = new Session.Builder(context, apiKey, sessionId)
            .sessionOptions(new Session.SessionOptions() {
                @Override
                public boolean useTextureViews() {
                    return useTextureViews;
                }
            })
            .connectionEventsSuppressed(connectionEventsSuppressed)
            .setCustomIceServers(iceServersList, includeServers)
            .setIceRouting(transportPolicy)
            .setIpWhitelist(ipWhitelist)
            .setProxyUrl(proxyUrl)
            .setSinglePeerConnection(singlePeerConnection)
            .setSessionMigration(sessionMigration);

        // Set custom API URL if provided
        if (apiUrl != null && !apiUrl.isEmpty()) {
            try {
                sessionBuilder.setApiUrl(new java.net.URL(apiUrl));
            } catch (java.net.MalformedURLException e) {
                android.util.Log.e(NAME, "Invalid API URL: " + apiUrl, e);
            }
        }

        Session session = sessionBuilder.build();

        sharedState.getSessions().put(sessionId, session);

        session.setArchiveListener(this);
        session.setConnectionListener(this);
        session.setMuteListener(this);
        session.setMuteListener(this);
        session.setSessionListener(this);
        session.setSignalListener(this);
        session.setStreamCaptionsPropertiesListener(this);
        session.setStreamPropertiesListener(this);
        androidOnTopMap.put(sessionId, androidOnTop);
        androidZOrderMap.put(sessionId, androidZOrder);
    }

    @Override
    public void connect(String sessionId, String token, Promise promise) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        if (mSession != null) {
            mSession.connect(token);
        promise.resolve(null);
        } else {
            promise.reject("Error connecting to session. Could not find native session instance");
        }
    }

    @Override
    public void disconnect(String sessionId, Promise promise) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        if (mSession != null) {
            mSession.disconnect();
            promise.resolve(null);
        }
    }

    @Override
    public void sendSignal(String sessionId, String type, String data, String to) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        if (mSession == null) {
            return;
        }
        String connectionId = to;
        if (connectionId == null || connectionId.equals("")) {
            mSession.sendSignal(type, data);
            return;
        }
        ConcurrentHashMap<String, Connection> mConnections = sharedState.getConnections();
        Connection mConnection = mConnections.get(connectionId);
        if (mConnection == null) {
            // TODO: surface errror if Connection not found
            return;
        }
        mSession.sendSignal(type, data, mConnection);
    }

    @Override
    public void getSubscriberRtcStatsReport(String sessionId) {
        ConcurrentHashMap<String, Subscriber> subscribers = sharedState.getSubscribers();
        ArrayList<Subscriber> subscriberList = new ArrayList<>(subscribers.values());
        for (Subscriber subscriber : subscriberList) {
            subscriber.getRtcStatsReport();
        }
    }

    @Override
    public void publish(String sessionId, String publisherId) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        if (mSession == null) {
            return;
        }
        ConcurrentHashMap<String, Publisher> publishers = sharedState.getPublishers();
        Publisher publisher = publishers.get(publisherId);
        if (publisher != null) {
            mSession.publish(publisher);
        }
    }

    @Override
    public void unpublish(String sessionId, String publisherId) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        if (mSession == null) {
            return;
        }
        ConcurrentHashMap<String, Publisher> publishers = sharedState.getPublishers();
        Publisher publisher = publishers.get(publisherId);
        if (publisher != null) {
            try {
                mSession.unpublish(publisher);
            } catch (Exception e) {
                // Native SDK may throw NullPointerException inside
                // Camera2VideoCapturer.destroy() if ImageReader is null
                // (race with concurrent teardown). Safe to swallow.
            }
            // Fix: remove by String key, not by Publisher object reference.
            // ConcurrentHashMap is keyed by publisherId (String), so passing the
            // Publisher object was a no-op that caused publishers to never be freed.
            publishers.remove(publisherId);
        }
    }

    @Override
    public void removeSubscriber(String sessionId, String streamId) {
        UiThreadUtil.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
                Session mSession = mSessions.get(sessionId);
                if (mSession == null) {
                    return;
                }
                ConcurrentHashMap<String, Subscriber> subscribers = sharedState.getSubscribers();
                Subscriber subscriber = subscribers.get(streamId);
                if (subscriber != null) {
                    mSession.unsubscribe(subscriber);
                    // Fix: remove by String key (streamId), not by Subscriber object.
                    // The map is keyed by streamId, so passing the Subscriber object
                    // was a no-op that caused subscribers to never be freed.
                    subscribers.remove(streamId);
                }
                // Also remove the stream reference so it doesn't accumulate
                // across join/leave cycles during prolonged calls.
                sharedState.getSubscriberStreams().remove(streamId);
            };
        });
    }

    @Override
    public void disableForceMute(String sessionId, Promise promise) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        if (mSession == null) {
            promise.reject("Session not found.");
            return;
        }
        mSession.disableForceMute();
        promise.resolve(true);
    }

    @Override
    public void forceMuteAll(String sessionId, ReadableArray excludedStreamIds, Promise promise) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        ConcurrentHashMap<String, Stream> subscriberStreams = sharedState.getSubscriberStreams();
        ConcurrentHashMap<String, Stream> publisherStreams = sharedState.getPublisherStreams();
        ArrayList<Stream> mExcludedStreams = new ArrayList<Stream>();
        if (mSession == null) {
            promise.reject("Session not found.");
            return;
        }
        for (int i = 0; i < excludedStreamIds.size(); i++) {
            String streamId = excludedStreamIds.getString(i);
            Stream mStream = subscriberStreams.get(streamId);
            if (mStream == null) {
                mStream = publisherStreams.get(streamId);
            }
            if (mStream == null) {
                continue;
            }
            mExcludedStreams.add(mStream);
        }
        mSession.forceMuteAll(mExcludedStreams);
        promise.resolve(true);
    }

    @Override
    public void forceMuteStream(String sessionId, String streamId, Promise promise) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        ConcurrentHashMap<String, Stream> streams = sharedState.getSubscriberStreams();
        if (mSession == null) {
            promise.reject("Session not found.");
            return;
        }
        Stream mStream = streams.get(streamId);
        if (mStream == null) {
            promise.reject("Stream not found.");
            return;
        }
        mSession.forceMuteStream(mStream);
        promise.resolve(null);
    }

    @Override
    public void forceDisconnect(String sessionId, String connectionId, Promise promise) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        ConcurrentHashMap<String, Connection> connections = sharedState.getConnections();
        if (mSession == null) {
            promise.reject("Session not found.");
            return;
        }
        Connection mConnection = connections.get(connectionId);
        if (mConnection == null) {
            promise.reject("Connection not found.");
            return;
        }
        mSession.forceDisconnect(mConnection);
        promise.resolve(null);
    }

    @Override
    public void getPublisherRtcStatsReport(String sessionId, String publisherId) {
        ConcurrentHashMap<String, Publisher> publishers = sharedState.getPublishers();
        Publisher publisher = publishers.get(publisherId);
        if (publisher != null) {
            publisher.getRtcStatsReport();
        }
    }

    // @Override Move this to publisher code
    public void setAudioTransformers(String sessionId, String publisherId, ReadableArray audioTransformers) {
        ConcurrentHashMap<String, Publisher> publishers = sharedState.getPublishers();
        Publisher publisher = publishers.get(publisherId);
        if (publisher != null) {
            ArrayList<PublisherKit.AudioTransformer> nativeAudioTransformers = Utils.sanitizeAudioTransformerList(publisher, audioTransformers);
            publisher.setAudioTransformers(nativeAudioTransformers);
        }
    }

    //@Override Move this to publisher code
    public void setVideoTransformers(String sessionId, String publisherId, ReadableArray videoTransformers) {
        ConcurrentHashMap<String, Publisher> publishers = sharedState.getPublishers();
        Publisher publisher = publishers.get(publisherId);
        if (publisher != null) {
            ArrayList<PublisherKit.VideoTransformer> nativeVideoTransformers = Utils.sanitizeVideoTransformerList(publisher, videoTransformers);
            publisher.setVideoTransformers(nativeVideoTransformers);
        }
    }

    @Override
    public void getCapabilities(String sessionId, Promise promise) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        if (mSession == null) {
            promise.reject("Session not found.");
            return;
        }
        // The native getCapabilities() segfaults (SIGSEGV in libopentok) when the
        // session is not yet connected. The connection is null until onConnected
        // fires, so guard on it before touching capabilities.
        if (mSession.getConnection() == null) {
            promise.reject("Capabilities are unavailable until the session is connected.");
            return;
        }
        WritableMap sessionCapabilitiesMap = Arguments.createMap();
        Session.Capabilities sessionCapabilities = mSession.getCapabilities();
        sessionCapabilitiesMap.putBoolean("canForceMute", sessionCapabilities.canForceMute);
        sessionCapabilitiesMap.putBoolean("canPublish", sessionCapabilities.canPublish);
        // Bug in OT Android SDK. This should always be true, but it is set to false:
        sessionCapabilitiesMap.putBoolean("canSubscribe", true);
        sessionCapabilitiesMap.putBoolean("canForceDisconnect", sessionCapabilities.canForceDisconnect);
        promise.resolve(sessionCapabilitiesMap);
    }

    @Override
    public void reportIssue(String sessionId, Promise promise) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        if (mSession != null){
            promise.resolve(mSession.reportIssue());
        } else {
            promise.reject("Error connecting to session. Could not find native session instance.");
        }
    }

    @Override
    public void setEncryptionSecret(String sessionId, String secret, Promise promise) {
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        Session mSession = mSessions.get(sessionId);
        if (mSession != null) {
            mSession.setEncryptionSecret(secret);
            promise.resolve(null);
        } else {
            promise.reject("There was an error setting the encryption secret. The native session instance could not be found.");
        }
    }

    @Override
    public void onConnected(Session session) {
        Connection connection = session.getConnection();
        if (connection == null) {
          return;
        }
        sharedState.getConnections().put(connection.getConnectionId(), connection);
        WritableMap payload = EventUtils.prepareJSSessionMap(session);
        emitOnSessionConnected(payload);
    }

    @Override
    public void onDisconnected(Session session) {
        WritableMap payload = EventUtils.prepareJSSessionMap(session);
        emitOnSessionDisconnected(payload);

        String sessionId = session.getSessionId();

        sharedState.getAndroidOnTopMap().remove(sessionId);
        sharedState.getAndroidZOrderMap().remove(sessionId);

        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        mSessions.remove(sessionId);
    }

    @Override
    public void onStreamReceived(Session session, Stream stream) {
        sharedState.getSubscriberStreams().put(stream.getStreamId(), stream);
        WritableMap payload = EventUtils.prepareJSStreamMap(stream, session);
        emitOnStreamCreated(payload);
    }

    @Override
    public void onStreamDropped(Session session, Stream stream) {
        // Fix: remove the stream from subscriberStreams to prevent stale references
        // from accumulating during prolonged calls. Without this, every stream that
        // joins and leaves keeps its native Stream object alive indefinitely.
        sharedState.getSubscriberStreams().remove(stream.getStreamId());
        WritableMap payload = EventUtils.prepareJSStreamMap(stream, session);
        emitOnStreamDestroyed(payload);
    }

    @Override
    public void onError(Session session, OpentokError opentokError) {
        WritableMap payload = EventUtils.prepareJSErrorMap(opentokError);
        emitOnSessionError(payload);
    }

    @Override
    public void onSignalReceived(Session session, String type, String data, Connection connection) {
        WritableMap payload = Arguments.createMap();
        payload.putString("sessionId", session.getSessionId());
        payload.putString("connectionId", connection.getConnectionId());
        payload.putString("type", type);
        payload.putString("data", data);
        emitOnSignalReceived(payload);
    }

    @Override
    public void onArchiveStarted(Session session, String id, String name) {
        WritableMap payload = Arguments.createMap();
        payload.putString("sessionId", session.getSessionId());
        payload.putString("archiveId", id);
        payload.putString("name", name);
        emitOnArchiveStarted(payload);
    }

    @Override
    public void onArchiveStopped(Session session, String id) {
        WritableMap archiveInfo = Arguments.createMap();
        archiveInfo.putString("archiveId", id);
        archiveInfo.putString("name", "");
        archiveInfo.putString("sessionId", session.getSessionId());
        emitOnArchiveStopped(archiveInfo);
    }

    @Override
    public void onConnectionCreated(Session session, Connection connection) {
        sharedState.getConnections().put(connection.getConnectionId(), connection);
        WritableMap eventData = EventUtils.prepareJSConnectionMap(
        connection);
        eventData.putString("sessionId", session.getSessionId());
        emitOnConnectionCreated(eventData);
    }

    @Override
    public void onConnectionDestroyed(Session session, Connection connection) {
        ConcurrentHashMap<String, Connection> mConnections = sharedState.getConnections();
        mConnections.remove(connection.getConnectionId());
        WritableMap eventData = EventUtils.prepareJSConnectionMap(
        connection);
        eventData.putString("sessionId", session.getSessionId());
        emitOnConnectionDestroyed(eventData);
    }

    @Override
    public void onMuteForced(Session session, MuteForcedInfo muteForcedInfo) {
        WritableMap info = Arguments.createMap();
        info.putBoolean("active", muteForcedInfo.getActive());
        emitOnMuteForced(info);
    }

    @Override
    public void onReconnecting(Session session) {
        emitOnSessionReconnecting(null);
    }

    @Override
    public void onReconnected(Session session) {
        emitOnSessionReconnected(null);
    }

    @Override
    public void onStreamHasCaptionsChanged(Session session, Stream stream, boolean hasCaptions) {
        WritableMap eventData = EventUtils.prepareStreamPropertyChangedEventData(
                "hasCaptions", !hasCaptions, hasCaptions, stream, session);
        emitOnStreamPropertyChanged(eventData);
        OTRNSubscriber.requestCacheRefreshForStream(stream.getStreamId());
    }

    @Override
    public void onStreamHasAudioChanged(Session session, Stream stream, boolean hasAudio) {
        WritableMap eventData = EventUtils.prepareStreamPropertyChangedEventData(
                "hasAudio", !hasAudio, hasAudio, stream, session);
        emitOnStreamPropertyChanged(eventData);
        OTRNSubscriber.requestCacheRefreshForStream(stream.getStreamId());
    }

    @Override
    public void onStreamHasVideoChanged(Session session, Stream stream, boolean hasVideo) {
        WritableMap eventData = EventUtils.prepareStreamPropertyChangedEventData(
                "hasVideo", !hasVideo, hasVideo, stream, session);
        emitOnStreamPropertyChanged(eventData);
        OTRNSubscriber.requestCacheRefreshForStream(stream.getStreamId());
    }

    @Override
    public void onStreamVideoDimensionsChanged(Session session, Stream stream, int width, int height) {
        ConcurrentHashMap<String, Stream> mSubscriberStreams = sharedState.getSubscriberStreams();
        Stream mStream = mSubscriberStreams.get(stream.getStreamId());
        WritableMap oldVideoDimensions = Arguments.createMap();
        if (mStream != null) {
            oldVideoDimensions.putInt("height", mStream.getVideoHeight());
            oldVideoDimensions.putInt("width", mStream.getVideoWidth());
        }
        WritableMap newVideoDimensions = Arguments.createMap();
        newVideoDimensions.putInt("height", height);
        newVideoDimensions.putInt("width", width);
        WritableMap eventData = EventUtils.prepareStreamPropertyChangedEventData(
                "videoDimensions", oldVideoDimensions, newVideoDimensions, stream, session);
        emitOnStreamPropertyChanged(eventData);
        OTRNSubscriber.requestCacheRefreshForStream(stream.getStreamId());
    }

    @Override
    public void onStreamVideoTypeChanged(Session session, Stream stream, Stream.StreamVideoType streamVideoType) {
        ConcurrentHashMap<String, Stream> mSubscriberStreams = sharedState.getSubscriberStreams();
        String oldVideoType = stream.getStreamVideoType().toString();
        WritableMap eventData = EventUtils.prepareStreamPropertyChangedEventData(
                "videoType", oldVideoType, streamVideoType.toString(), stream, session);
        emitOnStreamPropertyChanged(eventData);
        OTRNSubscriber.requestCacheRefreshForStream(stream.getStreamId());
    }

    // --- Lifecycle management for OpenTok video rendering ---
    // The OpenTok SDK uses GLSurfaceView for video rendering, which requires
    // onPause()/onResume() to be forwarded from the Activity lifecycle.
    // Without these calls, the GL context and video pipeline degrade over time
    // as unmanaged lifecycle transitions accumulate (notifications, screen off, etc.).
    // This was present in v2.30.2 and was lost during the new architecture rewrite.

    @Override
    public void onHostResume() {
        ConcurrentHashMap<String, Publisher> publishers = sharedState.getPublishers();
        for (Publisher publisher : publishers.values()) {
            publisher.onResume();
        }
        // TODO: Consider adding subscriber.onResume() for subscriber GLSurfaceViews.
        // The old v2.30.2 code only managed publisher lifecycle. Adding subscriber
        // lifecycle would be more correct but deviates from proven behavior.
    }

    @Override
    public void onHostPause() {
        ConcurrentHashMap<String, Publisher> publishers = sharedState.getPublishers();
        for (Publisher publisher : publishers.values()) {
            publisher.onPause();
        }
        // TODO: Consider adding subscriber.onPause() for subscriber GLSurfaceViews.
        // See onHostResume() comment above.
    }

    @Override
    public void onHostDestroy() {
    }
}
