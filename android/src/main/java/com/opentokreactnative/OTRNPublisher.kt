package com.opentokreactnative

import android.content.Context
import android.hardware.camera2.CameraManager
import android.opengl.GLSurfaceView;
import android.util.AttributeSet
import android.util.Log
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.uimanager.ReactStylesDiffMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.common.UIManagerType
import com.facebook.react.uimanager.events.Event
import com.opentok.android.BaseVideoRenderer
import com.opentok.android.OpentokError
import com.opentok.android.Publisher
import com.opentok.android.PublisherKit
import com.opentok.android.PublisherKit.PublisherListener
import com.opentok.android.Stream
import com.opentokreactnative.utils.EventUtils;
import com.opentokreactnative.utils.Utils
import com.opentokreactnative.utils.toVideoScaleType;

class OTRNPublisher : FrameLayout, PublisherListener,
    PublisherKit.AudioLevelListener,
    PublisherKit.PublisherRtcStatsReportListener,
    PublisherKit.AudioStatsListener,
    PublisherKit.MuteListener,
    PublisherKit.VideoStatsListener,
    PublisherKit.VideoListener {

    private var sessionId: String? = ""
    private var publisherId: String? = ""

    private var publisher: Publisher? = null
    private var sharedState = OTRN.getSharedState();
    private var androidOnTopMap = sharedState.getAndroidOnTopMap();
    private var androidZOrderMap = sharedState.getAndroidZOrderMap();
    private var props: MutableMap<String, Any>? = null

    // Throttle: only emit onAudioLevel once per this interval.
    private var lastAudioLevelEmitMs: Long = 0
    private val AUDIO_LEVEL_THROTTLE_MS: Long = 200

    // Diagnostics
    private var diagLastReportMs: Long = System.currentTimeMillis()
    private var diagAudioLevelFired: Int = 0
    private var diagAudioLevelEmitted: Int = 0
    private var diagAudioStatsFired: Int = 0
    private var diagVideoStatsFired: Int = 0

    private fun maybePrintDiagnostics() {
        val now = System.currentTimeMillis()
        if (now - diagLastReportMs < 10_000) return
        val elapsed = (now - diagLastReportMs) / 1000.0
        Log.i("OTRN-DIAG", String.format(
            "publisher id=%s | %.1fs | audioLevel: %d fired, %d emitted | audioStats=%d videoStats=%d | publishers=%d",
            publisherId ?: "?",
            elapsed,
            diagAudioLevelFired, diagAudioLevelEmitted,
            diagAudioStatsFired, diagVideoStatsFired,
            sharedState.getPublishers().size
        ))
        diagLastReportMs = now
        diagAudioLevelFired = 0
        diagAudioLevelEmitted = 0
        diagAudioStatsFired = 0
        diagVideoStatsFired = 0
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
            return
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        publishStream(/*session ?: return*/)
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

    public fun setPublisherId(str: String?) {
        publisherId = str
    }

    public fun setPublishAudio(value: Boolean) {
        publisher?.setPublishAudio(value)
    }

    public fun setDegradationPreference(value: Int) {
        publisher?.setDegradationPreference(
            Utils.convertDegradationPreference(value)
        )
    }

    public fun setPublishVideo(value: Boolean) {
        publisher?.setPublishVideo(value)
    }

    public fun setPublishCaptions(value: Boolean) {
        publisher?.setPublishCaptions(value)
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setAudioBitrate(value: Int) {
        // Ignore -- set as initialization option only
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setPublisherAudioFallback(value: Boolean) {
        // Ignore -- set as initialization option only
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setSubscriberAudioFallback(value: Boolean) {
        // Ignore -- set as initialization option only
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setCameraPosition(value: String?) {
        publisher?.cycleCamera()
    }

    public fun setCameraTorch(value: Boolean) {
        publisher?.setCameraTorch(value)
    }

    public fun setCameraZoomFactor(value: Float) {
        publisher?.setCameraZoomFactor(value)
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setAudioTrack(value: Boolean) {
        // Ignore -- set as initialization option only
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setVideoTrack(value: Boolean) {
        // Ignore -- set as initialization option only
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setVideoSource(value: String?) {
        // Ignore -- set as initialization option only
    }

    public fun setVideoContentHint(value: String?) {
        publisher?.getCapturer()?.setVideoContentHint(
            Utils.convertVideoContentHint(value)
        )
    }

    public fun setMaxVideoBitrate(value: Int) {
        publisher?.setMaxVideoBitrate(value)
    }

    public fun setVideoBitratePreset(value: String?) {
        if (value == "") {
            return
        }
        publisher?.setVideoBitratePreset(
            Utils.convertVideoBitratePreset(value)
        )
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setEnableDtx(value: Boolean) {
        // Ignore -- set as initialization option only
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setFrameRate(value: Int) {
        // Ignore -- set as initialization option only
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setName(value: String?) {
        // Ignore -- set as initialization option only
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setResolution(value: String?) {
        // Ignore -- set as initialization option only
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setScalableScreenshare(value: Boolean) {
        // Ignore -- set as initialization option only
    }

    public fun setAllowAudioCaptureWhileMuted(value: Boolean) {
        // Ignore -- set as initialization option only
    }

     public fun setPublishSenderStats(value: Boolean) {
        // Ignore -- set as initialization option only
    }

    public fun setScaleBehavior(value: String?) {
        publisher?.setStyle(
            BaseVideoRenderer.STYLE_VIDEO_SCALE,
            value.toVideoScaleType()
        )
    }

    @Suppress("UNUSED_PARAMETER")
    public fun setPreferredVideoCodecs(value: String?) {
        // Ignore -- set as initialization option only
    }

    private fun publishStream() {
        var pubOrSub: String? = ""
        var zOrder: String? = ""
        var preferredVideoCodecs: PublisherKit.PreferredVideoCodecs? = this.getPreferredVideoCodecs();

        val publishSenderStats : Boolean = this.props?.get("publishSenderStats") as? Boolean ?: false;

        if (this.props?.get("videoSource") == "screen") {
            var publisherBuilder: Publisher.Builder = Publisher.Builder(context)
                .audioBitrate((this.props?.get("audioBitrate") as Double).toInt())
                .name(this.props?.get("name") as String)
                .frameRate(
                    Publisher.CameraCaptureFrameRate.valueOf(
                        "FPS_" + (((this.props?.get("frameRate") as Double)).toInt()).toString()
                    )
                )
                .resolution(Publisher.CameraCaptureResolution.valueOf(this.props?.get("resolution") as String)) //test
                .audioTrack(this.props?.get("audioTrack") as Boolean)
                .videoTrack(this.props?.get("videoTrack") as Boolean)
                .enableOpusDtx(this.props?.get("enableDtx") as Boolean)
                .scalableScreenshare(this.props?.get("scalableScreenshare") as Boolean)
                .allowAudioCaptureWhileMuted(this.props?.get("allowAudioCaptureWhileMuted") as Boolean)
                .capturer(OTScreenCapturer(this))
                .senderStatsTrack(publishSenderStats)
            if (preferredVideoCodecs != null) {
                publisherBuilder?.preferredVideoCodecs(preferredVideoCodecs)
            }
            publisher = publisherBuilder?.build()
            publisher?.setPublisherVideoType(PublisherKit.PublisherKitVideoType.PublisherKitVideoTypeScreen)
        } else if (this.props?.get("videoSource") == "camera") {
            // Check if any camera is available. If not, substitute a no-op capturer
            // to prevent the SDK from constructing Camera2VideoCapturer (whose destroy()
            // throws NPE when ImageReader is null — fixed in native SDK 2.36.0).
            val hasCamera = try {
                val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                cameraManager.cameraIdList.isNotEmpty()
            } catch (e: Exception) {
                false
            }

            var publisherBuilder: Publisher.Builder = Publisher.Builder(context)
                .audioBitrate((this.props?.get("audioBitrate") as Double).toInt())
                .publisherAudioFallbackEnabled(this.props?.get("publisherAudioFallback") as Boolean)
                .subscriberAudioFallbackEnabled(this.props?.get("subscriberAudioFallback") as Boolean)
                .name(this.props?.get("name") as String)
                .frameRate(
                    Publisher.CameraCaptureFrameRate.valueOf(
                        "FPS_" + (((this.props?.get("frameRate") as Double)).toInt()).toString()
                    )
                )
                .resolution(Publisher.CameraCaptureResolution.valueOf(this.props?.get("resolution") as String)) //test
                .audioTrack(this.props?.get("audioTrack") as Boolean)
                .videoTrack(this.props?.get("videoTrack") as Boolean)
                .enableOpusDtx(this.props?.get("enableDtx") as Boolean)
                .senderStatsTrack(this.props?.get("publishSenderStats") as Boolean)

            if (!hasCamera) {
                publisherBuilder = publisherBuilder.capturer(OTNoOpVideoCapturer())
                Log.w(LIFECYCLE_TAG, "No camera available — using OTNoOpVideoCapturer to avoid SDK NPE")
            }

            if (preferredVideoCodecs != null) {
                publisherBuilder?.preferredVideoCodecs(preferredVideoCodecs)
            }
            publisher = publisherBuilder?.build()
            publisher?.setPublisherVideoType(PublisherKit.PublisherKitVideoType.PublisherKitVideoTypeCamera)
            if (hasCamera && this.props?.get("videoTrack") as Boolean) {
                publisher?.getCapturer()?.setVideoContentHint(
                    Utils.convertVideoContentHint(this.props?.get("videoContentHint") as String)
                )
            }
            if (this.props?.get("cameraPosition") as String == "back") {
                // Do not set publishVideo here, start when stream is created
                // to avoid front camera preview flash
                publisher?.setPublishVideo(false)
            } else {
                publisher?.setPublishVideo(this.props?.get("publishVideo") as Boolean)
            }
        }

        publisher?.setPublishAudio(this.props?.get("publishAudio") as Boolean)
        publisher?.setPublishCaptions(this.props?.get("publishCaptions") as Boolean)
        val degradationPreferenceInt =
            (this.props?.get("degradationPreference") as? Double)?.toInt() ?: -1
        publisher?.setDegradationPreference(
            Utils.convertDegradationPreference(degradationPreferenceInt)
        )
        publisher?.setStyle(
            BaseVideoRenderer.STYLE_VIDEO_SCALE,
            (this.props?.get("scaleBehavior") as String).toVideoScaleType()
        )

        if (androidOnTopMap.get(sessionId) != null) {
            pubOrSub = androidOnTopMap.get(sessionId);
        }
        if (androidZOrderMap.get(sessionId) != null) {
            zOrder = androidZOrderMap.get(sessionId);
        }

        if (pubOrSub.equals("publisher") && publisher?.getView() is GLSurfaceView) {
            if (zOrder.equals("mediaOverlay")) {
                (publisher?.getView() as GLSurfaceView).setZOrderMediaOverlay(true)
            } else {
                (publisher?.getView() as GLSurfaceView).setZOrderOnTop(true)
            }
        }

        publisher?.setCameraTorch(this.props?.get("cameraTorch") as Boolean)
        publisher?.setCameraZoomFactor((this.props?.get("cameraZoomFactor") as Double).toFloat())

        //Listeners
        publisher?.setPublisherListener(this)
        publisher?.setAudioLevelListener(this)
        publisher?.setAudioStatsListener(this)
        publisher?.setMuteListener(this)
        publisher?.setVideoListener(this)
        publisher?.setVideoStatsListener(this)
        publisher?.setRtcStatsReportListener(this)

        // Move this to streamcreated? Can we get the publisherID there? or streamID is enough
        sharedState.getPublishers()
            .put(this.props?.get("publisherId") as String, publisher ?: return);
        // videoTrack/videoSource are logged because a publisher that never opens a camera
        // has no ImageReader to close, which is one of the shapes that trips the SDK's
        // capturer teardown.
        Log.i(
            LIFECYCLE_TAG,
            "publisher created publisherId=${this.props?.get("publisherId")}" +
                " videoTrack=${this.props?.get("videoTrack")}" +
                " videoSource=${this.props?.get("videoSource")}" +
                " publishersInState=${sharedState.getPublishers().size}"
        )
        if (publisher?.view != null) {
            this.addView(publisher?.view)
            requestLayout()
        }
    }

    override fun onStreamCreated(publisher: PublisherKit, stream: Stream) {
        val cameraPosition = this.props?.get("cameraPosition") as? String ?: "front"
        if (cameraPosition == "back") {
            this.publisher?.cycleCamera()
            this.publisher?.setPublishVideo(this.props?.get("publishVideo") as Boolean)
        }
        OTRN.sharedState.getPublisherStreams()[stream.streamId] = stream
        val payload = EventUtils.prepareJSStreamMap(stream, publisher.getSession())
        emitOpenTokEvent("onStreamCreated", payload)
        Log.i(
            LIFECYCLE_TAG,
            "publisher onStreamCreated streamId=${stream.streamId}" +
                " publisherId=$publisherId" +
                " publishersInState=${OTRN.sharedState.getPublishers().size}"
        )
    }

    override fun onStreamDestroyed(publisher: PublisherKit, stream: Stream) {
        OTRN.sharedState.getPublisherStreams().remove(stream.streamId)
        val payload = EventUtils.prepareJSStreamMap(stream, publisher.getSession())
        emitOpenTokEvent("onStreamDestroyed", payload)

        // Release the publisher from shared state here rather than in
        // OpentokReactNativeModule.unpublish(). At this point the SDK has confirmed the
        // stream is gone, so dropping our strong reference is safe. Releasing earlier
        // (during unpublish) raced with the SDK's queued capturer teardown and could
        // surface as an NPE inside Camera2VideoCapturer.destroy().
        //
        // Resolved via reverse lookup so the key we remove is guaranteed to be the one
        // publishStream() inserted.
        val resolvedPublisherId = Utils.getPublisherId(publisher)
        if (resolvedPublisherId.isNotEmpty()) {
            OTRN.sharedState.getPublishers().remove(resolvedPublisherId)
        }
        Log.i(
            LIFECYCLE_TAG,
            "publisher onStreamDestroyed streamId=${stream.streamId}" +
                " resolvedPublisherId=$resolvedPublisherId" +
                " released=${resolvedPublisherId.isNotEmpty()}" +
                " publishersInState=${OTRN.sharedState.getPublishers().size}"
        )
    }

    override fun onError(publisher: PublisherKit, opentokError: OpentokError) {
        val payload = EventUtils.prepareJSErrorMap(opentokError);
        emitOpenTokEvent("onError", payload)
        // A publisher that errors here may never produce a stream, which means
        // onStreamDestroyed will never fire and its shared-state entry will linger.
        Log.w(
            LIFECYCLE_TAG,
            "publisher onError publisherId=$publisherId" +
                " code=${opentokError.errorCode}" +
                " message=${opentokError.message}" +
                " publishersInState=${OTRN.sharedState.getPublishers().size}"
        )
    }

    override fun onAudioLevelUpdated(publisher: PublisherKit?, audioLevel: Float) {
        diagAudioLevelFired++
        maybePrintDiagnostics()

        // Throttle: skip if we emitted within the last AUDIO_LEVEL_THROTTLE_MS.
        val now = System.currentTimeMillis()
        if (now - lastAudioLevelEmitMs < AUDIO_LEVEL_THROTTLE_MS) return
        lastAudioLevelEmitMs = now
        diagAudioLevelEmitted++

        val publisherId = Utils.getPublisherId(publisher) // Do we need this?
        if (publisherId.isNotEmpty()) {
            val payload =
                Arguments.createMap().apply {
                    putDouble("audioLevel", audioLevel.toDouble())
                }
            emitOpenTokEvent("onAudioLevel", payload)
        }
    }

    override fun onRtcStatsReport(
        publisher: PublisherKit?,
        stats: Array<out PublisherKit.PublisherRtcStats>?
    ) {
        val statsArray: WritableArray = Arguments.createArray()
        for (stat in stats!!) {
            val rtcStats: WritableMap = Arguments.createMap()
            rtcStats.putString("connectionId", stat.connectionId)
            rtcStats.putString("jsonArrayOfReports", stat.jsonArrayOfReports)
            statsArray.pushMap(rtcStats)
        }
        val payload =
            Arguments.createMap().apply {
                putString("jsonStats", statsArray.toString())
            }
        emitOpenTokEvent("onRtcStatsReport", payload)
    }

    override fun onAudioStats(
        publisher: PublisherKit?,
        stats: Array<out PublisherKit.PublisherAudioStats>?
    ) {
        diagAudioStatsFired++
        val statsArray: WritableArray = Arguments.createArray()
        for (stat in stats!!) {
            val audioStats: WritableMap = Arguments.createMap()
            audioStats.putString("connectionId", stat.connectionId)
            audioStats.putString("subscriberId", stat.subscriberId)
            audioStats.putDouble("audioPacketsLost", stat.audioPacketsLost.toDouble())
            audioStats.putDouble("audioPacketsSent", stat.audioPacketsSent.toDouble())
            audioStats.putDouble("audioBytesSent", stat.audioBytesSent.toDouble())
            audioStats.putDouble("startTime", stat.startTime) // kept for backward compatibility
            audioStats.putDouble("timestamp", stat.startTime) // matches iOS key and TS spec
            statsArray.pushMap(audioStats)
        }
        val serializedStats = statsArray.toString()
        val payload =
            Arguments.createMap().apply {
                putString("jsonStats", serializedStats) // preferred key (matches iOS/codegen)
                putString("stats", serializedStats) // deprecated legacy key kept for backward compatibility
            }
        emitOpenTokEvent("onAudioNetworkStats", payload)
    }

    override fun onMuteForced(publisher: PublisherKit?) {
        emitOpenTokEvent("onMuteForced", Arguments.createMap())
    }

    override fun onVideoStats(
        publisher: PublisherKit?,
        stats: Array<out PublisherKit.PublisherVideoStats>?
    ) {
        diagVideoStatsFired++
        val publisherId = Utils.getPublisherId(publisher)
        if (publisherId.isNotEmpty()) {
            val statsArrayMap: WritableArray = Arguments.createArray()
            for (stat in stats!!) {
                val audioStats: WritableMap = Arguments.createMap()
                audioStats.putString("connectionId", stat.connectionId)
                audioStats.putString("subscriberId", stat.subscriberId)
                audioStats.putDouble("videoPacketsLost", stat.videoPacketsLost.toDouble())
                audioStats.putDouble("videoBytesSent", stat.videoBytesSent.toDouble())
                audioStats.putDouble("videoPacketsSent", stat.videoPacketsSent.toDouble())
                audioStats.putDouble("startTime", stat.startTime) // kept for backward compatibility
                audioStats.putDouble("timestamp", stat.startTime) // matches iOS key and TS spec
                statsArrayMap.pushMap(audioStats)
            }
            val serializedStats = statsArrayMap.toString()
            val payload =
                Arguments.createMap().apply {
                    putString("jsonStats", serializedStats) // preferred key (matches iOS/codegen)
                    putString("stats", serializedStats) // deprecated legacy key kept for backward compatibility
                }
            emitOpenTokEvent("onVideoNetworkStats", payload)
        }
    }

    override fun onVideoDisabled(publisher: PublisherKit?, reason: String?) {
        val payload = Arguments.createMap().apply {
            putString("reason", reason ?: "")
        }
        emitOpenTokEvent("onVideoDisabled", payload)
    }

    override fun onVideoEnabled(publisher: PublisherKit?, reason: String?) {
        val payload = Arguments.createMap().apply {
            putString("reason", reason ?: "")
        }
        emitOpenTokEvent("onVideoEnabled", payload)
    }

    override fun onVideoDisableWarning(publisher: PublisherKit?) {
        emitOpenTokEvent("onVideoDisableWarning", Arguments.createMap())
    }

    override fun onVideoDisableWarningLifted(publisher: PublisherKit?) {
        emitOpenTokEvent("onVideoDisableWarningLifted", Arguments.createMap())
    }

    private fun getPreferredVideoCodecs(): PublisherKit.PreferredVideoCodecs? {
        val preferredVideoCodecsStr = (this.props?.get("preferredVideoCodecs") as? String)?.uppercase() ?: ""
        println("preferredVideoCodecs: " + preferredVideoCodecsStr)
        if (preferredVideoCodecsStr.isEmpty()) {
            return null
        } else if (preferredVideoCodecsStr == "AUTOMATIC") {
            return PublisherKit.PreferredVideoCodecs.automatic()
        }
        val videoCodecs = preferredVideoCodecsStr.split(";")
        val preferredVideoCodecs = ArrayList<PublisherKit.PreferredVideoCodecs.Codec>()

        for (codec in videoCodecs) {
            when (codec) {
                "VP8" -> preferredVideoCodecs.add(PublisherKit.PreferredVideoCodecs.Codec.VP8)
                "VP9" -> preferredVideoCodecs.add(PublisherKit.PreferredVideoCodecs.Codec.VP9)
                "H264" -> preferredVideoCodecs.add(PublisherKit.PreferredVideoCodecs.Codec.H264)
            }
        }

        return if (preferredVideoCodecs.isEmpty()) {
            null
        } else {
            PublisherKit.PreferredVideoCodecs.manual(preferredVideoCodecs)
        }
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

    private companion object {
        /**
         * Shared with OpentokReactNativeModule so the whole publisher lifecycle can be
         * read as one stream: adb logcat -s OTRN-LIFECYCLE
         * Only discrete lifecycle transitions log here — never per-frame callbacks.
         */
        const val LIFECYCLE_TAG = "OTRN-LIFECYCLE"
    }
}