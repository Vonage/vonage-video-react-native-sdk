package com.opentokreactnative

import android.content.Context
import android.opengl.GLSurfaceView;
import android.util.AttributeSet
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout;
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
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
import java.util.Collections
import java.util.WeakHashMap
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

    // Stream id the current subscriber was registered under in sharedState.subscribers.
    private var subscribedStreamId: String? = null

    // Set when sessionId/streamId changes on a live view; the new subscription is created
    // in updateProperties(), after Fabric has applied the whole prop batch.
    private var pendingResubscribe = false

    // The current subscriber, unless it was already released (stream dropped, unsubscribed).
    // Prop setters use this so they never call into a released SDK subscriber.
    private val liveSubscriber: Subscriber?
        get() = subscriber?.takeUnless { isReleased(it) }

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
        // Keep the latest value of every prop (not only the initial batch), so a
        // re-subscribe after a sessionId/streamId change uses current values.
        val latest = props?.toMap()
            ?.filterValues { it != null }
            ?.mapValues { it.value!! }
            ?: emptyMap()
        val current = this.props ?: mutableMapOf<String, Any>().also { this.props = it }
        current.putAll(latest)

        if (pendingResubscribe) {
            pendingResubscribe = false
            if (isAttachedToWindow) {
                subscribeIfPossible()
            }
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
        // A detach/re-attach without unmount (clipped subviews in lists, screens kept
        // alive by navigators, re-parenting) must not create another Subscriber. The
        // existing SDK view is still our child and re-attaches with us. If the
        // subscriber was released because its stream dropped, we also must not
        // subscribe again: the reference is kept until teardown() for that reason.
        if (subscriber != null) {
            return
        }
        subscribeIfPossible()
    }

    private fun subscribeIfPossible() {
        val safeSessionId = sessionId
        val safeStreamId = streamId
        if (safeSessionId.isNullOrEmpty() || safeStreamId.isNullOrEmpty()) {
            return
        }
        val foundSession = sharedState.getSessions().get(safeSessionId) ?: return
        // Dropped streams are removed from sharedState in onStreamDropped, so a late
        // attach cannot subscribe to a stream that no longer exists.
        val foundStream = findStream(safeStreamId) ?: return
        session = foundSession
        stream = foundStream
        subscribeToStream(foundSession, foundStream)
    }

    /**
     * Releases this view's subscriber and forgets it. Idempotent; UI thread only.
     * Called by OTRNSubscriberManager.onDropViewInstance when Fabric destroys the view.
     */
    fun teardown() {
        val current = subscriber
        if (current != null) {
            releaseSubscriber(current, session, subscribedStreamId)
        }
        subscriber = null
        subscribedStreamId = null
        stream = null
        session = null
        pendingResubscribe = false
        liveViews.remove(this)
    }

    // Stops the current subscriber because its stream is gone, but keeps the reference so
    // onAttachedToWindow() does not subscribe again. teardown() clears it later.
    private fun releaseCurrentSubscriber() {
        val current = subscriber ?: return
        releaseSubscriber(current, session, subscribedStreamId)
    }

    // sessionId or streamId changed on a view that already subscribed: release the old
    // subscriber now and subscribe again once the full prop batch has been applied.
    private fun resetSubscriptionForNewTarget() {
        if (subscriber == null) {
            return
        }
        teardown()
        pendingResubscribe = true
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
        if (str == sessionId) {
            return
        }
        resetSubscriptionForNewTarget()
        sessionId = str
    }

    public fun setSubscribeToAudio(value: Boolean) {
        liveSubscriber?.subscribeToAudio = value
    }

    public fun setSubscribeToVideo(value: Boolean) {
        liveSubscriber?.subscribeToVideo = value
    }

    public fun setStreamId(str: String?) {
        if (str == streamId) {
            return
        }
        resetSubscriptionForNewTarget()
        streamId = str
    }

    fun setSubscribeToCaptions(value: Boolean) {
        liveSubscriber?.subscribeToCaptions = value
    }

    fun setAudioVolume(value: Float) {
        liveSubscriber?.audioVolume = value.toDouble()
    }

    fun setPreferredFrameRate(value: Int) {
        liveSubscriber?.preferredFrameRate = value.toFloat()
    }

    fun setPreferredResolution(value: String?) {
        var values: List<String> = value?.split("x") ?: return
        var width: Int = values[0].toInt()
        var height: Int = values[1].toInt()
        liveSubscriber?.setPreferredResolution(VideoUtils.Size(width, height))
    }

    fun subscribeToStream(session: Session, stream: Stream) {
        var pubOrSub: String? = ""
        var zOrder: String? = ""
        val newSubscriber = Subscriber.Builder(context, stream)
            .build()
        val newStreamId = stream.getStreamId()
        subscriber = newSubscriber
        subscribedStreamId = newStreamId
        liveViews.add(this)
        sharedState.getSubscribers().put(newStreamId, newSubscriber)
        subscriber?.setStyle(
            BaseVideoRenderer.STYLE_VIDEO_SCALE,
            (this.props?.get("scaleBehavior") as? String).toVideoScaleType()
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

        session.subscribe(subscriber)
        if (subscriber?.view != null) {
            this.addView(subscriber?.view)
            requestLayout()
        }
    }

    public fun setScaleBehavior(value: String?) {
        liveSubscriber?.setStyle(
            BaseVideoRenderer.STYLE_VIDEO_SCALE,
            value.toVideoScaleType()
        )
    }

    override fun onConnected(subscriber: SubscriberKit) {
        val stream = EventUtils.prepareJSStreamMap(subscriber.getStream(), subscriber.getSession())
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
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
        val stream = EventUtils.prepareJSStreamMap(subscriber?.getStream(), subscriber?.getSession())
        val payload =
            Arguments.createMap().apply {
                putDouble("audioLevel", audioLevel.toDouble())
                putMap("stream", stream)
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
        val stream = EventUtils.prepareJSStreamMap(subscriber?.getStream(), subscriber?.getSession())
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
            }
        emitOpenTokEvent("onVideoDataReceived", payload)
    }

    override fun onVideoDisabled(subscriber: SubscriberKit?, reason: String?) {
        val stream = EventUtils.prepareJSStreamMap(subscriber?.getStream(), subscriber?.getSession())
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
                putString("reason", reason)
            }
        emitOpenTokEvent("onVideoDisabled", payload)
    }

    override fun onVideoEnabled(subscriber: SubscriberKit?, reason: String?) {
        val stream = EventUtils.prepareJSStreamMap(subscriber?.getStream(), subscriber?.getSession())
        val payload =
            Arguments.createMap().apply {
                putMap("stream", stream)
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
        val stream = EventUtils.prepareJSStreamMap(subscriber?.getStream(), subscriber?.getSession())
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
        private const val LOG_TAG = "OTRNSubscriber"

        // Subscribers that were already released, so release is idempotent across the
        // view manager, removeSubscriber and onStreamDropped paths. Weak keys: no leak.
        // UI thread only.
        private val releasedSubscribers: MutableSet<Subscriber> =
            Collections.newSetFromMap(WeakHashMap())

        // Views that currently hold a subscriber. Weak: never keeps a view alive.
        // UI thread only.
        private val liveViews: MutableSet<OTRNSubscriber> =
            Collections.newSetFromMap(WeakHashMap())

        @JvmStatic
        fun isReleased(subscriber: Subscriber): Boolean =
            releasedSubscribers.contains(subscriber)

        /**
         * Stops and unregisters a subscriber. Idempotent; UI thread only.
         *
         * Order matters with TextureView rendering: the renderer is paused and the
         * subscriber unsubscribed while its TextureView is still attached (surface
         * valid), and only then is the SDK view removed from its container.
         */
        @JvmStatic
        fun releaseSubscriber(subscriber: Subscriber, session: Session?, streamId: String?) {
            UiThreadUtil.assertOnUiThread()
            if (!releasedSubscribers.add(subscriber)) {
                return
            }
            try {
                subscriber.renderer?.onPause()
            } catch (e: Exception) {
                Log.w(LOG_TAG, "Failed to pause subscriber renderer", e)
            }
            try {
                session?.unsubscribe(subscriber)
            } catch (e: Exception) {
                Log.w(LOG_TAG, "Failed to unsubscribe subscriber", e)
            }
            val sdkView = subscriber.view
            (sdkView?.parent as? ViewGroup)?.removeView(sdkView)
            if (streamId != null) {
                // Two-argument remove: never drops an entry that now belongs to
                // another (newer) subscriber for the same stream.
                OTRN.getSharedState().getSubscribers().remove(streamId, subscriber)
            }
        }

        /**
         * The stream is gone: release every subscriber rendering it, before JS
         * unmounts the views. UI thread only.
         */
        @JvmStatic
        fun releaseSubscribersForStream(streamId: String, session: Session?) {
            UiThreadUtil.assertOnUiThread()
            for (view in liveViews.toList()) {
                if (view.subscribedStreamId == streamId) {
                    view.releaseCurrentSubscriber()
                }
            }
            OTRN.getSharedState().getSubscribers().get(streamId)?.let {
                releaseSubscriber(it, session, streamId)
            }
        }

        /**
         * JS removeSubscriber path. It runs asynchronously, possibly after Fabric has
         * already mounted a new view for the same stream, so it only releases a
         * subscriber that no attached view owns. Attached views are released by
         * OTRNSubscriberManager.onDropViewInstance. UI thread only.
         */
        @JvmStatic
        fun releaseOrphanedSubscriber(streamId: String, session: Session?) {
            UiThreadUtil.assertOnUiThread()
            val subscriber = OTRN.getSharedState().getSubscribers().get(streamId) ?: return
            val ownedByAttachedView = liveViews.any {
                it.subscriber === subscriber && it.isAttachedToWindow
            }
            if (!ownedByAttachedView) {
                releaseSubscriber(subscriber, session, streamId)
            }
        }
    }
}