package com.bandw.demo;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.*;
import android.bluetooth.le.*;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Foreground-only BLE receiver. All mutable state and callbacks are serialized on the UI thread. */
@SuppressLint("MissingPermission") // Checked at entry and guarded against permission revocation.
final class BandBleClient {
    static final int PERMISSIONS = 71;
    static final UUID SERVICE = UUID.fromString("c91b0001-7d7a-4f8c-9d29-6e44c786a321");
    static final UUID COMMAND = UUID.fromString("c91b0002-7d7a-4f8c-9d29-6e44c786a321");
    static final UUID CONTROL = UUID.fromString("c91b0003-7d7a-4f8c-9d29-6e44c786a321");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    interface Listener { void status(String text); void command(String command); void calibration(boolean enabled, String text); }
    private final Activity activity;
    private final Listener listener;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, BluetoothDevice> devices = new LinkedHashMap<>();
    private BluetoothLeScanner scanner;
    private ScanCallback scan;
    private BluetoothGatt gatt;
    private AlertDialog picker;
    private boolean ready, calibrationAvailable, calibrating;
    private Runnable calibrationTimeout;
    private BluetoothGattCharacteristic control;
    private int generation;
    private Runnable timeout;

    BandBleClient(Activity activity, Listener listener) { this.activity = activity; this.listener = listener; }
    private String[] permissions() {
        return Build.VERSION.SDK_INT >= 31
                ? new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}
                : new String[]{Manifest.permission.ACCESS_FINE_LOCATION};
    }
    void start() {
        for (String permission : permissions()) {
            if (activity.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                activity.requestPermissions(permissions(), PERMISSIONS);
                return;
            }
        }
        disconnect(null);
        try {
            BluetoothManager manager = activity.getSystemService(BluetoothManager.class);
            BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
            if (adapter == null) { listener.status("Điện thoại không hỗ trợ Bluetooth."); return; }
            if (!adapter.isEnabled()) {
                listener.status("Bật Bluetooth rồi bấm Kết nối vòng tay lần nữa.");
                activity.startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE));
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
            handler.postDelayed(timeout, 8000);
        } catch (SecurityException | IllegalStateException e) { disconnect("Không truy cập được Bluetooth. Kiểm tra quyền và thử lại."); }
    }
    void permissionResult() {
        for (String permission : permissions()) {
            if (activity.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                listener.status("Chưa cấp quyền tìm vòng tay. Bạn vẫn dùng được các nút mô phỏng."); return;
            }
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
                .setItems(labels, (dialog, index) -> connect(choices.get(index)))
                .setNegativeButton("Hủy", (dialog, which) -> disconnect("Đã hủy kết nối · Có thể dùng mô phỏng"))
                .setOnCancelListener(dialog -> disconnect("Đã hủy kết nối · Có thể dùng mô phỏng")).show();
    }
    private void connect(BluetoothDevice device) {
        listener.status("Đang kết nối vòng tay…");
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
                        if (status != BluetoothGatt.GATT_SUCCESS || state == BluetoothProfile.STATE_DISCONNECTED) {
                            disconnect("Mất kết nối vòng tay. Bấm Kết nối để thử lại.");
                        } else if (state == BluetoothProfile.STATE_CONNECTED) {
                            listener.status("Đang thiết lập nhận cử chỉ…");
                            if (!source.discoverServices()) disconnect("Không đọc được dịch vụ BLE. Hãy kết nối lại.");
                        }
                    });
                }
                @Override public void onServicesDiscovered(BluetoothGatt source, int status) {
                    dispatch(source, () -> {
                        BluetoothGattService service = source.getService(SERVICE);
                        BluetoothGattCharacteristic characteristic = service == null ? null : service.getCharacteristic(COMMAND);
                        BluetoothGattDescriptor descriptor = characteristic == null ? null : characteristic.getDescriptor(CCCD);
                        if (status != BluetoothGatt.GATT_SUCCESS || descriptor == null
                                || (characteristic.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) == 0
                                || !source.setCharacteristicNotification(characteristic, true)) {
                            disconnect("Firmware không tương thích. Hãy nạp firmware BandW-Sense."); return;
                        }
                        if (!subscribe(source, characteristic)) disconnect("Không đăng ký được cử chỉ. Hãy kết nối lại.");
                    });
                }
                @Override public void onDescriptorWrite(BluetoothGatt source, BluetoothGattDescriptor descriptor, int status) {
                    dispatch(source, () -> {
                        if (!CCCD.equals(descriptor.getUuid())) return;
                        if (status != BluetoothGatt.GATT_SUCCESS) { disconnect("Không bật được thông báo BLE. Hãy thử lại."); return; }
                        if (COMMAND.equals(descriptor.getCharacteristic().getUuid())) {
                            control = source.getService(SERVICE).getCharacteristic(CONTROL);
                            if (control != null && (control.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0) {
                                if (!subscribe(source, control)) disconnect("Không nhận được trạng thái hiệu chuẩn. Hãy kết nối lại.");
                                return;
                            }
                        }
                        ready = true;
                        if (timeout != null) handler.removeCallbacks(timeout);
                        listener.status("● Đã kết nối BandW-Sense");
                        calibrationAvailable = CONTROL.equals(descriptor.getCharacteristic().getUuid());
                        if (calibrationAvailable) {
                            listener.calibration(false, "Đang đọc trạng thái vòng tay…");
                            if (!source.readCharacteristic(control)) disconnect("Không đọc được trạng thái hiệu chuẩn.");
                        } else listener.calibration(false, "Cần cập nhật firmware để hiệu chuẩn từ app.");
                    });
                }
                private void notification(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value) {
                    if (value == null) return;
                    final String command = new String(value, StandardCharsets.US_ASCII);
                    dispatch(source, () -> {
                        if (CONTROL.equals(characteristic.getUuid())) { calibrationState(command); return; }
                        if (ready && !calibrating && COMMAND.equals(characteristic.getUuid()) && GestureCommand.parse(command) != null) listener.command(command);
                    });
                }
                @Override public void onCharacteristicRead(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value, int status) {
                    if (status == BluetoothGatt.GATT_SUCCESS) notification(source, characteristic, value);
                    else dispatch(source, () -> disconnect("Không đọc được trạng thái hiệu chuẩn. Hãy kết nối lại."));
                }
                @Override public void onCharacteristicRead(BluetoothGatt source, BluetoothGattCharacteristic characteristic, int status) {
                    if (Build.VERSION.SDK_INT < 33) onCharacteristicRead(source, characteristic, characteristic.getValue(), status);
                }
                @Override public void onCharacteristicWrite(BluetoothGatt source, BluetoothGattCharacteristic characteristic, int status) {
                    dispatch(source, () -> {
                        if (CONTROL.equals(characteristic.getUuid()) && status != BluetoothGatt.GATT_SUCCESS)
                            disconnect("Gửi lệnh hiệu chuẩn thất bại. Hãy kết nối lại.");
                    });
                }
                @Override public void onCharacteristicChanged(BluetoothGatt source, BluetoothGattCharacteristic characteristic, byte[] value) {
                    notification(source, characteristic, value);
                }
                @Override public void onCharacteristicChanged(BluetoothGatt source, BluetoothGattCharacteristic characteristic) {
                    if (Build.VERSION.SDK_INT < 33) notification(source, characteristic, characteristic.getValue());
                }
            }, BluetoothDevice.TRANSPORT_LE);
            if (gatt == null) { disconnect("Không mở được kết nối BLE."); return; }
            timeout = () -> { if (session == generation && !ready) disconnect("Kết nối quá thời gian. Kiểm tra vòng tay rồi thử lại."); };
            handler.postDelayed(timeout, 15000);
        } catch (SecurityException | IllegalStateException e) { disconnect("Không kết nối được vòng tay. Kiểm tra Bluetooth và quyền truy cập."); }
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
        calibrationTimeout = () -> disconnect("Chưa hiệu chuẩn được sau 30 giây. Giữ tay yên, đổi tư thế rồi kết nối lại.");
        handler.postDelayed(calibrationTimeout, 30000);
    }
    void calibrate() {
        if (!ready || !calibrationAvailable || calibrating || control == null) return;
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
            if (!queued) disconnect("Không gửi được lệnh hiệu chuẩn. Hãy kết nối lại.");
        } catch (SecurityException | IllegalStateException e) { disconnect("Bluetooth bị ngắt khi gửi lệnh hiệu chuẩn."); }
    }
    void disconnect(String status) {
        generation++;
        ready = false;
        calibrationAvailable = false; calibrating = false; control = null;
        if (calibrationTimeout != null) handler.removeCallbacks(calibrationTimeout);
        listener.calibration(false, "Kết nối vòng tay để hiệu chuẩn.");
        stopScan();
        if (picker != null) { picker.dismiss(); picker = null; }
        BluetoothGatt old = gatt;
        gatt = null;
        if (old != null) {
            try { old.disconnect(); } catch (SecurityException ignored) { }
            try { old.close(); } catch (SecurityException ignored) { }
        }
        if (status != null) listener.status(status);
    }
}
