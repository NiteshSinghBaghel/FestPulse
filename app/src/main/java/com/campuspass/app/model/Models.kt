package com.campuspass.app.model

enum class UserRole(val key: String, val displayLabel: String) {
    USER("user", "Student"),
    HOST("host", "Event Organizer");

    companion object {
        fun fromKey(raw: String?): UserRole =
            entries.firstOrNull { it.key.equals(raw, ignoreCase = true) } ?: USER
    }
}

enum class EventCategory(val label: String) {
    ALL("All"),
    TECH("Tech"),
    CULTURAL("Cultural"),
    SPORTS("Sports"),
    HACKATHON("Hackathon"),
    WORKSHOP("Workshop"),
    MUSIC("Music"),
    GAMING("Gaming");

    companion object {
        val creatable: List<EventCategory> = entries.filter { it != ALL }
        fun fromLabel(raw: String?): EventCategory =
            entries.firstOrNull { it.label.equals(raw, ignoreCase = true) } ?: TECH
    }
}

data class UserProfile(
    val id: String = "",
    val userId: String = "",
    val name: String = "",
    val email: String = "",
    val role: String = "user",
    val college: String = "",
    val phone: String = "",
    val photoUrl: String = "",
    val createdAtMs: Long = 0L,
    val updatedAtMs: Long = 0L
) {
    val activeRole: UserRole
        get() = UserRole.fromKey(role)
}

data class CollegeEvent(
    val id: String = "",
    val hostId: String = "",
    val hostName: String = "",
    val title: String = "",
    val description: String = "",
    val imageUrl: String = "",
    val date: String = "",
    val startTime: String = "",
    val endTime: String = "",
    val location: String = "",
    val venue: String = "",
    val price: Long = 0L,
    val capacity: Long = 100L,
    val ticketsSold: Long = 0L,
    val availableTickets: Long = 100L,
    val status: String = "published",
    val category: String = "Tech",
    val gatePin: String = "",
    val createdAtMs: Long = 0L,
    val updatedAtMs: Long = 0L
) {
    val percentBooked: Int
        get() = if (capacity > 0L) ((ticketsSold * 100L) / capacity).toInt().coerceIn(0, 100) else 0

    val soldOutFlag: Boolean
        get() = status == "sold_out" || availableTickets <= 0L

    val cancelledFlag: Boolean
        get() = status == "cancelled"

    fun buildVolunteerDeepLink(): String = "campuspass://gate?gatePin=$gatePin"
}

data class Ticket(
    val id: String = "",
    val eventId: String = "",
    val eventTitle: String = "",
    val eventDate: String = "",
    val eventTime: String = "",
    val eventVenue: String = "",
    val eventImageUrl: String = "",
    val userId: String = "",
    val userName: String = "",
    val userEmail: String = "",
    val college: String = "",
    val rollNo: String = "",
    val hostId: String = "",
    val amount: Long = 0L,
    val status: String = "confirmed",
    val qrToken: String = "",
    val qrHash: String = "",
    val entryStatus: String = "not_entered",
    val entryTime: String = "",
    val entryTimestampMs: Long = 0L,
    val verifiedBy: String = "",
    val volunteerPin: String = "",
    val createdAtMs: Long = 0L,
    val updatedAtMs: Long = 0L
) {
    val enteredFlag: Boolean
        get() = entryStatus == "entered"

    val cancelledFlag: Boolean
        get() = status == "cancelled"

    fun buildQrPayload(): String =
        listOf("CAMPUSPASS", id, eventId, qrToken, userName.replace("|", " "), rollNo.replace("|", " "), college.replace("|", " "), qrHash)
            .joinToString("|")
}

data class PayoutRecord(
    val id: String = "",
    val hostId: String = "",
    val hostName: String = "",
    val amount: Long = 0L,
    val method: String = "UPI",
    val destination: String = "",
    val accountHolderName: String = "",
    val status: String = "completed",
    val referenceId: String = "",
    val createdAtMs: Long = 0L,
    val updatedAtMs: Long = 0L
)

data class HostRevenueSummary(
    val totalEvents: Int = 0,
    val totalTicketsSold: Long = 0L,
    val totalRevenue: Long = 0L,
    val totalCheckedIn: Int = 0,
    val totalTransferred: Long = 0L,
    val availableBalance: Long = 0L
)

enum class ScanCode {
    VALID,
    ALREADY_ENTERED,
    INVALID_TOKEN,
    WRONG_HOST_OR_EVENT,
    TICKET_CANCELLED
}

data class ScanResult(
    val success: Boolean,
    val message: String,
    val code: ScanCode,
    val attendeeName: String = "",
    val ticketId: String = "",
    val eventTitle: String = "",
    val entryTime: String = "",
    val rollNo: String = "",
    val college: String = "",
    val verifiedBy: String = ""
)

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}
