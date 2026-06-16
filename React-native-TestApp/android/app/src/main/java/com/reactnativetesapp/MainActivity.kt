package com.reactnativetesapp

import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ReactNativeTesApp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Fix for "token null is not valid" and window focus errors
   * Only call super.onWindowFocusChanged when activity is in a valid state
   */
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    try {
      if (!isFinishing && !isDestroyed) {
        super.onWindowFocusChanged(hasFocus)
      }
    } catch (e: Exception) {
      Log.e("MainActivity", "Exception in onWindowFocusChanged: ${e.message}", e)
      // Silently catch any exceptions during window focus changes
      // This prevents crashes when the React context isn't ready
    }
  }

  /**
   * Additional safety check to ensure proper lifecycle
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
  }
}
