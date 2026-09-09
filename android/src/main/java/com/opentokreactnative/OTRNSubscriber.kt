package com.opentokreactnative

import android.content.Context
import android.opengl.GLSurfaceView;
import android.util.AttributeSet
import android.widget.FrameLayout;
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ReactStylesDiffMap
import org.json.JSONObject
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType
import com.facebook.react.uimanager.events.Event
import com.opentok.android.BaseVideoRenderer
import com.opentok.android.OpentokError
import com.opentok.android.Session
import com.opentok.android.Stream
import com.opentok.android.Subscriber
import com.opentok.android.SubscriberKit
import com.opentok.android.SubscriberKit.SubscriberListener
import com.opentok.android.SubscriberKit.SubscriberRtcStatsReportListener
import com.opentok.android.VideoUtils
import com.opentokreactnative.utils.Utils;
import com.opentokreactnative.utils.EventUtils;
import com.opentokreactnative.utils.toVideoScaleType;
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.collections.component1
import kotlin.collections.component2
import kotlin.collections.iterator

class OTRNSubscriber : FrameLayout, SubscriberListener,
    SubscriberRtcStatsReportListener, SubscriberKit.AudioLevelListener,
    SubscriberKit.CaptionsListener,
    SubscriberKit.AudioStatsListener,
    SubscriberKit.VideoStatsListener,
    SubscriberKit.VideoListener,
    SubscriberKit.StreamListener {
    private var session: Session? = null
    private var stream: Stream? = null
    private var sessionId: String? = ""
    private var streamId: String? = ""
    private var subscriber: Subscriber? = null
    private var sharedState = OTRN.getSharedState();
    private var TAG = this.javaClass.simpleName
    private var androidOnTopMap = sharedState.getAndroidOnTopMap();
    private var androidZOrderMap = sharedState.getAndroidZOrderMap();
    private var props: MutableMap<String, Any>? = null

// Native emission gates for high-frequency events. Driven from JS by whether
// the corresponding eventHandler exists. When false, the callback returns
// before building any payload, so nothing is serialized or crosses the bridge.
// No throttling: when a handler is attached, every native event is forwarded.
@Volatile private var emitAudioLevel: Boolean = false
@Volatile private var emitAudioNetworkStats: Boolean = false
@Volatile private var emitVideoNetworkStats: Boolean = false

    // Cached stream metadata. Written in exactly two ways, NEVER by reading the SDK
    // from an event callback:
    //   PRIME  - once at subscribe time, from the Stream we were handed while it is
    //            known alive (primeStreamCache).
    //   PATCH  - when a session property callback delivers a new value (applyXChange).
    // AtomicReference (not @Volatile) because a patch is a read-modify-write over the
    // current snapshot: @Volatile would publish safely but could still drop one of two
    // overlapping updates. updateAndGet keeps it lock-free and correct.
    private val streamCache = AtomicReference<StreamCache?>(null)

    // Pure mapping from a live Stream into an immutable cache entry. The caller is
    // responsible for only calling this while the Stream is known alive (subscribe time).
    private fun buildCacheEntry(stream: Stream, sessionId: String): StreamCache {
        return StreamCache(
            streamId = stream.streamId,
            height = stream.videoHeight,
            width = stream.videoWidth,
            creationTime = EventUtils.formatIso8601(stream.creationTime),
            connectionId = stream.connection.connectionId,
            sessionId = sessionId,
            connectionCreationTime = EventUtils.formatIso8601(stream.connection.creationTime),
            connectionData = stream.connection.data,
            name = stream.name,
            hasAudio = stream.hasAudio(),
            hasVideo = stream.hasVideo(),
            videoType = if (stream.streamVideoType == Stream.StreamVideoType.StreamVideoTypeScreen) "screen" else "camera"
        )
    }

    // Primes the cache from a Stream obtained while it is known alive (subscribe time).
    // This is the ONLY place a Stream is read from the SDK. Every later change arrives as
    // a plain value through applyXChange below, so no callback needs to touch the SDK.
    private fun primeStreamCache(stream: Stream, session: Session) {
        val sid = session.sessionId ?: return
        streamCache.set(buildCacheEntry(stream, sid))
    }

    // Applies a single field change to the cached snapshot. See applyStreamPropertyChange
    // for why this is push (values handed to us by the callback) rather than a live read.
    // No-op until the cache has been primed.
    private fun patchStreamCache(update: (StreamCache) -> StreamCache) {
        streamCache.updateAndGet { current: StreamCache? -> current?.let(update) }
    }

    private fun applyHasAudioChange(hasAudio: Boolean) =
        patchStreamCache { it.copy(hasAudio = hasAudio) }

    private fun applyHasVideoChange(hasVideo: Boolean) =
        patchStreamCache { it.copy(hasVideo = hasVideo) }

    private fun applyVideoDimensionsChange(width: Int, height: Int) =
        patchStreamCache { it.copy(width = width, height = height) }

    private fun applyVideoTypeChange(videoType: String) =
        patchStreamCache { it.copy(videoType = videoType) }

    // Converts an immutable cache entry into the event stream map shape.
    private fun buildStreamMapFromCacheEntry(cache: StreamCache): WritableMap {
        val connection = Arguments.createMap().apply {
            putString("connectionId", cache.connectionId)
            putString("creationTime", cache.connectionCreationTime)
            putString("data", cache.connectionData)
        }
        return Arguments.createMap().apply {
            putString("streamId", cache.streamId)
            putInt("height", cache.height)
            putInt("width", cache.width)
            putString("creationTime", cache.creationTime)
            putString("connectionId", cache.connectionId)
            putString("sessionId", cache.sessionId)
            putMap("connection", connection)
            putString("name", cache.name)
            putBoolean("hasAudio", cache.hasAudio)
            putBoolean("hasVideo", cache.hasVideo)
            putString("videoType", cache.videoType)
        }
    }

    // Builds the event `stream` payload purely from the cached snapshot.
    // Deliberately takes NO SubscriberKit and performs NO live SDK read: a callback may be
    // delivered after the native stream/connection have been freed, and
    // SubscriberKit.getStream() deep-copies that native memory (SIGSEGV in
    // otc_stream_copy / otc_connection_copy). Do not add a live fallback here.
    // Returns an empty map if the cache was never primed, which matches the value
    // EventUtils.prepareJSStreamMap already returns for a null stream.
    private fun buildStreamMapFromCache(): WritableMap {
        val cache = streamCache.get() ?: return Arguments.createMap()
        return buildStreamMapFromCacheEntry(cache)
    }

    constructor(context: Context) : super(context) {
        configureComponent()
    }

    constructor(context: Context, attrs: AttributeSet?) : super(context, attrs) {
        configureComponent()
    }

    constructor(context: Context, attrs: AttributeSet?, defStyleAttr: Int) : super(
        context,
        attrs,
        defStyleAttr
    ) {
        configureComponent()
    }

    fun updateProperties(props: ReactStylesDiffMap?) {
        if (this.props == null) {
            this.props = props?.toMap()
            ?.filterValues { it != null }
            ?.mapValues { it.value!! }
            ?.toMutableMap()
        }
    }

    private fun findStream(streamId: String): Stream? {
        // Remote streams, recorded by the session's onStreamReceived.
        sharedState.getSubscriberStreams()[streamId]?.let { return it }

        // Own published streams, recorded by OTRNPublisher.onStreamCreated.
        // Resolved from publisherStreams rather than iterating publishers and calling
        // publisher.stream: PublisherKit.getStream() is a live SDK read that copies native
        // memory, so looping meant several such reads per attach, any of which could touch
        // a stream the SDK had already torn down. The Stream objects in this map are the
        // ones the SDK handed to onStreamCreated, which are owned copies and safe to hold.
        return sharedState.getPublisherStreams()[streamId]
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        
        val safeSessionId = sessionId
        val safeStreamId = streamId
        
        if (safeSessionId == null || safeStreamId == null) {
            return
        }

        // Re-register on attach in case this view was detached/recycled.
        registerRefreshListener(safeStreamId, this)
        
        session = sharedState.getSessions().get(safeSessionId)
        stream = findStream(safeStreamId)

        if (session != null && stream != null) {
            subscribeToStream(session!!, stream!!)
        }
    }

    override fun onDetachedFromWindow() {
        // Remove registration to avoid stale references after detach/recycle.
        streamId?.let { unregisterRefreshListener(it, this) }
        super.onDetachedFromWindow()
    }

    private fun configureComponent() {
        var params = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        this.setLayoutParams(params)
    }

    fun emitOpenTokEvent(name: String, payload: WritableMap) {
        val reactContext = context as ThemedReactContext
        val eventDispatcher = UIManagerHelper.getUIManager(reactContext, UIManagerType.FABRIC)?.eventDispatcher
        val event = OpenTokEvent(reactContext.surfaceId, id, name, payload)
        eventDispatcher?.dispatchEvent(event)
    }

    public fun setSessionId(str: String?) {
        sessionId = str
    }

public fun setEmitAudioLevel(value: Boolean) {
    emitAudioLevel = value
}

public fun setEmitAudioNetworkStats(value: Boolean) {
    emitAudioNetworkStats = value
}

public fun setEmitVideoNetworkStats(value: Boolean) {
    emitVideoNetworkStats = value
}

    public fun setSubscribeToAudio(value: Boolean) {
        subscriber?.subscribeToAudio = value
    }

    public fun setSubscribeToVideo(value: Boolean) {
        subscriber?.subscribeToVideo = value
    }

    public fun setStreamId(str: String?) {
        val previousStreamId = streamId
        if (previousStreamId != null && previousStreamId != str) {
            unregisterRefreshListener(previousStreamId, this)
        }
        streamId = str
        if (str != null) {
            registerRefreshListener(str, this)
        }
    }

    // Applies a session-level property change to this view's cache, if this view is bound
    // to the changed stream. Takes the already-resolved value: no SubscriberKit is touched
    // and no Stream is read, so this is safe at any point in the stream's lifecycle,
    // including after the native stream has been freed.
    private fun applyStreamPropertyChange(changedStreamId: String, change: StreamPropertyChange) {
        if (streamId != changedStreamId) return
        when (change) {
            is StreamPropertyChange.HasAudio -> applyHasAudioChange(change.hasAudio)
            is StreamPropertyChange.HasVideo -> applyHasVideoChange(change.hasVideo)
            is StreamPropertyChange.VideoDimensions ->
                applyVideoDimensionsChange(change.width, change.height)
            is StreamPropertyChange.VideoType -> applyVideoTypeChange(change.videoType)
        }
    }

    fun setSubscribeToCaptions(value: Boolean) {
        subscriber?.subscribeToCaptions = value
    }

    fun setAudioVolume(value: Float) {
        subscriber?.audioVolume = value.toDouble()
    }

    fun setPreferredFrameRate(value: Int) {
        subscriber?.preferredFrameRate = value.toFloat()
    }

    fun setPreferredResolution(value: String?) {
        var values: List<String> = value?.split("x") ?: return
        var width: Int = values[0].toInt()
        var height: Int = values[1].toInt()
        subscriber?.setPreferredResolution(VideoUtils.Size(width, height))
    }

    fun subscribeToStream(session: Session, stream: Stream) {
        var pubOrSub: String? = ""
        var zOrder: String? = ""
        subscriber = Subscriber.Builder(context, stream)
            .build()
        sharedState.getSubscribers().put(stream.getStreamId(), subscriber ?: return);
        subscriber?.setStyle(
            BaseVideoRenderer.STYLE_VIDEO_SCALE,
            (this.props?.get("scaleBehavior") as String).toVideoScaleType()
        )

        if (androidOnTopMap.get(sessionId) != null) {
            pubOrSub = androidOnTopMap.get(sessionId);
        }
        if (androidZOrderMap.get(sessionId) != null) {
            zOrder = androidZOrderMap.get(sessionId);
        }

        if (pubOrSub.equals("subscriber") && subscriber?.getView() is GLSurfaceView) {
            if (zOrder.equals("mediaOverlay")) {
                (subscriber?.getView() as GLSurfaceView).setZOrderMediaOverlay(true)
            } else {
                (subscriber?.getView() as GLSurfaceView).setZOrderOnTop(true)
            }
        }

        subscriber?.setSubscriberListener(this)
        subscriber?.setRtcStatsReportListener(this)
        subscriber?.setCaptionsListener(this)
        subscriber?.setAudioStatsListener(this)
        subscriber?.setVideoStatsListener(this)
        subscriber?.setVideoListener(this)
        subscriber?.setStreamListener(this)
        subscriber?.setAudioLevelListener(this)

        if (this.props?.get("subscribeToAudio") != null) {
            subscriber?.setSubscribeToAudio(this.props?.get("subscribeToAudio") as Boolean)
        }
        if (this.props?.get("subscribeToVideo") != null) {
            subscriber?.setSubscribeToVideo(this.props?.get("subscribeToVideo") as Boolean)
        }
        if (this.props?.get("subscribeToCaptions") != null) {
            subscriber?.setSubscribeToCaptions(this.props?.get("subscribeToCaptions") as Boolean)
        }
        if (this.props?.get("audioVolume") != null) {
            subscriber?.setAudioVolume(this.props?.get("audioVolume") as Double)
        }
        if (this.props?.get("preferredFrameRate") != null) {
            subscriber?.setPreferredFrameRate((this.props?.get("preferredFrameRate") as Double).toFloat())
        }
        if (this.props?.get("preferredResolution") != null) {
            var res : String = this.props?.get("preferredResolution") as String
            var values: List<String> = res.split("x")
            var width: Int = values[0].toInt()
            var height: Int = values[1].toInt()
            subscriber?.setPreferredResolution(VideoUtils.Size(width, height))
        }

        this.props?.clear()

        // Prime the metadata cache once, here, from the live Stream we were handed while
        // it is known alive. This is the only SDK Stream read; every event callback after
        // this reads only from the cache (buildStreamMapFromCache), never the SDK.
        primeStreamCache(stream, session)

        session.subscribe(subscriber)
        if (subscriber?.view != null) {
            this.addView(subscriber?.view)
            requestLayout()
        }
    }

    public fun setScaleBehavior(value: String?) {
        subscriber?.setStyle(
            BaseVideoRenderer.STYLE_VIDEO_SCALE,
            value.toVideoScaleType()
        )
    }

    override fun onConnected(subscriber: SubscriberKit) {
        // No SDK read: the cache was primed in subscribeToStream immediately before
        // session.subscribe(). Later changes arrive via applyStreamPropertyChange.
        val payload =
            Arguments.createMap().apply {
                putMap("stream", buildStreamMapFromCache())
            }
        emitOpenTokEvent("onSubscriberConnected", payload)
    }

    override fun onDisconnected(subscriber: SubscriberKit) {
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onSubscriberDisconnected", payload)
    }

    override fun onError(subscriber: SubscriberKit, opentokError: OpentokError) {
        val stream = buildStreamMapFromCache()
        val error = EventUtils.prepareJSErrorMap(opentokError)
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
                putMap("error", error)
            }
        emitOpenTokEvent("onSubscriberError", payload)
    }

    override fun onRtcStatsReport(subscriber: SubscriberKit, jsonArrayOfReports: String) {
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putString("jsonArrayOfReports", jsonArrayOfReports) // deprecated: use jsonStats
                putString("jsonStats", jsonArrayOfReports) // matches iOS key and TS spec
                putMap("stream", stream)
            }
        emitOpenTokEvent("onRtcStatsReport", payload)
    }

    override fun onAudioLevelUpdated(subscriber: SubscriberKit?, audioLevel: Float) {
        // Suppressed at emission when no JS handler is attached.
        if (!emitAudioLevel) return

        // High-frequency callback. Serve the stream map from cache, never the SDK.
        val payload =
            Arguments.createMap().apply {
                putDouble("audioLevel", audioLevel.toDouble())
                putMap("stream", buildStreamMapFromCache())
            }
        emitOpenTokEvent("onAudioLevel", payload)
    }

    override fun onCaptionText(subscriber: SubscriberKit?, text: String?, isFinal: Boolean) {
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putString("text", text)
                putBoolean("isFinal", isFinal)
                putMap("stream", stream)
            }
        emitOpenTokEvent("onCaptionReceived", payload)
    }

    override fun onAudioStats(
        subscriber: SubscriberKit?,
        stats: SubscriberKit.SubscriberAudioStats?
    ) {
        // Suppressed at emission when no JS handler is attached.
        if (!emitAudioNetworkStats) return

        val audioPacketsLost = stats?.audioPacketsLost?.toDouble() ?: 0.0
        val audioPacketsReceived = stats?.audioPacketsReceived?.toDouble() ?: 0.0
        val audioBytesReceived = stats?.audioBytesReceived?.toDouble() ?: 0.0
        val timeStamp = stats?.timeStamp?.toDouble() ?: 0.0

        // Serialize stats to JSON string to match iOS Fabric event pattern.
        // iOS sends { stream, jsonStats } where jsonStats is a JSON string.
        val jsonStats = JSONObject().apply {
            put("audioPacketsLost", audioPacketsLost)
            put("audioPacketsReceived", audioPacketsReceived)
            put("audioBytesReceived", audioBytesReceived)
            put("startTime", timeStamp)   // kept for backward compatibility
            put("timestamp", timeStamp)   // matches iOS field name
        }.toString()

        val stream = buildStreamMapFromCache()
        val payload = Arguments.createMap().apply {
            putString("jsonStats", jsonStats)     // matches iOS key, consumed by JS deserializer
            putMap("stream", stream)              // matches iOS structure
            // Backward compat: keep flat fields for existing Android consumers
            putDouble("audioPacketsLost", audioPacketsLost)
            putDouble("audioPacketsReceived", audioPacketsReceived)
            putDouble("audioBytesReceived", audioBytesReceived)
            putDouble("startTime", timeStamp)     // deprecated: use timestamp
            putDouble("timestamp", timeStamp)
        }
        emitOpenTokEvent("onAudioNetworkStats", payload)
    }

    override fun onVideoStats(
        subscriber: SubscriberKit?,
        stats: SubscriberKit.SubscriberVideoStats?
    ) {
        // Suppressed at emission when no JS handler is attached.
        if (!emitVideoNetworkStats) return

        val videoPacketsLost = stats?.videoPacketsLost ?: 0
        val videoBytesReceived = stats?.videoBytesReceived ?: 0
        val videoPacketsReceived = stats?.videoPacketsReceived ?: 0
        val timeStamp = stats?.timeStamp ?: 0.0

        // Serialize stats to JSON string to match iOS Fabric event pattern.
        // iOS sends { stream, jsonStats } where jsonStats is a JSON string.
        val statsJson = JSONObject().apply {
            put("videoPacketsLost", videoPacketsLost)
            put("videoBytesReceived", videoBytesReceived)
            put("videoPacketsReceived", videoPacketsReceived)
            put("timestamp", timeStamp)
            stats?.senderStats?.let { sender ->
                put("senderStats", JSONObject().apply {
                    put("connectionMaxAllocatedBitrate", sender.connectionMaxAllocatedBitrate)
                    put("connectionEstimatedBandwidth", sender.connectionEstimatedBandwidth)
                })
            }
        }

        val stream = buildStreamMapFromCache()
        val payload = Arguments.createMap().apply {
            putString("jsonStats", statsJson.toString()) // matches iOS key, consumed by JS deserializer
            putMap("stream", stream)                     // matches iOS structure
            // Backward compat: keep flat fields so existing Android consumers still work
            putInt("videoPacketsLost", videoPacketsLost)
            putInt("videoBytesReceived", videoBytesReceived)
            putInt("videoPacketsReceived", videoPacketsReceived)
            putDouble("timestamp", timeStamp)
            stats?.senderStats?.let { sender ->
                putMap("senderStats", Arguments.createMap().apply {
                    putDouble("connectionMaxAllocatedBitrate", sender.connectionMaxAllocatedBitrate.toDouble())
                    putDouble("connectionEstimatedBandwidth", sender.connectionEstimatedBandwidth.toDouble())
                })
            }
        }
        emitOpenTokEvent("onVideoNetworkStats", payload)
    }

    override fun onVideoDataReceived(subscriber: SubscriberKit?) {
        // Fires when video data starts arriving. Serve from cache, never the SDK.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onVideoDataReceived", payload)
    }

    override fun onVideoDisabled(subscriber: SubscriberKit?, reason: String?) {
        // No cache read. This reports subscriber-side video suspension (e.g.
        // VIDEO_REASON_QUALITY), not stream.hasVideo (the publisher may still be sending).
        // hasVideo is updated only from onStreamHasVideoChanged, which carries the real value.
        // This is also where the SIGSEGV in otc_stream_copy used to originate.
        val payload =
            Arguments.createMap().apply {
                putMap("stream", buildStreamMapFromCache())
                putString("reason", reason)
            }
        emitOpenTokEvent("onVideoDisabled", payload)
    }

    override fun onVideoEnabled(subscriber: SubscriberKit?, reason: String?) {
        // See onVideoDisabled: subscriber-side video state, not stream.hasVideo. No SDK read.
        val payload =
            Arguments.createMap().apply {
                putMap("stream", buildStreamMapFromCache())
                putString("reason", reason)
            }
        emitOpenTokEvent("onVideoEnabled", payload)
    }

    override fun onVideoDisableWarning(subscriber: SubscriberKit?) {
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onVideoDisableWarning", payload)
    }

    override fun onVideoDisableWarningLifted(subscriber: SubscriberKit?) {
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onVideoDisableWarningLifted", payload)
    }

    override fun onReconnected(subscriber: SubscriberKit?) {
        // No SDK read. Reconnect is one of the highest-risk moments for a live read since
        // the native stream may have been torn down and rebuilt; changes during the window
        // arrive via onStreamHasVideoChanged and friends (the safe channel).
        val payload =
            Arguments.createMap().apply {
                putMap("stream", buildStreamMapFromCache())
            }
        emitOpenTokEvent("onReconnected", payload)
    }

    // A stream property change carrying its already-resolved new value. Mirrors
    // Session.StreamPropertiesListener one-for-one: those four callbacks are the complete
    // set of ways a stream's metadata can change, which is why a push-fed cache needs no
    // fallback to reading the SDK.
    private sealed class StreamPropertyChange {
        data class HasAudio(val hasAudio: Boolean) : StreamPropertyChange()
        data class HasVideo(val hasVideo: Boolean) : StreamPropertyChange()
        data class VideoDimensions(val width: Int, val height: Int) : StreamPropertyChange()
        data class VideoType(val videoType: String) : StreamPropertyChange()
    }

    // Immutable snapshot of stream metadata. Held in an AtomicReference and replaced
    // wholesale on every prime/patch, so readers never see a half-updated entry.
    private data class StreamCache(
        val streamId: String,
        val height: Int,
        val width: Int,
        val creationTime: String,
        val connectionId: String,
        val sessionId: String,
        val connectionCreationTime: String,
        val connectionData: String?,
        val name: String?,
        val hasAudio: Boolean,
        val hasVideo: Boolean,
        val videoType: String
    )

    inner class OpenTokEvent(
        surfaceId: Int,
        viewId: Int,
        private val name: String,
        private val payload: WritableMap
    ) : Event<OpenTokEvent>(surfaceId, viewId) {
        override fun getEventName() = name
        override fun getEventData() = payload
    }

    companion object {
        // streamId -> list of weak refs to subscriber views that should refresh cache
        // when session-level stream-property changes are observed.
        private val refreshListenersByStreamId = ConcurrentHashMap<String, CopyOnWriteArrayList<WeakReference<OTRNSubscriber>>>()

        private fun registerRefreshListener(streamId: String, view: OTRNSubscriber) {
            val listeners = refreshListenersByStreamId.getOrPut(streamId) { CopyOnWriteArrayList() }
            val staleRefs = ArrayList<WeakReference<OTRNSubscriber>>()
            var alreadyRegistered = false
            for (ref in listeners) {
                val existing = ref.get()
                if (existing == null) {
                    staleRefs.add(ref)
                } else if (existing === view) {
                    alreadyRegistered = true
                }
            }
            if (staleRefs.isNotEmpty()) {
                listeners.removeAll(staleRefs.toSet())
            }
            if (!alreadyRegistered) {
                listeners.add(WeakReference(view))
            }
        }

        private fun unregisterRefreshListener(streamId: String, view: OTRNSubscriber) {
            val listeners = refreshListenersByStreamId[streamId] ?: return
            val toRemove = ArrayList<WeakReference<OTRNSubscriber>>()
            for (ref in listeners) {
                val existing = ref.get()
                if (existing == null || existing === view) {
                    toRemove.add(ref)
                }
            }
            if (toRemove.isNotEmpty()) {
                listeners.removeAll(toRemove.toSet())
            }
            if (listeners.isEmpty()) {
                refreshListenersByStreamId.remove(streamId, listeners)
            }
        }

        // Entry points for the session-level property callbacks in
        // OpentokReactNativeModule. Each carries the new value the SDK handed us, so no
        // subscriber view ever reads the SDK back. These replaced a single
        // requestCacheRefreshForStream(streamId) that told views to re-read themselves via
        // SubscriberKit.getStream(), which is what produced the SIGSEGV in otc_stream_copy.
        @JvmStatic
        fun applyHasAudioChangeForStream(streamId: String, hasAudio: Boolean) =
            dispatchStreamPropertyChange(streamId, StreamPropertyChange.HasAudio(hasAudio))

        @JvmStatic
        fun applyHasVideoChangeForStream(streamId: String, hasVideo: Boolean) =
            dispatchStreamPropertyChange(streamId, StreamPropertyChange.HasVideo(hasVideo))

        @JvmStatic
        fun applyVideoDimensionsChangeForStream(streamId: String, width: Int, height: Int) =
            dispatchStreamPropertyChange(
                streamId,
                StreamPropertyChange.VideoDimensions(width, height)
            )

        @JvmStatic
        fun applyVideoTypeChangeForStream(streamId: String, videoType: String) =
            dispatchStreamPropertyChange(streamId, StreamPropertyChange.VideoType(videoType))

        private fun dispatchStreamPropertyChange(streamId: String, change: StreamPropertyChange) {
            val listeners = refreshListenersByStreamId[streamId] ?: return
            val staleRefs = ArrayList<WeakReference<OTRNSubscriber>>()
            val liveViews = ArrayList<OTRNSubscriber>()

            for (ref in listeners) {
                val view = ref.get()
                if (view == null) {
                    staleRefs.add(ref)
                } else {
                    liveViews.add(view)
                }
            }

            if (staleRefs.isNotEmpty()) {
                listeners.removeAll(staleRefs.toSet())
            }
            if (listeners.isEmpty()) {
                refreshListenersByStreamId.remove(streamId, listeners)
            }

            // Apply to every currently live subscriber view bound to this stream.
            for (view in liveViews) {
                view.applyStreamPropertyChange(streamId, change)
            }
        }
    }
}