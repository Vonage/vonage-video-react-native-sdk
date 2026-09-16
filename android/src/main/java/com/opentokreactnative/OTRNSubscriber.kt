package com.opentokreactnative

import android.content.Context
import android.opengl.GLSurfaceView;
import android.util.AttributeSet
import android.widget.FrameLayout;
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.ReactStylesDiffMap
import com.facebook.react.uimanager.UIManagerHelper
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

    /**
     * Immutable snapshot of a native Stream's properties, mirroring exactly the shape
     * EventUtils.prepareJSStreamMap produces so the cached payload stays byte-for-byte
     * compatible with what JS consumers already receive.
     */
    private data class StreamCache(
        val streamId: String,
        val height: Int,
        val width: Int,
        val creationTime: String,           // stream.getCreationTime().toString()
        val connectionId: String,           // stream.getConnection().getConnectionId()
        val sessionId: String,              // session.getSessionId()
        val connectionCreationTime: String, // connection.getCreationTime().toString()
        val connectionData: String?,        // connection.getData()
        val name: String?,                  // stream.getName()
        val hasAudio: Boolean,
        val hasVideo: Boolean,
        val videoType: String               // normalized "screen" | "camera"
    )

    // Read-modify-write on a property patch derives a new snapshot via copy() from the current
    // one (see later tasks). AtomicReference.updateAndGet makes that compound RMW lock-free and
    // correct; a @Volatile field would only guarantee visibility of independent reads/writes and
    // could lose one of two overlapping patches. Hence AtomicReference over @Volatile.
    private val streamCache = AtomicReference<StreamCache?>(null)

    // Pure mapping from a live Stream into the immutable snapshot. Mirrors
    // EventUtils.prepareJSStreamMap field-for-field, including the screen/camera normalization.
    private fun buildCacheEntry(stream: Stream, sessionId: String): StreamCache {
        val connection = stream.getConnection()
        val videoType =
            if (stream.getStreamVideoType().equals(Stream.StreamVideoType.StreamVideoTypeScreen)) {
                "screen"
            } else {
                "camera"
            }
        return StreamCache(
            streamId = stream.getStreamId(),
            height = stream.getVideoHeight(),
            width = stream.getVideoWidth(),
            creationTime = stream.getCreationTime().toString(),
            connectionId = connection.getConnectionId(),
            sessionId = sessionId,
            connectionCreationTime = connection.getCreationTime().toString(),
            connectionData = connection.getData(),
            name = stream.getName(),
            hasAudio = stream.hasAudio(),
            hasVideo = stream.hasVideo(),
            videoType = videoType
        )
    }

    // Rebuilds the same nested WritableMap shape prepareJSStreamMap returns, so the JS-facing
    // payload is unchanged.
    private fun buildStreamMapFromCacheEntry(cache: StreamCache): WritableMap {
        val connectionInfo = Arguments.createMap().apply {
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
            putMap("connection", connectionInfo)
            putString("name", cache.name)
            putBoolean("hasAudio", cache.hasAudio)
            putBoolean("hasVideo", cache.hasVideo)
            putString("videoType", cache.videoType)
        }
    }

    // Payload for every callback: the current snapshot, or an empty map if never primed
    // (the same value prepareJSStreamMap returned for a null stream).
    private fun buildStreamMapFromCache(): WritableMap =
        streamCache.get()?.let { buildStreamMapFromCacheEntry(it) } ?: Arguments.createMap()

    // The ONLY place a Stream is read from the SDK. Returns early if the session has no id.
    private fun primeStreamCache(stream: Stream, session: Session) {
        val sid = session.sessionId ?: return
        streamCache.set(buildCacheEntry(stream, sid))
    }

    // Read-modify-write on the snapshot: derive a new snapshot via copy() from the current one.
    // No-op until primed (updateAndGet returns null unchanged when the current value is null).
    // No SDK read occurs while applying a patch.
    private fun patchStreamCache(update: (StreamCache) -> StreamCache) {
        streamCache.updateAndGet { it?.let(update) }
    }

    private fun applyHasAudioChange(v: Boolean) = patchStreamCache { it.copy(hasAudio = v) }

    private fun applyHasVideoChange(v: Boolean) = patchStreamCache { it.copy(hasVideo = v) }

    private fun applyVideoDimensionsChange(w: Int, h: Int) =
        patchStreamCache { it.copy(width = w, height = h) }

    private fun applyVideoTypeChange(t: String) = patchStreamCache { it.copy(videoType = t) }

    // Typed value carried from a session-scoped property callback (see the module). Carrying a
    // plain value rather than re-reading the SDK keeps the read-once invariant intact.
    private sealed class StreamPropertyChange {
        data class HasAudio(val hasAudio: Boolean) : StreamPropertyChange()
        data class HasVideo(val hasVideo: Boolean) : StreamPropertyChange()
        data class VideoDimensions(val width: Int, val height: Int) : StreamPropertyChange()
        data class VideoType(val videoType: String) : StreamPropertyChange()
    }

    // Applies a property change to this view's cache, but only when the change targets this
    // view's stream. Exhaustive over StreamPropertyChange; no SDK read happens here.
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
        // Route C (adapted for 2.33.4). Resolve remote streams from subscriberStreams: these are
        // owned copies the SDK handed to onStreamReceived, so they are safe to hold and read.
        val subscriberStream = sharedState.getSubscriberStreams().get(streamId)
        if (subscriberStream != null) return subscriberStream

        // Publisher-owned stream resolution (defense-in-depth). This path is only reached for
        // self-subscription to a LOCAL publisher whose lifetime is owned by this app -- not a
        // remote stream that can be freed by the native SDK under stream churn. The use-after-free
        // this fix targets reproduces on remote-stream callbacks, which the read-once cache
        // invariant already closes; iterating local publishers here cannot hit freed memory.
        //
        // The reference fix resolved this via sharedState.getPublisherStreams()[streamId], but
        // OTRN.java on 2.33.4 has no publisherStreams map, and this patch release intentionally
        // does not introduce one. We therefore keep matching against the existing publishers map.
        val publishers = sharedState.getPublishers()
        for (publisher in publishers.values) {
            if (publisher.stream?.streamId == streamId) {
                return publisher.stream
            }
        }

        // Neither path resolved the stream (R5.2).
        return null
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        
        val safeSessionId = sessionId
        val safeStreamId = streamId
        
        if (safeSessionId == null || safeStreamId == null) {
            return
        }
        
        session = sharedState.getSessions().get(safeSessionId)
        stream = findStream(safeStreamId)

        if (session != null && stream != null) {
            subscribeToStream(session!!, stream!!)
        }
    }

    override fun onDetachedFromWindow() {
        // Pair with onAttachedToWindow -> subscribeToStream: unregister this view from the
        // companion registry so it no longer receives dispatched property changes. Stale weak
        // refs are also pruned lazily in dispatch, so a missed unregister cannot leak.
        streamId?.let { unregister(it, this) }
        super.onDetachedFromWindow()
    }

    private fun configureComponent() {
        var params = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        this.setLayoutParams(params)
    }

    fun emitOpenTokEvent(name: String, payload: WritableMap) {
        val reactContext = context as ReactContext
        val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
        val eventDispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
        val event = OpenTokEvent(surfaceId, id, name, payload)

        eventDispatcher?.dispatchEvent(event)
    }

    public fun setSessionId(str: String?) {
        sessionId = str
    }

    public fun setSubscribeToAudio(value: Boolean) {
        subscriber?.subscribeToAudio = value
    }

    public fun setSubscribeToVideo(value: Boolean) {
        subscriber?.subscribeToVideo = value
    }

    public fun setStreamId(str: String?) {
        streamId = str
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

        // Read the SDK Stream exactly once, into the immutable cache, while it is known alive
        // (right before subscribe). Every later callback reads only from this snapshot.
        primeStreamCache(stream, session)
        // Register this view so session-scoped property callbacks (which live on the module) can
        // reach it via the companion registry, keyed by this view's streamId.
        streamId?.let { register(it, this) }

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
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onSubscriberConnected", payload)
    }

    override fun onDisconnected(subscriber: SubscriberKit) {
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onSubscriberDisconnected", payload)
    }

    override fun onError(subscriber: SubscriberKit, opentokError: OpentokError) {
        // No live SDK read for the stream payload; served from the primed snapshot.
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
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putString("jsonArrayOfReports", jsonArrayOfReports)
                putMap("stream", stream)
            }
        emitOpenTokEvent("onRtcStatsReport", payload)
    }

    override fun onAudioLevelUpdated(subscriber: SubscriberKit?, audioLevel: Float) {
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putDouble("audioLevel", audioLevel.toDouble())
                putMap("stream", stream)
            }
        emitOpenTokEvent("onAudioLevel", payload)
    }

    override fun onCaptionText(subscriber: SubscriberKit?, text: String?, isFinal: Boolean) {
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
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
        val audioStats: WritableMap = Arguments.createMap()
        audioStats.putDouble("audioPacketsLost", stats?.audioPacketsLost?.toDouble() ?: 0.0)
        audioStats.putDouble("audioPacketsReceived", stats?.audioPacketsReceived?.toDouble() ?: 0.0)
        audioStats.putDouble("audioBytesReceived", stats?.audioBytesReceived?.toDouble() ?: 0.0)
        audioStats.putDouble("startTime", stats?.timeStamp?.toDouble() ?: 0.0)
        emitOpenTokEvent("onAudioNetworkStats", audioStats)
    }

    override fun onVideoStats(
        subscriber: SubscriberKit?,
        stats: SubscriberKit.SubscriberVideoStats?
    ) {
        val videoStats: WritableMap = EventUtils.prepareSubscriberVideoNetworkStats(stats)
        
        emitOpenTokEvent("onVideoNetworkStats", videoStats)
    }

    override fun onVideoDataReceived(subscriber: SubscriberKit?) {
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onVideoDataReceived", payload)
    }

    override fun onVideoDisabled(subscriber: SubscriberKit?, reason: String?) {
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
                putString("reason", reason)
            }
        emitOpenTokEvent("onVideoDisabled", payload)
    }

    override fun onVideoEnabled(subscriber: SubscriberKit?, reason: String?) {
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
                putString("reason", reason)
            }
        emitOpenTokEvent("onVideoEnabled", payload)
    }

    override fun onVideoDisableWarning(subscriber: SubscriberKit?) {
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onVideoDisableWarning", payload)
    }

    override fun onVideoDisableWarningLifted(subscriber: SubscriberKit?) {
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onVideoDisableWarningLifted", payload)
    }

    override fun onReconnected(subscriber: SubscriberKit?) {
        // No live SDK read; served from the primed snapshot to avoid a use-after-free.
        val stream = buildStreamMapFromCache()
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onReconnected", payload)
    }

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
        // Registry mapping a streamId to the live view instances subscribed to that stream.
        // Session-scoped property callbacks live on the module (not on any view), so this
        // registry is how they reach the correct view(s). WeakReference prevents the registry
        // from retaining detached views; ConcurrentHashMap + CopyOnWriteArrayList make it safe
        // under concurrent dispatch on the mqt_v_native thread.
        private val refreshListenersByStreamId =
            ConcurrentHashMap<String, CopyOnWriteArrayList<WeakReference<OTRNSubscriber>>>()

        // Adds a weak reference to the view under its streamId. computeIfAbsent atomically
        // creates the per-stream list on first registration (safe under concurrency).
        // NOTE: not yet called anywhere; Task 4 wires this into subscribeToStream.
        fun register(streamId: String, view: OTRNSubscriber) {
            val list = refreshListenersByStreamId.computeIfAbsent(streamId) {
                CopyOnWriteArrayList<WeakReference<OTRNSubscriber>>()
            }
            list.add(WeakReference(view))
        }

        // Removes the view's weak reference (matched by referent identity), prunes stale/GC'd
        // refs, and drops the streamId key once the list is empty. The two-arg remove(key, value)
        // only removes the key if it still maps to this exact list, avoiding races with a
        // concurrent register that may have re-created the list.
        // NOTE: not yet called anywhere; Task 4 wires this into onDetachedFromWindow.
        fun unregister(streamId: String, view: OTRNSubscriber) {
            val list = refreshListenersByStreamId[streamId] ?: return
            val dead = ArrayList<WeakReference<OTRNSubscriber>>()
            for (ref in list) {
                val referent = ref.get()
                if (referent == null || referent === view) {
                    dead.add(ref)
                }
            }
            list.removeAll(dead)
            if (list.isEmpty()) {
                refreshListenersByStreamId.remove(streamId, list)
            }
        }

        // Typed entry points invoked from OpentokReactNativeModule.java when a session-scoped
        // property callback fires. Each carries a plain value (no SDK read) into dispatch.
        @JvmStatic
        fun applyHasAudioChangeForStream(streamId: String, hasAudio: Boolean) =
            dispatch(streamId, StreamPropertyChange.HasAudio(hasAudio))

        @JvmStatic
        fun applyHasVideoChangeForStream(streamId: String, hasVideo: Boolean) =
            dispatch(streamId, StreamPropertyChange.HasVideo(hasVideo))

        @JvmStatic
        fun applyVideoDimensionsChangeForStream(streamId: String, width: Int, height: Int) =
            dispatch(streamId, StreamPropertyChange.VideoDimensions(width, height))

        @JvmStatic
        fun applyVideoTypeChangeForStream(streamId: String, videoType: String) =
            dispatch(streamId, StreamPropertyChange.VideoType(videoType))

        // Fans a typed change out to every live view registered for the streamId. Stale refs are
        // pruned lazily here (so a missed unregister cannot leak), and the key is dropped once no
        // views remain. Patches carry plain values, preserving the read-once invariant.
        private fun dispatch(streamId: String, change: StreamPropertyChange) {
            val list = refreshListenersByStreamId[streamId] ?: return
            val stale = ArrayList<WeakReference<OTRNSubscriber>>()
            val live = ArrayList<OTRNSubscriber>()
            for (ref in list) {
                val referent = ref.get()
                if (referent == null) {
                    stale.add(ref)
                } else {
                    live.add(referent)
                }
            }
            list.removeAll(stale)
            if (list.isEmpty()) {
                refreshListenersByStreamId.remove(streamId, list)
            }
            for (view in live) {
                view.applyStreamPropertyChange(streamId, change)
            }
        }
    }
}