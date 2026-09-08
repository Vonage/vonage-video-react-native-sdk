package com.opentokreactnative

import android.content.Context
import android.content.pm.PackageManager
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

    // The exact key publishStream() inserted into shared state. Prefer this over
    // Utils.getPublisherId() reverse lookup: the lookup is O(n) over the publishers
    // map and returns "" once the entry is gone, so it cannot identify this publisher
    // on a second callback (or after release).
    private var registeredPublisherId: String? = null

    // Set once teardown has run so every entry point is idempotent. Also blocks
    // publishStream() from resurrecting a released view if it is re-attached.
    @Volatile private var released = false

    private var publisher: Publisher? = null
    private var sharedState = OTRN.getSharedState();
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

    // Safe prop readers: every prop except sessionId/publisherId is optional in the
    // codegen spec, so a missing or wrong-typed value must fall back to the same default
    // the JS sanitizer applies (see src/helpers/OTPublisherHelper.js) rather than throwing.
    private fun propBool(key: String, default: Boolean): Boolean =
        this.props?.get(key) as? Boolean ?: default

    private fun propString(key: String, default: String): String =
        this.props?.get(key) as? String ?: default

    private fun propDouble(key: String, default: Double): Double =
        (this.props?.get(key) as? Number)?.toDouble() ?: default

    // Publisher.CameraCaptureFrameRate.valueOf throws on a name the native SDK does not
    // know, so an out-of-range frameRate falls back to the sanitizer default instead of
    // taking down the publisher.
    private fun resolveCaptureFrameRate(fps: Int): Publisher.CameraCaptureFrameRate =
        try {
            Publisher.CameraCaptureFrameRate.valueOf("FPS_$fps")
        } catch (e: IllegalArgumentException) {
            Log.w(LIFECYCLE_TAG, "Unsupported frameRate FPS_$fps — falling back to FPS_30")
            Publisher.CameraCaptureFrameRate.FPS_30
        }

    // Same guard for Publisher.CameraCaptureResolution.valueOf.
    private fun resolveCaptureResolution(name: String): Publisher.CameraCaptureResolution =
        try {
            Publisher.CameraCaptureResolution.valueOf(name)
        } catch (e: IllegalArgumentException) {
            Log.w(LIFECYCLE_TAG, "Unsupported resolution '$name' — falling back to MEDIUM")
            Publisher.CameraCaptureResolution.MEDIUM
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

    public fun setEmitAudioLevel(value: Boolean) {
        emitAudioLevel = value
    }

    public fun setEmitAudioNetworkStats(value: Boolean) {
        emitAudioNetworkStats = value
    }

    public fun setEmitVideoNetworkStats(value: Boolean) {
        emitVideoNetworkStats = value
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
        // onAttachedToWindow can fire more than once for the same view (re-parenting,
        // or Fabric reusing the instance). Building a second Publisher here would orphan
        // the first one: its shared-state entry would be overwritten and nothing would
        // ever stop its capturer. Also refuse to build after teardown.
        if (publisher != null || released) {
            Log.i(
                LIFECYCLE_TAG,
                "publishStream skipped: alreadyCreated=${publisher != null} released=$released" +
                    " publisherId=$publisherId"
            )
            return
        }

        var pubOrSub: String? = ""
        var zOrder: String? = ""
        var preferredVideoCodecs: PublisherKit.PreferredVideoCodecs? = this.getPreferredVideoCodecs();

        val publishSenderStats : Boolean = this.props?.get("publishSenderStats") as? Boolean ?: false;

        if (this.props?.get("videoSource") == "screen") {
            var publisherBuilder: Publisher.Builder = Publisher.Builder(context)
                .audioBitrate(propDouble("audioBitrate", 40000.0).toInt())
                .name(propString("name", ""))
                .frameRate(resolveCaptureFrameRate(propDouble("frameRate", 30.0).toInt()))
                .resolution(resolveCaptureResolution(propString("resolution", "MEDIUM")))
                .audioTrack(propBool("audioTrack", true))
                .videoTrack(propBool("videoTrack", true))
                .enableOpusDtx(propBool("enableDtx", false))
                .scalableScreenshare(propBool("scalableScreenshare", false))
                .allowAudioCaptureWhileMuted(propBool("allowAudioCaptureWhileMuted", false))
                .capturer(OTScreenCapturer(this))
                .senderStatsTrack(publishSenderStats)
            if (preferredVideoCodecs != null) {
                publisherBuilder?.preferredVideoCodecs(preferredVideoCodecs)
            }
            publisher = publisherBuilder?.build()
            publisher?.setPublisherVideoType(PublisherKit.PublisherKitVideoType.PublisherKitVideoTypeScreen)
        } else if (this.props?.get("videoSource") == "camera") {
            // Substitute a no-op capturer whenever we can tell up front that the camera
            // will never open, so the SDK does not construct Camera2VideoCapturer. Its
            // destroy() closes the ImageReader without a null check, and that reader is
            // only created once the camera actually opens — so a Camera2VideoCapturer
            // that never opened throws NPE during teardown, on a Looper message where it
            // cannot be caught. Fixed in native SDK 2.36.0 (unreleased as of 2.35.1).
            //
            // Two detectable cases: no camera hardware, and CAMERA permission not
            // granted. Neither covers "camera exists and is permitted but fails to open"
            // — that path still depends on the native fix.
            val hasCameraHardware = try {
                val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                cameraManager.cameraIdList.isNotEmpty()
            } catch (e: Exception) {
                false
            }
            val hasCameraPermission = try {
                context.checkSelfPermission(android.Manifest.permission.CAMERA) ==
                    PackageManager.PERMISSION_GRANTED
            } catch (e: Exception) {
                false
            }
            val hasCamera = hasCameraHardware && hasCameraPermission

            var publisherBuilder: Publisher.Builder = Publisher.Builder(context)
                .audioBitrate(propDouble("audioBitrate", 40000.0).toInt())
                .publisherAudioFallbackEnabled(propBool("publisherAudioFallback", false))
                .subscriberAudioFallbackEnabled(propBool("subscriberAudioFallback", true))
                .name(propString("name", ""))
                .frameRate(resolveCaptureFrameRate(propDouble("frameRate", 30.0).toInt()))
                .resolution(resolveCaptureResolution(propString("resolution", "MEDIUM")))
                .audioTrack(propBool("audioTrack", true))
                .videoTrack(propBool("videoTrack", true))
                .enableOpusDtx(propBool("enableDtx", false))
                .senderStatsTrack(publishSenderStats)

            if (!hasCamera) {
                publisherBuilder = publisherBuilder.capturer(OTNoOpVideoCapturer())
                Log.w(
                    LIFECYCLE_TAG,
                    "No usable camera — using OTNoOpVideoCapturer to avoid SDK NPE" +
                        " (hardware=$hasCameraHardware permission=$hasCameraPermission)"
                )
            }

            if (preferredVideoCodecs != null) {
                publisherBuilder?.preferredVideoCodecs(preferredVideoCodecs)
            }
            publisher = publisherBuilder?.build()
            publisher?.setPublisherVideoType(PublisherKit.PublisherKitVideoType.PublisherKitVideoTypeCamera)
            if (hasCamera && propBool("videoTrack", true)) {
                publisher?.getCapturer()?.setVideoContentHint(
                    Utils.convertVideoContentHint(propString("videoContentHint", ""))
                )
            }
            if (propString("cameraPosition", "front") == "back") {
                // Do not set publishVideo here, start when stream is created
                // to avoid front camera preview flash
                publisher?.setPublishVideo(false)
            } else {
                publisher?.setPublishVideo(propBool("publishVideo", true))
            }
        }

        publisher?.setPublishAudio(propBool("publishAudio", true))
        publisher?.setPublishCaptions(propBool("publishCaptions", false))
        val degradationPreferenceInt =
            (this.props?.get("degradationPreference") as? Number)?.toInt() ?: -1
        publisher?.setDegradationPreference(
            Utils.convertDegradationPreference(degradationPreferenceInt)
        )
        publisher?.setStyle(
            BaseVideoRenderer.STYLE_VIDEO_SCALE,
            (this.props?.get("scaleBehavior") as? String).toVideoScaleType()
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

        publisher?.setCameraTorch(propBool("cameraTorch", false))
        publisher?.setCameraZoomFactor(propDouble("cameraZoomFactor", 1.0).toFloat())

        //Listeners
        publisher?.setPublisherListener(this)
        publisher?.setAudioLevelListener(this)
        publisher?.setAudioStatsListener(this)
        publisher?.setMuteListener(this)
        publisher?.setVideoListener(this)
        publisher?.setVideoStatsListener(this)
        publisher?.setRtcStatsReportListener(this)

        // Move this to streamcreated? Can we get the publisherID there? or streamID is enough
        // publisherId is required by the codegen spec, so there is no sensible default:
        // without it the publisher cannot be keyed into shared state at all.
        val resolvedPublisherId = this.props?.get("publisherId") as? String
        if (resolvedPublisherId.isNullOrBlank()) {
            Log.e(
                LIFECYCLE_TAG,
                "publisher cannot be registered: publisherId prop missing or blank" +
                    " sessionId=$sessionId" +
                    " videoSource=${this.props?.get("videoSource")}"
            )
            return
        }
        sharedState.getPublishers()
            .put(resolvedPublisherId, publisher ?: return);
        // Remember the exact key we inserted so teardown and callbacks never depend on a
        // reverse lookup that stops working the moment the entry is removed.
        registeredPublisherId = resolvedPublisherId
        // videoTrack/videoSource are logged because a publisher that never opens a camera
        // has no ImageReader to close, which is one of the shapes that trips the SDK's
        // capturer teardown.
        Log.i(
            LIFECYCLE_TAG,
            "publisher created publisherId=$resolvedPublisherId" +
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
            this.publisher?.setPublishVideo(propBool("publishVideo", true))
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

    /**
     * Single deterministic teardown for this publisher.
     *
     * WHY IT LIVES HERE
     * The view creates the publisher (onAttachedToWindow -> publishStream), so the view
     * owns destroying it. Called from OTRNPublisherManager.onDropViewInstance, which is
     * the one signal that arrives on every path — graceful unpublish, publish error,
     * involuntary disconnect, screen navigation, app teardown. Before this existed the
     * only release site was onStreamDestroyed, so any publisher that never created and
     * gracefully tore down a stream stayed in shared state with its capturer running.
     *
     * This restores the sequence the old architecture ran in
     * OTSessionManager.destroyPublisher(), which the new-architecture rewrite dropped.
     *
     * Note this stops the capturer but deliberately does NOT call Publisher.destroy().
     * destroy() posts capturer teardown onto a Looper after flushing its own queue, so
     * for a camera that never opened it would reliably trigger the uncatchable
     * Camera2VideoCapturer NPE. Stopping capture releases the camera, which is the
     * resource that matters; the native publisher object is reclaimed by the SDK's
     * finalizer. Revisit once native SDK 2.36.0 ships the null check.
     *
     * Idempotent, and safe to call after a lifecycle callback already released the
     * shared-state entry.
     */
    fun releaseNative(reason: String) {
        if (released) {
            return
        }
        released = true

        val pub = publisher
        val idForRelease = registeredPublisherId

        if (pub != null) {
            // 1. Detach listeners first so no queued SDK callback re-enters a view that
            //    is already half torn down.
            runCatching {
                pub.setPublisherListener(null)
                pub.setAudioLevelListener(null)
                pub.setAudioStatsListener(null)
                pub.setMuteListener(null)
                pub.setVideoListener(null)
                pub.setVideoStatsListener(null)
                pub.setRtcStatsReportListener(null)
            }

            // 2. Drop the SDK's render view out of our hierarchy.
            runCatching { removeAllViews() }

            // 3. Unpublish while the session can still accept it. Session.unpublish()
            //    reports SessionDisconnected and does nothing once the session is down,
            //    so this is best-effort by design — step 4 is what guarantees release.
            runCatching { pub.session?.unpublish(pub) }

            // 4. Release the camera deterministically. Without this the capturer keeps
            //    running until the garbage collector happens to finalize the publisher,
            //    which may be a long time or never.
            runCatching { pub.capturer?.stopCapture() }
        }

        publisher = null

        // 5. Drop the shared-state strong reference. That map is a static singleton, so
        //    an entry left behind keeps the whole publisher reachable forever.
        Utils.releasePublisher(idForRelease, reason)

        Log.i(
            LIFECYCLE_TAG,
            "releaseNative() reason=$reason" +
                " publisherId=$idForRelease" +
                " hadPublisher=${pub != null}"
        )
    }

    override fun onStreamDestroyed(publisher: PublisherKit, stream: Stream) {
        OTRN.sharedState.getPublisherStreams().remove(stream.streamId)
        val payload = EventUtils.prepareJSStreamMap(stream, publisher.getSession())
        emitOpenTokEvent("onStreamDestroyed", payload)

        // Early release on the graceful path: the SDK has confirmed the stream is gone,
        // so there is no reason to keep the shared-state entry until the view is dropped.
        // This is an optimisation, not the guarantee — releaseNative() is the backstop
        // for every path where this callback never arrives.
        val idForRelease = registeredPublisherId
        Utils.releasePublisher(idForRelease, "streamDestroyed")
        Log.i(
            LIFECYCLE_TAG,
            "publisher onStreamDestroyed streamId=${stream.streamId}" +
                " publisherId=$idForRelease"
        )
    }

    override fun onError(publisher: PublisherKit, opentokError: OpentokError) {
        val payload = EventUtils.prepareJSErrorMap(opentokError);
        emitOpenTokEvent("onError", payload)
        // Release only on errors the publisher provably cannot recover from. Inferring
        // this from "has no stream yet" would be wrong: a healthy publisher that hits a
        // transient error before its stream exists looks identical, and unregistering it
        // would silently break every publisherId lookup for it (unpublish, RTC stats,
        // transformers) as well as the audioLevel and videoNetworkStats gates.
        //
        // Anything not on this list is left alone and released by onStreamDestroyed or,
        // failing that, by releaseNative() when the view is dropped.
        val isFatal = isFatalPublisherError(opentokError.errorCode)
        if (isFatal) {
            Utils.releasePublisher(
                registeredPublisherId,
                "fatalError:${opentokError.errorCode}"
            )
        }
        Log.w(
            LIFECYCLE_TAG,
            "publisher onError publisherId=$registeredPublisherId" +
                " code=${opentokError.errorCode}" +
                " message=${opentokError.message}" +
                " fatal=$isFatal"
        )
    }

    /**
     * Errors after which the publisher is dead and will never produce a stream, so
     * onStreamDestroyed can never fire for it.
     */
    private fun isFatalPublisherError(code: OpentokError.ErrorCode): Boolean =
        when (code) {
            OpentokError.ErrorCode.PublisherInternalError,
            OpentokError.ErrorCode.PublisherTimeout,
            OpentokError.ErrorCode.PublisherUnableToPublish,
            OpentokError.ErrorCode.PublisherCannotAccessCamera,
            OpentokError.ErrorCode.PublisherCameraAccessDenied,
            OpentokError.ErrorCode.CameraFailed -> true
            else -> false
        }

    override fun onAudioLevelUpdated(publisher: PublisherKit?, audioLevel: Float) {
        // Suppressed at emission when no JS handler is attached.
        if (!emitAudioLevel) return
        // Gate on our own registration rather than a reverse lookup: this fires per audio
        // frame, and Utils.getPublisherId() walks the whole publishers map every time.
        if (released || registeredPublisherId == null) return

        val payload =
            Arguments.createMap().apply {
                putDouble("audioLevel", audioLevel.toDouble())
            }
        emitOpenTokEvent("onAudioLevel", payload)
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
        // Suppressed at emission when no JS handler is attached.
        if (!emitAudioNetworkStats) return
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
        // Suppressed at emission when no JS handler is attached.
        if (!emitVideoNetworkStats) return
        // Same reasoning as onAudioLevelUpdated: use our own registration, not an O(n)
        // reverse lookup that also fails as soon as the shared-state entry is released.
        if (!released && registeredPublisherId != null) {
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