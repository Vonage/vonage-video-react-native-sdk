package com.opentokreactnative

import android.content.Context
import android.opengl.GLSurfaceView;
import android.util.AttributeSet
import android.widget.FrameLayout;
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ReactStylesDiffMap
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

    // Cached stream metadata, refreshed only on state-changing events
    // (connect, video enabled/disabled). @Volatile + immutable data class gives
    // cross-thread visibility without lock overhead: any thread reading this field
    // always sees the latest fully-constructed cache reference.
    @Volatile private var streamCache: StreamCache? = null

    // Reads current state from the OpenTok SDK and stores it as an immutable cache entry.
    // Must only be called on events that actually change stream metadata, not per-frame.
    private fun refreshStreamCache(subscriber: SubscriberKit) {
        val stream = subscriber.stream ?: return
        val session = subscriber.session ?: return
        streamCache = StreamCache(
            streamId = stream.streamId,
            height = stream.videoHeight,
            width = stream.videoWidth,
            creationTime = stream.creationTime.toString(),
            connectionId = stream.connection.connectionId,
            sessionId = session.sessionId,
            connectionCreationTime = stream.connection.creationTime.toString(),
            connectionData = stream.connection.data,
            name = stream.name,
            hasAudio = stream.hasAudio(),
            hasVideo = stream.hasVideo(),
            videoType = if (stream.streamVideoType == Stream.StreamVideoType.StreamVideoTypeScreen) "screen" else "camera"
        )
    }

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

    // Fast path for frequent callbacks: serve from cache if available.
    // Slow path (rare): if cache is missing, fallback to direct SDK read once,
    // then seed cache to restore hot-path behavior.
    //
    // NOTE FOR DEBUGGING:
    // If stream payloads are unexpectedly empty in onVideoDataReceived/onAudioLevel,
    // verify whether this method is hitting the fallback path repeatedly.
    private fun buildStreamMapForFrequentEvent(subscriber: SubscriberKit?): WritableMap {
        val cache = streamCache
        if (cache != null) {
            return buildStreamMapFromCacheEntry(cache)
        }

        val fallback = EventUtils.prepareJSStreamMap(subscriber?.getStream(), subscriber?.getSession())
        if (subscriber != null) {
            refreshStreamCache(subscriber)
        }
        return fallback
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
        // Check subscriberStreams (remote streams)
        var stream = sharedState.getSubscriberStreams().get(streamId)
        if (stream != null) return stream
        
        // Check publisher streams (your own published streams)
        val publishers = sharedState.getPublishers()
        for (publisher in publishers.values) {
            if (publisher.stream?.streamId == streamId) {
                return publisher.stream
            }
        }
        return null
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

    // Triggered from session-level stream-property callbacks.
    // Refreshes only when this view is bound to the changed stream.
    private fun requestLocalCacheRefreshForStream(changedStreamId: String) {
        if (streamId != changedStreamId) return
        val activeSubscriber = subscriber ?: return
        refreshStreamCache(activeSubscriber)
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
        // Prime cache on connect so subsequent frequent callbacks stay on fast path.
        refreshStreamCache(subscriber)
        val payload =
            Arguments.createMap().apply {
                putMap("stream", buildStreamMapForFrequentEvent(subscriber))
            }
        emitOpenTokEvent("onSubscriberConnected", payload)
    }

    override fun onDisconnected(subscriber: SubscriberKit) {
        val stream = EventUtils.prepareJSStreamMap(subscriber.getStream(), subscriber.getSession())
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onSubscriberDisconnected", payload)
    }

    override fun onError(subscriber: SubscriberKit, opentokError: OpentokError) {
        val stream = EventUtils.prepareJSStreamMap(subscriber.getStream(), subscriber.getSession())
        val error = EventUtils.prepareJSErrorMap(opentokError)
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
                putMap("error", error)
            }
        emitOpenTokEvent("onSubscriberError", payload)
    }

    override fun onRtcStatsReport(subscriber: SubscriberKit, jsonArrayOfReports: String) {
        val stream = EventUtils.prepareJSStreamMap(subscriber.getStream(), subscriber.getSession())
        val payload =
            Arguments.createMap().apply {
                putString("jsonArrayOfReports", jsonArrayOfReports)
                putMap("stream", stream)
            }
        emitOpenTokEvent("onRtcStatsReport", payload)
    }

    override fun onAudioLevelUpdated(subscriber: SubscriberKit?, audioLevel: Float) {
        // High-frequency callback. Use cache to avoid repeated SDK lookups.
        val payload =
            Arguments.createMap().apply {
                putDouble("audioLevel", audioLevel.toDouble())
                putMap("stream", buildStreamMapForFrequentEvent(subscriber))
            }
        emitOpenTokEvent("onAudioLevel", payload)
    }

    override fun onCaptionText(subscriber: SubscriberKit?, text: String?, isFinal: Boolean) {
        val stream = EventUtils.prepareJSStreamMap(subscriber?.getStream(), subscriber?.getSession())
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
        // This callback fires when video data starts arriving, not continuously.
        // Use direct SDK lookup here; cache fast-path is unnecessary.
        val stream = EventUtils.prepareJSStreamMap(subscriber?.getStream(), subscriber?.getSession())
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onVideoDataReceived", payload)
    }

    override fun onVideoDisabled(subscriber: SubscriberKit?, reason: String?) {
        // Staleness policy: refresh on callbacks where we observe state deltas.
        // Keep this aligned with iOS behavior for easier cross-platform debugging.
        if (subscriber != null) refreshStreamCache(subscriber)
        val payload =
            Arguments.createMap().apply {
                putMap("stream", buildStreamMapForFrequentEvent(subscriber))
                putString("reason", reason)
            }
        emitOpenTokEvent("onVideoDisabled", payload)
    }

    override fun onVideoEnabled(subscriber: SubscriberKit?, reason: String?) {
        // Staleness policy: refresh on callbacks where we observe state deltas.
        // Keep this aligned with iOS behavior for easier cross-platform debugging.
        if (subscriber != null) refreshStreamCache(subscriber)
        val payload =
            Arguments.createMap().apply {
                putMap("stream", buildStreamMapForFrequentEvent(subscriber))
                putString("reason", reason)
            }
        emitOpenTokEvent("onVideoEnabled", payload)
    }

    override fun onVideoDisableWarning(subscriber: SubscriberKit?) {
        val stream = EventUtils.prepareJSStreamMap(subscriber?.getStream(), subscriber?.getSession())
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onVideoDisableWarning", payload)
    }

    override fun onVideoDisableWarningLifted(subscriber: SubscriberKit?) {
        val stream = EventUtils.prepareJSStreamMap(subscriber?.getStream(), subscriber?.getSession())
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onVideoDisableWarningLifted", payload)
    }

    override fun onReconnected(subscriber: SubscriberKit?) {
        // Refresh cache on reconnect: stream state (hasAudio/hasVideo) may have changed
        // during the reconnect window. Aligns with onConnected staleness policy.
        if (subscriber != null) refreshStreamCache(subscriber)
        val payload =
            Arguments.createMap().apply {
                putMap("stream", buildStreamMapForFrequentEvent(subscriber))
            }
        emitOpenTokEvent("onReconnected", payload)
    }

    // Immutable snapshot of stream metadata fields extracted from the OpenTok SDK.
    // Replacing the whole reference atomically (via @Volatile) avoids the need for locks.
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

        @JvmStatic
        fun requestCacheRefreshForStream(streamId: String) {
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

            // Refresh every currently live subscriber view bound to this stream.
            // If multiple updates arrive in parallel, the latest refresh wins.
            for (view in liveViews) {
                view.requestLocalCacheRefreshForStream(streamId)
            }
        }
    }
}