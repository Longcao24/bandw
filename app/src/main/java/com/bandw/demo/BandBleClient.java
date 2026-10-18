package com.bandw.demo;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.*;
import android.bluetooth.le.*;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.provider.Settings;
import android.util.Log;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * BLE receiver owned by the Activity (kept alive in the background by {@link BandLinkService}).
 * All mutable state and callbacks are serialized on the UI thread. An unexpected link loss is
 * retried with backoff on the last chosen band; only {@link #disconnect} or {@link #release} stop it.
 */
@SuppressLint("MissingPermission") // Checked at entry and guarded against permission revocation.
final class BandBleClient {
    static final int PERMISSIONS = 71;
    static final UUID SERVICE = UUID.fromString("c91b0001-7d7a-4f8c-9d29-6e44c786a321");
    static final UUID COMMAND = UUID.fromString("c91b0002-7d7a-4f8c-9d29-6e44c786a321");
    static final UUID CONTROL = UUID.fromString("c91b0003-7d7a-4f8c-9d29-6e44c786a321");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final String TAG = "BandW";
    private static final int SCAN_MS = 8000, CONNECT_MS = 15000, CALIBRATION_MS = 30000, SLOW_RETRY_MS = 30000;
    /** Fast retries first; after that the band is retried every SLOW_RETRY_MS until the user disconnects. */
    private static final int[] BACKOFF_MS = {1000, 2000, 4000, 8000, 15000, 15000};
    interface Listener {
        void status(String text);
        void command(String command);
        void calibration(boolean enabled, String text);
        /** True while the user wants the band connected (connecting, connected or reconnecting). */
        void link(boolean active, boolean connected);
    }
    private final Activity activity;
    private final Listener listener;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, BluetoothDevice> devices = new LinkedHashMap<>();
    private BluetoothLeScanner scanner;
    private ScanCallback scan;
    private BluetoothGatt gatt;
    private BluetoothDevice device;
    private AlertDialog picker;
    private boolean ready, calibrationAvailable, calibrating, wanted, startWhenEnabled, askedNotifications, released;
    private BluetoothGattCharacteristic control;
    private int generation, retries;
    private Runnable timeout, calibrationTimeout, retry;
    private final BroadcastReceiver adapterState = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR);
            if (released) return;
            if (state == BluetoothAdapter.STATE_ON) {
                if (startWhenEnabled) { startWhenEnabled = false; start(); }
                else if (wanted && device != null && gatt == null) { retries = 0; reconnectNow(); }
            } else if (state == BluetoothAdapter.STATE_TURNING_OFF || state == BluetoothAdapter.STATE_OFF) {
                if (wanted && device != null) {
                    teardown();
                    listener.status("Bluetooth đã tắt · Sẽ tự kết nối lại khi bật Bluetooth");
                } else if (scan != null || picker != null) disconnect("Bluetooth đã tắt.");
            }
        }
    };

    BandBleClient(Activity activity, Listener listener) {
        this.activity = activity; this.listener = listener;
        activity.registerReceiver(adapterState, new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED));
    }
    private String[] permissions() {
        return Build.VERSION.SDK_INT >= 31
                ? new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}
                : new String[]{Manifest.permission.ACCESS_FINE_LOCATION};
    }
    private boolean granted(String permission) { return activity.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    boolean connected() { return ready; }
    void start() {
        if (released) return;
        if (ready && gatt != null) { listener.status("● Đã kết nối BandW-Sense"); return; }
        if (scan != null || picker != null) return; // Already scanning or choosing; avoid Android's scan throttle.
        List<String> missing = new ArrayList<>();
        for (String permission : permissions()) if (!granted(permission)) missing.add(permission);
        if (Build.VERSION.SDK_INT >= 33 && !askedNotifications && !granted(Manifest.permission.POST_NOTIFICATIONS)) {
            askedNotifications = true; // Optional: shows the "connected" notification; never blocks BLE.
            missing.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!missing.isEmpty()) { activity.requestPermissions(missing.toArray(new String[0]), PERMISSIONS); return; }
        disconnect(null);
        try {
            BluetoothManager manager = activity.getSystemService(BluetoothManager.class);
            BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
            if (adapter == null) { listener.status("Điện thoại không hỗ trợ Bluetooth."); return; }
            if (!adapter.isEnabled()) {
                listener.status("Bật Bluetooth để kết nối · App sẽ tự tìm vòng tay khi Bluetooth bật.");
                startWhenEnabled = true;
                try { activity.startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)); }
                catch (android.content.ActivityNotFoundException ignored) { }
                return;
            }
            if (Build.VERSION.SDK_INT <= 30) {
                LocationManager location = activity.getSystemService(LocationManager.class);
                boolean locationOn = location != null && (location.isProviderEnabled(LocationManager.GPS_PROVIDER)
                        || location.isProviderEnabled(LocationManager.NETWORK_PROVIDER));
                if (!locationOn) { listener.status("Android 8–11 cần bật Vị trí để tìm thiết bị BLE. Bật trong Cài đặt rồi thử lại."); return; }
            }
            scanner = adapter.getBluetoothLeScanner();
            if (scanner == null) { listener.status("Không khởi động được Bluetooth. Hãy thử lại."); return; }
            devices.clear();
            final int session = generation;
            scan = new ScanCallback() {
                @Override public void onScanResult(int type, ScanResult result) {
                    handler.post(() -> {
                        if (session != generation || scan != this) return;
                        try { devices.put(result.getDevice().getAddress(), result.getDevice()); }
                        catch (SecurityException e) { disconnect("Quyền Bluetooth đã bị thu hồi."); }
                    });
                }
                @Override public void onScanFailed(int code) {
                    handler.post(() -> { if (session == generation) disconnect("Không quét được BLE (" + code + "). Hãy thử lại."); });
                }
            };
            listener.status("Đang tìm BandW-Sense trong 8 giây…");
            scanner.startScan(Collections.singletonList(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE)).build()),
                    new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), scan);
            timeout = () -> { if (session == generation) finishScan(); };
            handler.postDelayed(timeout, SCAN_MS);
        } catch (SecurityException | IllegalStateException e) { disconnect("Không truy cập được Bluetooth. Kiểm tra quyền và thử lại."); }
    }
    void permissionResult() {
        for (String permission : permissions()) {
            if (granted(permission)) continue;
            if (!activity.shouldShowRequestPermissionRationale(permission)) {
                listener.status("Quyền Bluetooth đang bị chặn. Mở Cài đặt ứng dụng để cấp quyền.");
                new AlertDialog.Builder(activity).setTitle("Cần quyền Thiết bị lân cận")
                        .setMessage("BandW cần quyền Bluetooth để nhận cử chỉ từ vòng tay. Mở Cài đặt và cho phép quyền này.")
                        .setPositiveButton("Mở Cài đặt", (dialog, which) -> {
                            try { activity.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                    Uri.fromParts("package", activity.getPackageName(), null))); }
                            catch (android.content.ActivityNotFoundException ignored) { }
                        })
                        .setNegativeButton("Để sau", null).show();
            } else listener.status("Chưa cấp quyền tìm vòng tay. Bạn vẫn dùng được các nút mô phỏng.");
            return;
        }
        start();
    }
    private void stopScan() {
        if (timeout != null) handler.removeCallbacks(timeout);
        try { if (scanner != null && scan != null) scanner.stopScan(scan); }
        catch (SecurityException | IllegalStateException ignored) { }
        scan = null; scanner = null;
    }
    private void finishScan() {
        stopScan();
        if (devices.isEmpty()) { listener.status("Không tìm thấy vòng tay. Kiểm tra nguồn và firmware BandW rồi thử lại."); return; }
        List<BluetoothDevice> choices = new ArrayList<>(devices.values());
        String[] labels = new String[choices.size()];
        try {
            for (int i = 0; i < labels.length; i++) labels[i] = "BandW-Sense · " + choices.get(i).getAddress();
        } catch (SecurityException e) { disconnect("Quyền Bluetooth đã bị thu hồi."); return; }
        listener.status("Chọn vòng tay cần kết nối.");
        picker = new AlertDialog.Builder(activity).setTitle("Vòng tay ở gần")
                .setItems(labels, (dialog, index) -> { picker = null; choose(choices.get(index)); })
                .setNegativeButton("Hủy", (dialog, which) -> disconnect("Đã hủy kết nối · Có thể dùng mô phỏng"))
                .setOnCancelListener(dialog -> disconnect("Đã hủy kết nối · Có thể dùng mô phỏng")).show();
    }
    private void choose(BluetoothDevice chosen) {
        device = chosen; wanted = true; retries = 0;
        listener.link(true, false);
        connect(false);
    }
    private void connect(boolean reconnecting) {
        if (device == null) return;
        listener.status(reconnecting ? "Đang kết nối lại vòng tay… (lần " + retries + ")" : "Đang kết nối vòng tay…");
        final int session = generation;
        try {
            gatt = device.connectGatt(activity, false, new BluetoothGattCallback() {
                private void dispatch(BluetoothGatt source, Runnable action) {
                    handler.post(() -> {
                        if (generation != session || source != gatt) return;
                        try { action.run(); }
                        catch (SecurityException | IllegalStateException e) { disconnect("Bluetooth bị ngắt. Kiểm tra quyền rồi kết nối lại."); }
                    });
                }
                @Override public void onConnectionStateChange(BluetoothGatt source, int status, int state) {
                    dispatch(source, () -> {
                        if (status == BluetoothGatt.GATT_SUCCESS && state == BluetoothProfile.STATE_CONNECTED) {
                            listener.status("Đang thiết lập nhận cử chỉ…");
                            source.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH);
                            if (!source.discoverServices()) linkLost("discover", -1);
                        } else if (state != BluetoothProfile.STATE_CONNECTED) linkLost("state", status);
                    });
                }
                @Override public void onServicesDiscovered(BluetoothGatt source, int status) {
                    dispatch(source, () -> {
                        if (status != BluetoothGatt.GATT_SUCCESS) { linkLost("services", status); return; }
                        BluetoothGattService service = source.getService(SERVICE);
                        BluetoothGattCharacteristic characteristic = service == null ? null : service.getCharacteristic(COMMAND);
                        BluetoothGattDescriptor descriptor = characteristic == null ? null : characteristic.getDescriptor(CCCD);
                        if (descriptor == null || (characteristic.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) == 0) {
                            disconnect("Firmware không tương thích. Hãy nạp firmware BandW-Sense."); return;
                        }
                        if (!subscribe(source, characteristic)) linkLost("subscribe", -1);
                    });
                }
                @Override public void onDescriptorWrite(BluetoothGatt source, BluetoothGattDescriptor descriptor, int status) {
                    dispatch(source, () -> {
                        if (!CCCD.equals(descriptor.getUuid())) return;
                        if (status != BluetoothGatt.GATT_SUCCESS) { linkLost("cccd", status); return; }
                        if (COMMAND.equals(descriptor.getCharacteristic().getUuid())) {
                            control = source.getService(SERVICE).getCharacteristic(CONTROL);
                            if (control != null && (control.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0) {
                                if (!subscribe(source, control)) linkLost("subscribe-control", -1);
                                return;
                            }
                        }
                        ready = true;
                        retries = 0;
                        if (timeout != null) handler.removeCallbacks(timeout);
                        source.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_BALANCED);
                        listener.status("● Đã kết nối BandW-Sense");
                        listener.link(true, true);
                        calibrationAvailable = CONTROL.equals(descriptor.getCharacteristic().getUuid());
                        if (calibrationAvailable) {
                            listener.calibration(false, "Đang đọc trạng thái vòng tay…");
                            if (!source.readCharacteristic(control)) listener.calibration(true, "Chưa đọc được trạng thái · Có thể bấm Hiệu chuẩn");
                        } else listener.calibration(false, "Cần cập nhật firmware để hiệu chuẩn từ app.");
                    });
                }
                private void notification(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value) {
                    if (value == null) return;
                    final String text = new String(value, StandardCharsets.US_ASCII).trim();
                    dispatch(source, () -> {
                        if (CONTROL.equals(characteristic.getUuid())) { calibrationState(text); return; }
                        if (!ready || !COMMAND.equals(characteristic.getUuid()) || GestureCommand.parse(text) == null) return;
                        // Firmware only sends gestures once calibrated, so a gesture means READY was missed.
                        if (calibrating) calibrationState("READY");
                        listener.command(text);
                    });
                }
                @Override public void onCharacteristicRead(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value, int status) {
                    if (status == BluetoothGatt.GATT_SUCCESS) notification(source, characteristic, value);
                    else dispatch(source, () -> listener.calibration(true, "Chưa đọc được trạng thái · Có thể bấm Hiệu chuẩn"));
                }
                @Override public void onCharacteristicRead(BluetoothGatt source, BluetoothGattCharacteristic characteristic, int status) {
                    if (Build.VERSION.SDK_INT < 33) onCharacteristicRead(source, characteristic, characteristic.getValue(), status);
                }
                @Override public void onCharacteristicWrite(BluetoothGatt source, BluetoothGattCharacteristic characteristic, int status) {
                    dispatch(source, () -> {
                        if (CONTROL.equals(characteristic.getUuid()) && status != BluetoothGatt.GATT_SUCCESS) calibrationFailed();
                    });
                }
                @Override public void onCharacteristicChanged(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value) {
                    notification(source, characteristic, value);
                }
                @Override public void onCharacteristicChanged(BluetoothGatt source, BluetoothGattCharacteristic characteristic) {
                    if (Build.VERSION.SDK_INT < 33) notification(source, characteristic, characteristic.getValue());
                }
            }, BluetoothDevice.TRANSPORT_LE);
            if (gatt == null) { linkLost("open", -1); return; }
            timeout = () -> { if (session == generation && !ready) linkLost("timeout", -1); };
            handler.postDelayed(timeout, CONNECT_MS);
        } catch (SecurityException | IllegalStateException e) { disconnect("Không kết nối được vòng tay. Kiểm tra Bluetooth và quyền truy cập."); }
    }
    /** Unexpected loss (link drop, status 133/8/62, setup failure or timeout): retry the same band with backoff. */
    private void linkLost(String where, int status) {
        Log.w(TAG, "BLE link lost at " + where + ", status " + status + ", retry " + retries);
        boolean wasReady = ready;
        teardown();
        if (!wanted || device == null) return;
        // Never give up on our own (band out of range or flat battery for a while): only disconnect()/release() stop it.
        int delay = retries < BACKOFF_MS.length ? BACKOFF_MS[retries] : SLOW_RETRY_MS;
        retries++;
        listener.status((wasReady ? "Mất kết nối" : "Kết nối chưa thành công") + " (mã " + status + ") · Tự kết nối lại sau "
                + Math.max(1, delay / 1000) + " giây…");
        final int session = generation;
        retry = () -> { if (session == generation && wanted) connect(true); };
        handler.postDelayed(retry, delay);
    }
    private void reconnectNow() {
        if (retry != null) handler.removeCallbacks(retry);
        retries++;
        connect(true);
    }
    private boolean subscribe(BluetoothGatt source, BluetoothGattCharacteristic characteristic) {
        BluetoothGattDescriptor descriptor = characteristic.getDescriptor(CCCD);
        if (descriptor == null || !source.setCharacteristicNotification(characteristic, true)) return false;
        if (Build.VERSION.SDK_INT >= 33)
            return source.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) == BluetoothStatusCodes.SUCCESS;
        descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
        return source.writeDescriptor(descriptor);
    }
    private void calibrationState(String state) {
        if (!calibrationAvailable) return;
        if ("READY".equals(state)) {
            calibrating = false;
            if (calibrationTimeout != null) handler.removeCallbacks(calibrationTimeout);
            listener.calibration(true, "Đã hiệu chuẩn · Có thể thực hiện cử chỉ");
        } else if ("CALIBRATING".equals(state)) {
            waitingForCalibration();
        }
    }
    private void waitingForCalibration() {
        calibrating = true;
        listener.calibration(false, "Đang hiệu chuẩn — giữ tay yên ở tư thế trung tính trong 2 giây.");
        if (calibrationTimeout != null) handler.removeCallbacks(calibrationTimeout);
        final int session = generation;
        // Non-fatal: keep the link; a later READY still completes calibration.
        calibrationTimeout = () -> {
            if (session != generation || !ready || !calibrating) return;
            calibrating = false;
            listener.calibration(true, "Chưa hiệu chuẩn xong · Giữ tay yên rồi bấm Hiệu chuẩn lại");
        };
        handler.postDelayed(calibrationTimeout, CALIBRATION_MS);
    }
    private void calibrationFailed() {
        calibrating = false;
        if (calibrationTimeout != null) handler.removeCallbacks(calibrationTimeout);
        listener.calibration(ready, "Gửi lệnh hiệu chuẩn thất bại · Hãy thử lại");
    }
    void calibrate() {
        if (!ready || !calibrationAvailable || calibrating || control == null || gatt == null) return;
        waitingForCalibration();
        byte[] value = "CALIBRATE".getBytes(StandardCharsets.US_ASCII);
        try {
            boolean queued;
            if (Build.VERSION.SDK_INT >= 33)
                queued = gatt.writeCharacteristic(control, value, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS;
            else {
                control.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                control.setValue(value);
                queued = gatt.writeCharacteristic(control);
            }
            if (!queued) calibrationFailed();
        } catch (SecurityException | IllegalStateException e) { calibrationFailed(); }
    }
    /** Closes the current GATT and scan but keeps the chosen band and the reconnect intent. */
    private void teardown() {
        generation++;
        boolean wasReady = ready;
        ready = false;
        calibrationAvailable = false; calibrating = false; control = null;
        if (calibrationTimeout != null) handler.removeCallbacks(calibrationTimeout);
        if (retry != null) handler.removeCallbacks(retry);
        listener.calibration(false, "Kết nối vòng tay để hiệu chuẩn.");
        stopScan();
        if (picker != null) { picker.dismiss(); picker = null; }
        BluetoothGatt old = gatt;
        gatt = null;
        if (old != null) {
            try { old.disconnect(); } catch (SecurityException ignored) { }
            try { old.close(); } catch (SecurityException ignored) { }
        }
        if (wasReady && wanted) listener.link(true, false);
    }
    /** Explicit, final disconnect: cancels any automatic reconnect. */
    void disconnect(String status) {
        boolean wasWanted = wanted;
        wanted = false; startWhenEnabled = false; retries = 0;
        teardown();
        if (wasWanted) listener.link(false, false);
        if (status != null) listener.status(status);
    }
    void release() {
        if (released) return;
        disconnect(null);
        released = true;
        handler.removeCallbacksAndMessages(null);
        try { activity.unregisterReceiver(adapterState); } catch (IllegalArgumentException ignored) { }
    }
}
