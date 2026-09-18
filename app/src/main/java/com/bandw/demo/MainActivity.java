package com.bandw.demo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.ViewGroup;
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
    private Button replay, stop;
    private GestureCommand current;
    private boolean speechReady, destroyed, autoSpeak = true;
    private BandBleClient ble;
    private TextView connectionStatus, calibrationStatus;
    private Button calibrate;
    private int speechGeneration;
    private String activeUtterance;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setVolumeControlStream(android.media.AudioManager.STREAM_MUSIC);
        autoSpeak = getPreferences(MODE_PRIVATE).getBoolean("autoSpeak", true);
        if (state != null) {
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
            public void command(String value) { receiveCommand(value, "Vòng tay"); }
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

        TextView brand = text("bandw   /   VÒNG TAY GIAO TIẾP", 13, true);
        brand.setTextColor(Color.parseColor("#215C47"));
        connectionPanel.addView(brand);
        add(page, text("Một cử chỉ.\nMột lời nói.", 34, true), 18);
        add(page, text("Chạm để mô phỏng điều bạn muốn nói.", 16, false), 8);
        TextView mode = text("●  CHẾ ĐỘ MÔ PHỎNG  ·  Chưa kết nối vòng tay", 12, true);
        mode.setPadding(dp(14), dp(12), dp(14), dp(12));
        mode.setBackground(background("#E8EDDF", 14));
        add(connectionPanel, mode, 10);
        connectionStatus = mode;
        add(connectionPanel, button("Kết nối vòng tay", "#D5F28B", () -> ble.start()), 10);
        add(connectionPanel, button("Ngắt kết nối", "#FFFFFF", () -> ble.disconnect("Đã ngắt kết nối · Có thể dùng mô phỏng")), 6);
        calibrate = button("Hiệu chuẩn vòng tay", "#D5F28B", () -> { stopSpeech(); ble.calibrate(); });
        calibrate.setEnabled(false); calibrate.setAlpha(0.45f);
        add(connectionPanel, calibrate, 6);
        calibrationStatus = text("Kết nối vòng tay để hiệu chuẩn.", 13, false);
        calibrationStatus.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        add(connectionPanel, calibrationStatus, 6);

        LinearLayout message = column();
        message.setPadding(dp(22), dp(22), dp(22), dp(22));
        message.setBackground(background("#215C47", 24));
        TextView caption = text("LỜI NHẮN CỦA BẠN", 12, true);
        caption.setTextColor(Color.parseColor("#D5F28B"));
        message.addView(caption);
        phraseView = text(current == null ? "Bạn muốn nói\nđiều gì?" : current.phrase, 29, true);
        phraseView.setTextColor(Color.WHITE);
        phraseView.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        add(message, phraseView, 16);
        commandView = text(current == null ? "Chọn một lệnh bên dưới để bắt đầu" : "Đã nhận: " + current.name(), 13, false);
        commandView.setTextColor(Color.parseColor("#E0EADD"));
        add(message, commandView, 14);
        replay = button("Đọc lại", "#D5F28B", () -> speakCurrent());
        replay.setEnabled(false);
        add(message, replay, 18);
        add(page, message, 16);
        add(page, text("MÔ PHỎNG CỬ CHỈ", 12, true), 26);
        for (GestureCommand command : GestureCommand.values()) {
            Button trigger = button(command.label + "   →   " + command.name(), command.color,
                    () -> receiveCommand(command.name()));
            trigger.setContentDescription("Simulate " + command.name() + ". " + command.phrase);
            add(page, trigger, 10);
        }
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
        });
        add(page, automatic, 18);
        speechStatus = text("Đang chuẩn bị giọng đọc tiếng Việt…", 14, false);
        add(page, speechStatus, 6);
        stop = button("Dừng đọc", "#E8EDDF", this::stopSpeech);
        stop.setEnabled(false);
        add(page, stop, 10);
        add(page, button("Cài đặt giọng đọc", "#FFFFFF", () -> {
            try { startActivity(new Intent("com.android.settings.TTS_SETTINGS")); }
            catch (ActivityNotFoundException e) {
                try { startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS)); }
                catch (ActivityNotFoundException ignored) { speechStatus.setText("Hãy mở Cài đặt trên điện thoại để chọn giọng tiếng Việt."); }
            }
        }), 6);
        add(page, button("Kiểm tra lại giọng đọc", "#FFFFFF", this::initSpeech), 6);
        add(page, text("LỆNH GẦN ĐÂY", 12, true), 24);
        historyView = text("", 14, false);
        historyView.setLineSpacing(dp(8), 1);
        add(page, historyView, 10);
        renderHistory();
        add(page, text("Demo 02 · XIAO nRF52840 Sense\nGiữ app mở để nhận cử chỉ từ vòng tay.", 12, false), 26);
    }

    /** Simulation and BLE use the same phrase and speech pipeline, on the main thread. */
    public void receiveCommand(String raw) { receiveCommand(raw, "Mô phỏng"); }
    private void receiveCommand(String raw, String source) {
        GestureCommand command = GestureCommand.parse(raw);
        if (command == null) return;
        current = command;
        phraseView.setText(command.phrase);
        commandView.setText("Đã nhận: " + command.name() + " · " + source);
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
            speech.setAudioAttributes(new android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH).build());
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
            if (!speaking) activeUtterance = null;
        });
    }

    private void speakCurrent() {
        if (!speechReady || current == null) return;
        activeUtterance = "command-" + System.nanoTime();
        speechStatus.setText("Đang chuẩn bị đọc…");
        stop.setEnabled(true);
        if (speech.speak(current.phrase, TextToSpeech.QUEUE_FLUSH, null, activeUtterance) == TextToSpeech.ERROR) {
            activeUtterance = null;
            stop.setEnabled(false);
            speechStatus.setText("Không phát được âm thanh. Hãy kiểm tra lại giọng đọc.");
        }
    }

    private void stopSpeech() {
        activeUtterance = null;
        if (speech != null) speech.stop();
        if (stop != null) stop.setEnabled(false);
        if (speechReady) speechStatus.setText("Đã dừng đọc · Tiếng Việt");
    }

    private void renderHistory() {
        historyView.setText(history.isEmpty() ? "Chưa có lệnh nào. Hãy thử một cử chỉ." : String.join("\n\n", history));
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (current != null) state.putString("command", current.name());
        state.putStringArrayList("history", history);
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == BandBleClient.PERMISSIONS && !destroyed) ble.permissionResult();
    }
    @Override protected void onStop() {
        stopSpeech();
        if (ble != null) ble.disconnect("Chưa kết nối · Bấm Kết nối vòng tay để nhận cử chỉ");
        super.onStop();
    }
    @Override protected void onDestroy() {
        destroyed = true;
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
