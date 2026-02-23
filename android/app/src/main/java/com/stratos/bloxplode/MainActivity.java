package com.stratos.bloxplode;

import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowManager;
import android.graphics.Color;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ---------------------------------------------------------
        // 1. EXISTING VISUAL SETTINGS (Notch & Transparency)
        // ---------------------------------------------------------
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        getWindow().setStatusBarColor(Color.TRANSPARENT);
        hideSystemUI();

        // ---------------------------------------------------------
        // 2. NEW: INJECT NATIVE HAPTIC BRIDGE
        // This allows JavaScript to call window.AndroidNative.rumble()
        // ---------------------------------------------------------
        this.getBridge().getWebView().addJavascriptInterface(new NativeHapticInterface(this), "AndroidNative");
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemUI();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    private void hideSystemUI() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    // =========================================================
    //  THE NATIVE INTERFACE CLASS (This bypasses Silent Mode)
    // =========================================================
    public class NativeHapticInterface {
        Context mContext;

        NativeHapticInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void rumble(long milliseconds) {
            // Get the raw system vibrator service
            Vibrator v = (Vibrator) mContext.getSystemService(Context.VIBRATOR_SERVICE);

            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // "DEFAULT_AMPLITUDE" forces the motor to hit hard, overriding "Touch Feedback" filters
                    v.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    // Legacy Fallback for older Androids
                    v.vibrate(milliseconds);
                }
            }
        }
    }
}