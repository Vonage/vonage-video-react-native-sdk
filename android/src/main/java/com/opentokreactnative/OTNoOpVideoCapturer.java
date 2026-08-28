package com.opentokreactnative;

import android.util.Log;

import com.opentok.android.BaseVideoCapturer;

/**
 * A no-op video capturer that produces no frames.
 *
 * Used as a fallback when no camera is available on the device (e.g. CI emulators
 * launched with -camera-back none). Supplying a custom capturer prevents the SDK
 * from constructing Camera2VideoCapturer, which avoids an NPE in its destroy()
 * method when ImageReader is null (fixed in native SDK 2.36.0).
 *
 * This capturer satisfies the SDK's lifecycle contract (init/start/stop/destroy)
 * without touching any hardware. The publisher will report video as disabled.
 *
 * TODO: Remove once native SDK is bumped to 2.36.0+
 */
public class OTNoOpVideoCapturer extends BaseVideoCapturer {

    private static final String TAG = "OTRN-LIFECYCLE";

    private boolean capturing = false;

    public OTNoOpVideoCapturer() {
        Log.i(TAG, "OTNoOpVideoCapturer constructed");
    }

    @Override
    public void init() {
        Log.i(TAG, "OTNoOpVideoCapturer.init()");
    }

    @Override
    public int startCapture() {
        capturing = true;
        Log.i(TAG, "OTNoOpVideoCapturer.startCapture()");
        return 0;
    }

    @Override
    public int stopCapture() {
        capturing = false;
        Log.i(TAG, "OTNoOpVideoCapturer.stopCapture()");
        return 0;
    }

    @Override
    public boolean isCaptureStarted() {
        return capturing;
    }

    @Override
    public CaptureSettings getCaptureSettings() {
        CaptureSettings settings = new CaptureSettings();
        settings.fps = 1;
        settings.width = 2;
        settings.height = 2;
        settings.format = ARGB;
        return settings;
    }

    @Override
    public void destroy() {
        // No-op. No ImageReader, no NPE. This is the whole point of this class.
        Log.i(TAG, "OTNoOpVideoCapturer.destroy() (no-op, no ImageReader to close)");
    }

    @Override
    public void onPause() {
    }

    @Override
    public void onResume() {
    }
}
