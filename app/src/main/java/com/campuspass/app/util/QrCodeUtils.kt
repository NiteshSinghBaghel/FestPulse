package com.campuspass.app.util

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import java.security.MessageDigest

object QrCodeUtils {

    fun generateQrBitmap(content: String, sizePx: Int = 512): Bitmap? {
        if (content.isBlank()) return null
        return try {
            val hints = mapOf(
                EncodeHintType.MARGIN to 1,
                EncodeHintType.CHARACTER_SET to "UTF-8"
            )
            val bitMatrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
            val width = bitMatrix.width
            val height = bitMatrix.height
            val pixels = IntArray(width * height)
            for (y in 0 until height) {
                val offset = y * width
                for (x in 0 until width) {
                    pixels[offset + x] = if (bitMatrix[x, y]) Color.parseColor("#0F172A") else Color.WHITE
                }
            }
            Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
                setPixels(pixels, 0, width, 0, 0, width, height)
            }
        } catch (_: Exception) {
            null
        }
    }

    fun sha256Short(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }.take(32)
    }

    fun generateSixDigitPin(seed: String? = null): String {
        return if (!seed.isNullOrBlank()) {
            val hash = kotlin.math.abs(seed.hashCode())
            ((hash % 900000) + 100000).toString()
        } else {
            ((100000..999999).random()).toString()
        }
    }

    data class ParsedQrTicket(
        val ticketId: String,
        val eventId: String?,
        val qrToken: String,
        val userName: String?,
        val rollNo: String?,
        val college: String?,
        val qrHash: String?
    )

    fun parseQrInput(raw: String): ParsedQrTicket? {
        val trimmed = raw.trim()
        if (trimmed.isBlank()) return null
        if (trimmed.startsWith("CAMPUSPASS|")) {
            val parts = trimmed.split("|")
            if (parts.size >= 4) {
                return ParsedQrTicket(
                    ticketId = parts.getOrNull(1).orEmpty().trim(),
                    eventId = parts.getOrNull(2)?.trim()?.takeIf { it.isNotEmpty() },
                    qrToken = parts.getOrNull(3).orEmpty().trim(),
                    userName = parts.getOrNull(4)?.trim()?.takeIf { it.isNotEmpty() },
                    rollNo = parts.getOrNull(5)?.trim()?.takeIf { it.isNotEmpty() },
                    college = parts.getOrNull(6)?.trim()?.takeIf { it.isNotEmpty() },
                    qrHash = parts.getOrNull(7)?.trim()?.takeIf { it.isNotEmpty() }
                )
            }
        }
        // Fallback: manual Ticket ID or qrToken entry
        return ParsedQrTicket(
            ticketId = trimmed,
            eventId = null,
            qrToken = trimmed,
            userName = null,
            rollNo = null,
            college = null,
            qrHash = null
        )
    }
}
