package com.bandw.demo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private final int ink = Color.rgb(30, 49, 42);
    private final ArrayList<String> history = new ArrayList<>();
    private TextToSpeech speech;
    private TextView phraseView, commandView, speechStatus, historyView;
    private Button replay, stop, demoToggle;
    private LinearLayout demoPanel, devicePanel;
    private boolean demoMode;
    private GestureCommand current;
    private boolean speechReady, destroyed, bandConnected, autoSpeak = true;
    private BandBleClient ble;
    private TextView connectionStatus, calibrationStatus;
    private Button calibrate;
    private int speechGeneration;
    private String activeUtterance;
    private AudioManager audio;
    private final AudioAttributes speechAudio = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
    private AudioFocusRequest focus;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setVolumeControlStream(AudioManager.STREAM_MUSIC); // Matches USAGE_MEDIA used for speech.
        audio = getSystemService(AudioManager.class);
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(speechAudio).build();
        autoSpeak = getPreferences(MODE_PRIVATE).getBoolean("autoSpeak", true);
        if (state != null) {
            demoMode = state.getBoolean("demoMode", false);
            current = GestureCommand.parse(state.getString("command"));
            ArrayList<String> saved = state.getStringArrayList("history");
            if (saved != null) history.addAll(saved);
        }
        buildScreen();
        ble = new BandBleClient(this, new BandBleClient.Listener() {
            public void status(String value) { connectionStatus.setText(value); }
            public void calibration(boolean enabled, String value) {
                calibrate.setEnabled(enabled);
                calibrate.setAlpha(enabled ? 1f : 0.45f);
                calibrationStatus.setText(value);
            }
            public void command(String value) {
                if (!demoMode) { receiveCommand(value, "Vòng tay"); return; }
                GestureCommand ignored = GestureCommand.parse(value);
                if (ignored != null) commandView.setText("Demo mode · Bỏ qua " + ignored.label + " từ vòng tay");
            }
            public void link(boolean active, boolean connected) {
                bandConnected = connected;
                // Keep the screen on and the process in the foreground while the band is in use.
                if (active) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                BandLinkService.update(MainActivity.this, active, connected ? "Đã kết nối BandW-Sense" : "Đang kết nối lại vòng tay…");
                if (current == null) applyMode();
            }
        });
        initSpeech();
    }

    private void buildScreen() {
        LinearLayout root = column();
        root.setBackgroundColor(Color.parseColor("#F6F7F2"));
        LinearLayout connectionPanel = column();
        connectionPanel.setPadding(dp(24), dp(12), dp(24), dp(12));
        root.addView(connectionPanel);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.parseColor("#F6F7F2"));
        LinearLayout page = column();
        page.setPadding(dp(24), dp(20), dp(24), dp(24));
        scroll.addView(page);
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(root);
        root.requestApplyInsets();

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);
        demoToggle = button("Demo", "#E8EDDF", this::toggleDemo);
        toolbar.addView(demoToggle);
        TextView brand = text("bandw", 24, true);
        brand.setGravity(android.view.Gravity.END);
        toolbar.addView(brand, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        connectionPanel.addView(toolbar);

        devicePanel = column();
        add(page, devicePanel, 0);
        connectionStatus = text("Chưa kết nối vòng tay", 15, false);
        connectionStatus.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        devicePanel.addView(connectionStatus);
        add(devicePanel, button("Kết nối vòng tay", "#D5F28B", () -> ble.start()), 12);
        calibrate = button("Hiệu chuẩn", "#E8EDDF", () -> { stopSpeech(); ble.calibrate(); });
        calibrate.setEnabled(false); calibrate.setAlpha(0.45f);
        add(devicePanel, calibrate, 8);
        calibrationStatus = text("Kết nối rồi giữ tay yên để hiệu chuẩn.", 13, false);
        calibrationStatus.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        add(devicePanel, calibrationStatus, 8);

        LinearLayout message = column();
        message.setPadding(dp(22), dp(22), dp(22), dp(22));
        message.setBackground(background("#215C47", 24));
        TextView caption = text("LỜI NHẮN CỦA BẠN", 12, true);
        caption.setTextColor(Color.parseColor("#D5F28B"));
        message.addView(caption);
        phraseView = text(current == null ? "Sẵn sàng\nlắng nghe." : current.phrase, 29, true);
        phraseView.setTextColor(Color.WHITE);
        phraseLiveRegion();
        add(message, phraseView, 16);
        commandView = text(current == null ? "Kết nối vòng tay để bắt đầu" : "Đã nhận: " + current.name(), 13, false);
        commandView.setTextColor(Color.parseColor("#E0EADD"));
        add(message, commandView, 14);
        replay = button("Đọc lại", "#D5F28B", () -> speakCurrent());
        replay.setEnabled(false);
        add(message, replay, 18);
        add(page, message, 16);
        demoPanel = column();
        add(demoPanel, text("Chạm để thử cử chỉ", 18, true), 0);
        add(demoPanel, text("Demo mode · Không nhận cử chỉ từ vòng tay", 13, false), 6);
        for (GestureCommand command : GestureCommand.values()) {
            Button trigger = button(command.label, command.color,
                    () -> receiveCommand(command.name()));
            trigger.setContentDescription(command.label + ". " + command.phrase);
            add(demoPanel, trigger, 10);
        }
        add(page, demoPanel, 20);
        speechStatus = text("Đang chuẩn bị giọng đọc tiếng Việt…", 13, false);
        add(page, speechStatus, 16);
        stop = button("Dừng đọc", "#E8EDDF", this::stopSpeech);
        stop.setEnabled(false);
        add(page, stop, 8);

        LinearLayout settings = column();
        settings.setVisibility(View.GONE);
        Button settingsToggle = button("Tùy chọn", "#FFFFFF", () ->
                settings.setVisibility(settings.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE));
        add(page, settingsToggle, 20);
        add(page, settings, 0);
        add(settings, button("Ngắt kết nối vòng tay", "#FFFFFF", () -> ble.disconnect("Đã ngắt kết nối")), 8);
        Switch automatic = new Switch(this);
        automatic.setText("Tự động đọc khi nhận lệnh");
        automatic.setTextSize(16);
        automatic.setTextColor(ink);
        automatic.setMinHeight(dp(56));
        automatic.setChecked(autoSpeak);
        automatic.setOnCheckedChangeListener((view, enabled) -> {
            autoSpeak = enabled;
            getPreferences(MODE_PRIVATE).edit().putBoolean("autoSpeak", enabled).apply();
            if (!enabled) stopSpeech();
            phraseLiveRegion();
        });
        add(settings, automatic, 8);
        add(settings, button("Cài đặt giọng đọc", "#FFFFFF", () -> {
            try { startActivity(new Intent("com.android.settings.TTS_SETTINGS")); }
            catch (ActivityNotFoundException e) {
                try { startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS)); }
                catch (ActivityNotFoundException ignored) { speechStatus.setText("Hãy mở Cài đặt trên điện thoại để chọn giọng tiếng Việt."); }
            }
        }), 6);
        add(settings, button("Kiểm tra lại giọng đọc", "#FFFFFF", this::initSpeech), 6);
        add(settings, text("LỆNH GẦN ĐÂY", 12, true), 24);
        historyView = text("", 14, false);
        historyView.setLineSpacing(dp(8), 1);
        add(settings, historyView, 10);
        renderHistory();
        applyMode();
    }

    /** With auto-speak on, TTS already reads the phrase; a live region would make TalkBack read it twice. */
    private void phraseLiveRegion() {
        phraseView.setAccessibilityLiveRegion(autoSpeak ? View.ACCESSIBILITY_LIVE_REGION_NONE : View.ACCESSIBILITY_LIVE_REGION_POLITE);
    }

    private void toggleDemo() {
        stopSpeech();
        demoMode = !demoMode;
        current = null;
        replay.setEnabled(false);
        applyMode();
    }

    private void applyMode() {
        demoToggle.setText(demoMode ? "← Vòng tay" : "Demo");
        demoToggle.setContentDescription(demoMode ? "Thoát Demo mode" : "Vào Demo mode");
        demoPanel.setVisibility(demoMode ? View.VISIBLE : View.GONE);
        devicePanel.setVisibility(demoMode ? View.GONE : View.VISIBLE);
        if (current == null) {
            phraseView.setText(demoMode ? "Bạn muốn nói\nđiều gì?" : "Sẵn sàng\nlắng nghe.");
            commandView.setText(demoMode ? "Chọn một cử chỉ bên dưới"
                    : bandConnected ? "Vòng tay đã kết nối · Hãy thực hiện cử chỉ" : "Thực hiện cử chỉ khi vòng tay đã kết nối");
        }
    }

    /** Simulation and BLE use the same phrase and speech pipeline, on the main thread. */
    public void receiveCommand(String raw) { receiveCommand(raw, "Mô phỏng"); }
    private void receiveCommand(String raw, String source) {
        GestureCommand command = GestureCommand.parse(raw);
        if (command == null) return;
        current = command;
        phraseView.setText(command.phrase);
        commandView.setText(command.label + " · " + source);
        String time = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        history.add(0, time + "   ·   " + command.name() + " · " + source + "\n" + command.phrase);
        if (history.size() > 5) history.remove(history.size() - 1);
        renderHistory();
        replay.setEnabled(speechReady);
        if (autoSpeak) speakCurrent();
    }

    private void initSpeech() {
        speechReady = false;
        activeUtterance = null;
        replay.setEnabled(false);
        stop.setEnabled(false);
        speechStatus.setText("Đang chuẩn bị giọng đọc tiếng Việt…");
        if (speech != null) { speech.stop(); speech.shutdown(); }
        final int generation = ++speechGeneration;
        speech = new TextToSpeech(this, status -> runOnUiThread(() -> {
            if (destroyed || generation != speechGeneration) return;
            if (status != TextToSpeech.SUCCESS) {
                speechStatus.setText("Không khởi động được giọng đọc. Kiểm tra bộ máy chuyển văn bản thành giọng nói trong Cài đặt.");
                return;
            }
            int language = speech.setLanguage(Locale.forLanguageTag("vi-VN"));
            if (language < TextToSpeech.LANG_AVAILABLE) {
                speechStatus.setText("Chưa có giọng tiếng Việt. Mở Cài đặt giọng đọc, chọn hoặc tải tiếng Việt rồi bấm Kiểm tra lại.");
                return;
            }
            speech.setAudioAttributes(speechAudio);
            speech.setSpeechRate(0.9f);
            speech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { updateVoice(id, "Đang đọc…", true); }
                @Override public void onDone(String id) { updateVoice(id, "Đã đọc xong · Tiếng Việt", false); }
                @Override public void onError(String id) { updateVoice(id, "Không phát được âm thanh. Kiểm tra giọng đọc hoặc kết nối mạng rồi thử lại.", false); }
            });
            speechReady = true;
            replay.setEnabled(current != null);
            speechStatus.setText("Giọng đọc tiếng Việt đã sẵn sàng");
        }));
    }

    private void updateVoice(String id, String status, boolean speaking) {
        runOnUiThread(() -> {
            if (destroyed || !id.equals(activeUtterance)) return;
            speechStatus.setText(status);
            stop.setEnabled(speaking);
            if (!speaking) { activeUtterance = null; releaseFocus(); }
        });
    }

    private void speakCurrent() {
        if (!speechReady || current == null) return;
        activeUtterance = "command-" + System.nanoTime();
        speechStatus.setText("Đang chuẩn bị đọc…");
        stop.setEnabled(true);
        if (audio != null) audio.requestAudioFocus(focus);
        if (speech.speak(current.phrase, TextToSpeech.QUEUE_FLUSH, null, activeUtterance) == TextToSpeech.ERROR) {
            activeUtterance = null;
            releaseFocus();
            stop.setEnabled(false);
            speechStatus.setText("Không phát được âm thanh. Hãy kiểm tra lại giọng đọc.");
        }
    }

    private void stopSpeech() {
        activeUtterance = null;
        if (speech != null) speech.stop();
        releaseFocus();
        if (stop != null) stop.setEnabled(false);
        if (speechReady) speechStatus.setText("Đã dừng đọc · Tiếng Việt");
    }

    private void releaseFocus() { if (audio != null) audio.abandonAudioFocusRequest(focus); }

    private void renderHistory() {
        historyView.setText(history.isEmpty() ? "Chưa có lệnh nào. Hãy thử một cử chỉ." : String.join("\n\n", history));
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (current != null) state.putString("command", current.name());
        state.putStringArrayList("history", history);
        state.putBoolean("demoMode", demoMode);
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == BandBleClient.PERMISSIONS && !destroyed) ble.permissionResult();
    }
    /** Screen-off, Home and Settings only stop the Activity: BLE and speech keep running (see BandLinkService). */
    @Override protected void onRestart() {
        super.onRestart();
        if (!speechReady) initSpeech(); // e.g. back from installing a Vietnamese voice.
    }
    /** Before Android 12, Back finishes the root Activity and would end the band link; keep it like Home instead. */
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() { moveTaskToBack(true); }
    @Override protected void onDestroy() {
        destroyed = true;
        if (ble != null) ble.release();
        BandLinkService.update(this, false, null);
        releaseFocus();
        if (speech != null) { speech.stop(); speech.shutdown(); }
        super.onDestroy();
    }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private LinearLayout column() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }
    private TextView text(String value, int size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value); view.setTextSize(size); view.setTextColor(ink);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }
    private GradientDrawable background(String color, int radius) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(Color.parseColor(color)); shape.setCornerRadius(dp(radius));
        return shape;
    }
    private Button button(String label, String color, Runnable action) {
        Button button = new Button(this);
        button.setText(label); button.setTextSize(16); button.setAllCaps(false);
        button.setTextColor(ink); button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setMinHeight(dp(58)); button.setPadding(dp(16), dp(12), dp(16), dp(12));
        button.setBackground(new android.graphics.drawable.RippleDrawable(
                android.content.res.ColorStateList.valueOf(0x22215C47), background(color, 16), null));
        button.setOnClickListener(v -> action.run());
        return button;
    }
    private void add(LinearLayout parent, View child, int top) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(top); parent.addView(child, params);
    }
}
