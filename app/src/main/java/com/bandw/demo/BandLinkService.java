package com.bandw.demo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Keeps the process in the foreground while the band link is wanted, so screen-off, Home or opening
 * Settings no longer freezes the app and its BLE/TTS. The link itself stays in {@link BandBleClient}.
 */
public class BandLinkService extends Service {
    private static final String CHANNEL = "band-link";
    private static final String EXTRA_TEXT = "text";

    static void update(Context context, boolean active, String text) {
        Intent intent = new Intent(context, BandLinkService.class).putExtra(EXTRA_TEXT, text);
        try {
            if (!active) context.stopService(intent);
            else context.startForegroundService(intent);
        } catch (RuntimeException ignored) {
            // Background start not allowed (Android 12+) or missing permission: BLE still works while the app is visible.
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(
                new NotificationChannel(CHANNEL, "Kết nối vòng tay", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_IMMUTABLE);
        String text = intent == null ? null : intent.getStringExtra(EXTRA_TEXT);
        Notification notification = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_bandw)
                .setContentTitle("BandW đang lắng nghe vòng tay")
                .setContentText(text == null ? "Giữ kết nối để đọc cử chỉ khi tắt màn hình" : text)
                .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            else startForeground(1, notification);
        } catch (RuntimeException e) { stopSelf(); }
        return START_NOT_STICKY;
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
