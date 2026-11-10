package com.shopynn.security

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Blocks screenshots, screen recording and the app-switcher preview (FLAG_SECURE) while at least
 * one sensitive screen is mounted. Counted so overlapping screens don't clear each other's flag.
 */
class ScreenSecurityModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var holders = 0

    override fun getName(): String = "ScreenSecurity"

    @ReactMethod
    fun enable() {
        UiThreadUtil.runOnUiThread {
            holders += 1
            apply()
        }
    }

    @ReactMethod
    fun disable() {
        UiThreadUtil.runOnUiThread {
            holders = maxOf(0, holders - 1)
            apply()
        }
    }

    private fun apply() {
        val window = reactApplicationContext.currentActivity?.window ?: return
        if (holders > 0) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }
}
