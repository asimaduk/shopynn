package com.shopynn

import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import org.devio.rn.splashscreen.SplashScreen

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Full logo + SHOPYNN label (same asset as iOS). Theme windowBackground covers the
    // first paint; the dialog keeps it until JS calls hide (with a safety timeout).
    SplashScreen.show(this, false)
    super.onCreate(savedInstanceState)
    setTheme(R.style.AppTheme)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    window.statusBarColor = Color.TRANSPARENT

    // Safety: never leave the splash dialog up if JS hide races the show() UI post.
    Handler(Looper.getMainLooper()).postDelayed({
      try {
        SplashScreen.hide(this)
      } catch (_: Exception) {
      }
    }, 4000)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Shopynn"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
