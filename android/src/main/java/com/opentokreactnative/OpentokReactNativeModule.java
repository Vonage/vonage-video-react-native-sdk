package com.opentokreactnative;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.facebook.react.bridge.Arguments;
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
        // Revisit this
        Application.ActivityLifecycleCallbacks {
    public static final String NAME = "OpentokReactNative";

    /**
     * Dedicated tag for session/publisher/subscriber lifecycle transitions.
     * Filter with: adb logcat -s OTRN-LIFECYCLE
     * Intentionally limited to discrete lifecycle events (create/teardown) so it
     * stays low-volume — never attach this to per-frame or per-stats callbacks.
     */
    private static final String LIFECYCLE_TAG = "OTRN-LIFECYCLE";

    private ReactApplicationContext context = null;
    private OTRN sharedState = OTRN.getSharedState();

    /**
     * Snapshot of shared-state map sizes. Used to spot unbounded growth (leaks)
     * and to confirm teardown actually released native objects.
     */
    private String sharedStateSummary() {
        return "sessions=" + sharedState.getSessions().size()
                + " publishers=" + sharedState.getPublishers().size()
                + " subscribers=" + sharedState.getSubscribers().size()
                + " subscriberStreams=" + sharedState.getSubscriberStreams().size()
                + " publisherStreams=" + sharedState.getPublisherStreams().size()
                + " connections=" + sharedState.getConnections().size();
    }

    @Override
    public String getName() {
        return NAME;
    }

    public OpentokReactNativeModule(ReactApplicationContext reactContext) {
        super(reactContext);
        context = reactContext;
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
        Log.i(LIFECYCLE_TAG, "disconnect() sessionId=" + sessionId
                + " found=" + (mSession != null) + " | " + sharedStateSummary());
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
        ConcurrentHashMap<String, Publisher> publishers = sharedState.getPublishers();
        Publisher publisher = publishers.get(publisherId);
        Session mSession = sharedState.getSessions().get(sessionId);
        Log.i(LIFECYCLE_TAG, "unpublish() publisherId=" + publisherId
                + " found=" + (publisher != null)
                + " sessionFound=" + (mSession != null) + " | " + sharedStateSummary());
        if (publisher == null) {
            return;
        }
        // Do not bail out when the session lookup fails. On an involuntary disconnect
        // onDisconnected() removes the session from shared state before JS unmounts the
        // publisher, so an early return here made the whole call a no-op on exactly the
        // path that leaked.
        if (mSession != null) {
            mSession.unpublish(publisher);
        }
        // The publisher is deliberately NOT removed from shared state here — this is the
        // graceful path, so onStreamDestroyed will clear the entry once the SDK confirms
        // the stream is gone. OTRNPublisher.releaseNative(), driven by
        // OTRNPublisherManager.onDropViewInstance, is the backstop that guarantees
        // release (and stops the capturer) on every other path.
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
                Log.i(LIFECYCLE_TAG, "removeSubscriber() streamId=" + streamId
                        + " found=" + (subscriber != null) + " | " + sharedStateSummary());
                if (subscriber != null) {
                    mSession.unsubscribe(subscriber);
                    subscribers.remove(streamId);
                }
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
        ConcurrentHashMap<String, Session> mSessions = sharedState.getSessions();
        mSessions.remove(sessionId);
        // FIXME: not session-scoped. This module is the shared SessionListener for every
        // session, so disconnecting one session drops every session's connections and
        // breaks sendSignal() for the others. Scoping it needs a session -> connectionIds
        // index, since Connection exposes no owning session. Pre-existing; tracked
        // separately from the publisher-leak fix.
        sharedState.getConnections().clear();
        sharedState.getAndroidOnTopMap().remove(sessionId);
        sharedState.getAndroidZOrderMap().remove(sessionId);
        // Sweep publishers belonging to THIS session that were never released by their
        // own lifecycle path: on an involuntary disconnect a publisher's
        // onStreamDestroyed may never fire, leaving its entry in shared state.
        //
        // Scoped by session id because this listener serves every session — an unscoped
        // sweep would release other sessions' live publishers, silently breaking their
        // unpublish / RTC stats / transformer lookups.
        //
        // A publisher with a null session never published, so it is still owned by its
        // live view and is left for OTRNPublisher.releaseNative() to handle.
        for (Map.Entry<String, Publisher> entry : sharedState.getPublishers().entrySet()) {
            Session publisherSession = entry.getValue().getSession();
            if (publisherSession != null
                    && sessionId.equals(publisherSession.getSessionId())) {
                Utils.releasePublisher(entry.getKey(), "sessionDisconnected");
            }
        }
        // Anything still listed here after a disconnect was not released by its own
        // lifecycle path (unpublish / removeSubscriber / onStreamDropped).
        Log.i(LIFECYCLE_TAG, "onDisconnected() sessionId=" + sessionId
                + " | " + sharedStateSummary());
    }

    @Override
    public void onStreamReceived(Session session, Stream stream) {
        sharedState.getSubscriberStreams().put(stream.getStreamId(), stream);
        WritableMap payload = EventUtils.prepareJSStreamMap(stream, session);
        emitOnStreamCreated(payload);
    }

    @Override
    public void onStreamDropped(Session session, Stream stream) {
        WritableMap payload = EventUtils.prepareJSStreamMap(stream, session);
        emitOnStreamDestroyed(payload);
        sharedState.getSubscriberStreams().remove(stream.getStreamId());
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
        // hasCaptions is not part of the subscriber stream cache, so there is nothing to
        // push. Previously this triggered a cache refresh that re-read the SDK for no
        // reason, which was one of the paths into the otc_stream_copy crash.
    }

    @Override
    public void onStreamHasAudioChanged(Session session, Stream stream, boolean hasAudio) {
        WritableMap eventData = EventUtils.prepareStreamPropertyChangedEventData(
                "hasAudio", !hasAudio, hasAudio, stream, session);
        emitOnStreamPropertyChanged(eventData);
        // Push the value we were handed into the subscriber cache. The subscriber must
        // never re-read the SDK to discover it: see OTRNSubscriber.patchStreamCache.
        OTRNSubscriber.applyHasAudioChangeForStream(stream.getStreamId(), hasAudio);
    }

    @Override
    public void onStreamHasVideoChanged(Session session, Stream stream, boolean hasVideo) {
        WritableMap eventData = EventUtils.prepareStreamPropertyChangedEventData(
                "hasVideo", !hasVideo, hasVideo, stream, session);
        emitOnStreamPropertyChanged(eventData);
        OTRNSubscriber.applyHasVideoChangeForStream(stream.getStreamId(), hasVideo);
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
        OTRNSubscriber.applyVideoDimensionsChangeForStream(stream.getStreamId(), width, height);
    }

    @Override
    public void onStreamVideoTypeChanged(Session session, Stream stream, Stream.StreamVideoType streamVideoType) {
        ConcurrentHashMap<String, Stream> mSubscriberStreams = sharedState.getSubscriberStreams();
        String oldVideoType = stream.getStreamVideoType().toString();
        WritableMap eventData = EventUtils.prepareStreamPropertyChangedEventData(
                "videoType", oldVideoType, streamVideoType.toString(), stream, session);
        emitOnStreamPropertyChanged(eventData);
        // Normalise to the same "screen"/"camera" vocabulary buildCacheEntry uses, so the
        // cached value stays consistent with the one primed at subscribe time.
        String normalisedVideoType =
                streamVideoType == Stream.StreamVideoType.StreamVideoTypeScreen
                        ? "screen"
                        : "camera";
        OTRNSubscriber.applyVideoTypeChangeForStream(stream.getStreamId(), normalisedVideoType);
    }

    @Override
    public void onActivityCreated(@NonNull Activity activity, @Nullable Bundle bundle) {

    }

    @Override
    public void onActivityStarted(@NonNull Activity activity) {

    }

    @Override
    public void onActivityResumed(@NonNull Activity activity) {

    }

    @Override
    public void onActivityPaused(@NonNull Activity activity) {

    }

    @Override
    public void onActivityStopped(@NonNull Activity activity) {

    }

    @Override
    public void onActivitySaveInstanceState(@NonNull Activity activity, @NonNull Bundle bundle) {

    }

    @Override
    public void onActivityDestroyed(@NonNull Activity activity) {

    }
}
