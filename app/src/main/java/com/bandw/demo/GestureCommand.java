package com.bandw.demo;

import java.util.Locale;

/** Transport-independent commands: simulation and a future BLE receiver share this mapping. */
public enum GestureCommand {
    WATER("Tôi muốn uống nước.", "← Nghiêng tay trái", "#E4EFF9"),
    FOOD("Tôi muốn ăn.", "→ Nghiêng tay phải", "#F6EFCF"),
    NO("Không.", "↔ Lắc cổ tay", "#FCEAE5");

    public final String phrase;
    public final String label;
    public final String color;

    GestureCommand(String phrase, String label, String color) {
        this.phrase = phrase;
        this.label = label;
        this.color = color;
    }

    public static GestureCommand parse(String raw) {
        if (raw == null) return null;
        try { return valueOf(raw.trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException e) { return null; }
    }
}
