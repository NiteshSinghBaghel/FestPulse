package com.campuspass.app.data

import android.content.Context
import com.campuspass.app.R
import com.campuspass.app.model.CollegeEvent
import com.campuspass.app.model.HostRevenueSummary
import com.campuspass.app.model.PayoutRecord
import com.campuspass.app.model.ScanCode
import com.campuspass.app.model.ScanResult
import com.campuspass.app.model.Ticket
import com.campuspass.app.model.UserProfile
import com.campuspass.app.model.UserRole
import com.campuspass.app.util.QrCodeUtils
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.PersistentCacheSettings
import com.google.firebase.firestore.firestoreSettings
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

class CampusPassRepository(private val db: FirebaseFirestore) {

    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        ).apply {
            try {
                firestoreSettings = firestoreSettings {
                    setLocalCacheSettings(PersistentCacheSettings.newBuilder().build())
                }
            } catch (_: Exception) {
                // Settings already initialized
            }
        }
    )

    private val auth = Firebase.auth

    private fun requireUserId(): String {
        return auth.currentUser?.uid?.takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("Please sign in with Google to continue.")
    }

    private fun sanitizeDocId(raw: String): String =
        raw.replace(Regex("[^a-zA-Z0-9_\\-]"), "_").take(120)

    fun observeUserProfile(uid: String): Flow<UserProfile?> = flow {
        if (uid.isBlank()) {
            emit(null)
            return@flow
        }
        val path = "users/$uid"
        emitAll(
            db.collection("users").document(uid)
                .snapshots()
                .map { snap ->
                    if (snap.exists()) snap.toUserProfileSafely() else null
                }
                .catch { error ->
                    unwrapAndHandle(error, OperationType.GET, path, uid)
                    throw error
                }
        )
    }

    fun observePublicEvents(uid: String): Flow<List<CollegeEvent>> = flow {
        if (uid.isBlank()) {
            emit(emptyList())
            return@flow
        }
        val path = "events"
        emitAll(
            db.collection("events")
                .whereIn("status", listOf("published", "sold_out"))
                .snapshots()
                .map { snap ->
                    snap.documents.mapNotNull { it.toCollegeEventSafelyOrNull() }
                        .sortedByDescending { it.createdAtMs }
                }
                .catch { error ->
                    unwrapAndHandle(error, OperationType.LIST, path, uid)
                    throw error
                }
        )
    }

    fun observeHostEvents(hostId: String): Flow<List<CollegeEvent>> = flow {
        if (hostId.isBlank()) {
            emit(emptyList())
            return@flow
        }
        val path = "events"
        emitAll(
            db.collection("events")
                .whereEqualTo("hostId", hostId)
                .snapshots()
                .map { snap ->
                    snap.documents.mapNotNull { it.toCollegeEventSafelyOrNull() }
                        .sortedByDescending { it.createdAtMs }
                }
                .catch { error ->
                    unwrapAndHandle(error, OperationType.LIST, path, hostId)
                    throw error
                }
        )
    }

    fun observeStudentTickets(userId: String): Flow<List<Ticket>> = flow {
        if (userId.isBlank()) {
            emit(emptyList())
            return@flow
        }
        val path = "tickets"
        emitAll(
            db.collection("tickets")
                .whereEqualTo("userId", userId)
                .snapshots()
                .map { snap ->
                    snap.documents.mapNotNull { it.toTicketSafelyOrNull() }
                        .sortedByDescending { it.createdAtMs }
                }
                .catch { error ->
                    unwrapAndHandle(error, OperationType.LIST, path, userId)
                    throw error
                }
        )
    }

    fun observeHostTickets(hostId: String): Flow<List<Ticket>> = flow {
        if (hostId.isBlank()) {
            emit(emptyList())
            return@flow
        }
        val path = "tickets"
        emitAll(
            db.collection("tickets")
                .whereEqualTo("hostId", hostId)
                .snapshots()
                .map { snap ->
                    // Strictly newest check-in at top, then newest issued
                    snap.documents.mapNotNull { it.toTicketSafelyOrNull() }
                        .sortedWith(
                            compareByDescending<Ticket> { it.entryTimestampMs }
                                .thenByDescending { it.createdAtMs }
                        )
                }
                .catch { error ->
                    unwrapAndHandle(error, OperationType.LIST, path, hostId)
                    throw error
                }
        )
    }

    fun observeHostPayouts(hostId: String): Flow<List<PayoutRecord>> = flow {
        if (hostId.isBlank()) {
            emit(emptyList())
            return@flow
        }
        val path = "payouts"
        emitAll(
            db.collection("payouts")
                .whereEqualTo("hostId", hostId)
                .snapshots()
                .map { snap ->
                    snap.documents.mapNotNull { it.toPayoutRecordSafelyOrNull() }
                        .sortedByDescending { it.createdAtMs }
                }
                .catch { error ->
                    unwrapAndHandle(error, OperationType.LIST, path, hostId)
                    throw error
                }
        )
    }

    private fun unwrapAndHandle(error: Throwable, op: OperationType, path: String, expectedUid: String) {
        val firestoreError = generateSequence(error) { it.cause }
            .filterIsInstance<FirebaseFirestoreException>()
            .firstOrNull()
        if (firestoreError == null && error is CancellationException) throw error
        val exceptionToLog = firestoreError ?: (error as? Exception)
        if (exceptionToLog != null && auth.currentUser?.uid == expectedUid) {
            handleFirestoreError(exceptionToLog, op, path)
        }
    }

    suspend fun ensureUserProfile(
        preferredRole: UserRole,
        college: String = "",
        phone: String = ""
    ): Result<UserProfile> {
        var docPath = "users/unknown"
        return try {
            val user = auth.currentUser ?: throw IllegalStateException("Not authenticated")
            val uid = user.uid
            docPath = "users/$uid"
            val docRef = db.collection("users").document(uid)
            val existingSnap = docRef.get().await()
            if (existingSnap.exists()) {
                return Result.success(existingSnap.toUserProfileSafely())
            }
            val displayName = (user.displayName ?: user.email?.substringBefore("@") ?: "Campus User").take(80)
            val email = (user.email ?: "$uid@campuspass.app").take(120)
            val photoUrl = (user.photoUrl?.toString() ?: "").take(500)
            val nowMs = System.currentTimeMillis()
            val payload = mapOf(
                "userId" to uid,
                "name" to displayName,
                "email" to email,
                "role" to preferredRole.key,
                "college" to college.trim().take(120),
                "phone" to phone.trim().take(30),
                "photoUrl" to photoUrl,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            docRef.set(payload).await()
            Result.success(
                UserProfile(
                    id = uid,
                    userId = uid,
                    name = displayName,
                    email = email,
                    role = preferredRole.key,
                    college = college.trim(),
                    phone = phone.trim(),
                    photoUrl = photoUrl,
                    createdAtMs = nowMs,
                    updatedAtMs = nowMs
                )
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, docPath)
            Result.failure(e)
        }
    }

    suspend fun updateUserProfile(
        name: String,
        role: UserRole,
        college: String,
        phone: String
    ): Result<Unit> {
        var docPath = "users/unknown"
        return try {
            val uid = requireUserId()
            docPath = "users/$uid"
            val cleanName = name.trim().take(80)
            require(cleanName.isNotEmpty()) { "Name cannot be empty" }
            db.collection("users").document(uid).update(
                mapOf(
                    "name" to cleanName,
                    "role" to role.key,
                    "college" to college.trim().take(120),
                    "phone" to phone.trim().take(30),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun createEvent(
        hostName: String,
        title: String,
        description: String,
        imageUrl: String,
        date: String,
        startTime: String,
        endTime: String,
        location: String,
        venue: String,
        price: Long,
        capacity: Long,
        category: String
    ): Result<CollegeEvent> {
        var docPath = "events"
        return try {
            val uid = requireUserId()
            val cleanTitle = title.trim().take(100)
            require(cleanTitle.length >= 2) { "Title must be at least 2 characters" }
            require(capacity in 1L..100000L) { "Capacity must be between 1 and 100,000" }
            require(price in 0L..100000L) { "Price must be between ₹0 and ₹100,000" }

            val eventId = sanitizeDocId("evt-${System.currentTimeMillis().toString(36)}-${UUID.randomUUID().toString().take(5)}")
            val docRef = db.collection("events").document(eventId)
            docPath = docRef.path
            val gatePin = QrCodeUtils.generateSixDigitPin()
            val safeImage = imageUrl.trim().ifBlank { defaultCoverForCategory(category) }.take(500)
            val nowMs = System.currentTimeMillis()

            val payload = mapOf(
                "hostId" to uid,
                "hostName" to hostName.trim().ifBlank { "Campus Organizer" }.take(80),
                "title" to cleanTitle,
                "description" to description.trim().ifBlank { "Official campus event on Fest-Plus." }.take(1500),
                "imageUrl" to safeImage,
                "date" to date.trim().ifBlank { "2026-12-15" }.take(30),
                "startTime" to startTime.trim().ifBlank { "10:00 AM" }.take(30),
                "endTime" to endTime.trim().ifBlank { "05:00 PM" }.take(30),
                "location" to location.trim().ifBlank { "Main Campus" }.take(120),
                "venue" to venue.trim().ifBlank { "Main Auditorium" }.take(120),
                "price" to price,
                "capacity" to capacity,
                "ticketsSold" to 0L,
                "availableTickets" to capacity,
                "status" to "published",
                "category" to category.ifBlank { "Tech" },
                "gatePin" to gatePin,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            docRef.set(payload).await()
            Result.success(
                CollegeEvent(
                    id = eventId,
                    hostId = uid,
                    hostName = payload["hostName"] as String,
                    title = cleanTitle,
                    description = payload["description"] as String,
                    imageUrl = safeImage,
                    date = payload["date"] as String,
                    startTime = payload["startTime"] as String,
                    endTime = payload["endTime"] as String,
                    location = payload["location"] as String,
                    venue = payload["venue"] as String,
                    price = price,
                    capacity = capacity,
                    ticketsSold = 0L,
                    availableTickets = capacity,
                    status = "published",
                    category = payload["category"] as String,
                    gatePin = gatePin,
                    createdAtMs = nowMs,
                    updatedAtMs = nowMs
                )
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun cancelEvent(event: CollegeEvent): Result<Unit> {
        var docPath = "events/${event.id}"
        return try {
            val uid = requireUserId()
            require(event.hostId == uid) { "Unauthorized: Only the event creator can cancel this event." }
            val docRef = db.collection("events").document(event.id)
            docPath = docRef.path
            docRef.update(
                mapOf(
                    "status" to "cancelled",
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun deleteEvent(event: CollegeEvent): Result<Unit> {
        var docPath = "events/${event.id}"
        return try {
            val uid = requireUserId()
            require(event.hostId == uid) { "Unauthorized: Only the event creator can delete this event." }
            val docRef = db.collection("events").document(event.id)
            docPath = docRef.path
            docRef.delete().await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docPath)
            Result.failure(e)
        }
    }

    suspend fun bookTicket(
        event: CollegeEvent,
        attendeeName: String,
        attendeeEmail: String,
        college: String,
        rollNo: String
    ): Result<Ticket> {
        var docPath = "tickets"
        return try {
            val uid = requireUserId()
            require(!event.cancelledFlag && !event.soldOutFlag) { "This event is no longer accepting bookings." }

            val ticketId = sanitizeDocId("TKT-${(10000000..99999999).random()}")
            val qrToken = "CP-PASS-$ticketId-${UUID.randomUUID().toString().take(8).uppercase()}"
            val qrHash = QrCodeUtils.sha256Short("$ticketId:${event.id}:$qrToken:$uid")

            val ticketRef = db.collection("tickets").document(ticketId)
            val eventRef = db.collection("events").document(event.id)
            docPath = ticketRef.path

            val newSold = event.ticketsSold + 1L
            val newAvail = (event.availableTickets - 1L).coerceAtLeast(0L)
            val newStatus = if (newAvail == 0L) "sold_out" else "published"
            val nowMs = System.currentTimeMillis()

            val ticketPayload = mapOf(
                "eventId" to event.id,
                "eventTitle" to event.title.take(120),
                "eventDate" to event.date.take(40),
                "eventTime" to "${event.startTime} - ${event.endTime}".take(50),
                "eventVenue" to event.venue.take(120),
                "eventImageUrl" to event.imageUrl.take(500),
                "userId" to uid,
                "userName" to attendeeName.trim().ifBlank { "Student" }.take(80),
                "userEmail" to attendeeEmail.trim().ifBlank { "$uid@campus.edu" }.take(120),
                "college" to college.trim().take(120),
                "rollNo" to rollNo.trim().take(40),
                "hostId" to event.hostId,
                "amount" to event.price,
                "status" to "confirmed",
                "qrToken" to qrToken,
                "qrHash" to qrHash,
                "entryStatus" to "not_entered",
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )

            db.runBatch { batch ->
                batch.update(
                    eventRef,
                    mapOf(
                        "ticketsSold" to newSold,
                        "availableTickets" to newAvail,
                        "status" to newStatus,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
                batch.set(ticketRef, ticketPayload)
            }.await()

            Result.success(
                Ticket(
                    id = ticketId,
                    eventId = event.id,
                    eventTitle = ticketPayload["eventTitle"] as String,
                    eventDate = ticketPayload["eventDate"] as String,
                    eventTime = ticketPayload["eventTime"] as String,
                    eventVenue = ticketPayload["eventVenue"] as String,
                    eventImageUrl = ticketPayload["eventImageUrl"] as String,
                    userId = uid,
                    userName = ticketPayload["userName"] as String,
                    userEmail = ticketPayload["userEmail"] as String,
                    college = ticketPayload["college"] as String,
                    rollNo = ticketPayload["rollNo"] as String,
                    hostId = event.hostId,
                    amount = event.price,
                    status = "confirmed",
                    qrToken = qrToken,
                    qrHash = qrHash,
                    entryStatus = "not_entered",
                    createdAtMs = nowMs,
                    updatedAtMs = nowMs
                )
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun cancelTicket(ticket: Ticket, parentEvent: CollegeEvent?): Result<Unit> {
        var docPath = "tickets/${ticket.id}"
        return try {
            val uid = requireUserId()
            require(ticket.userId == uid) { "You can only cancel your own pass." }
            require(!ticket.enteredFlag) { "Already checked in at gate; cannot cancel." }

            val ticketRef = db.collection("tickets").document(ticket.id)
            docPath = ticketRef.path

            db.runBatch { batch ->
                batch.update(
                    ticketRef,
                    mapOf(
                        "status" to "cancelled",
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
                if (parentEvent != null && parentEvent.ticketsSold > 0L) {
                    val eventRef = db.collection("events").document(parentEvent.id)
                    val nextSold = (parentEvent.ticketsSold - 1L).coerceAtLeast(0L)
                    val nextAvail = (parentEvent.availableTickets + 1L).coerceAtMost(parentEvent.capacity)
                    val nextStatus = if (parentEvent.status == "sold_out" && nextAvail > 0L) "published" else parentEvent.status
                    batch.update(
                        eventRef,
                        mapOf(
                            "ticketsSold" to nextSold,
                            "availableTickets" to nextAvail,
                            "status" to nextStatus,
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
                }
            }.await()

            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun verifyOrganizerScan(
        rawQrInput: String,
        hostTickets: List<Ticket>
    ): ScanResult {
        val parsed = QrCodeUtils.parseQrInput(rawQrInput)
            ?: return ScanResult(false, "Empty or invalid QR pass.", ScanCode.INVALID_TOKEN)

        val currentHostId = auth.currentUser?.uid.orEmpty()
        if (currentHostId.isBlank()) {
            return ScanResult(false, "Please sign in as Organizer.", ScanCode.WRONG_HOST_OR_EVENT)
        }

        val matchingTicket = hostTickets.firstOrNull {
            it.id == parsed.ticketId || it.qrToken == parsed.qrToken || it.id == parsed.qrToken
        }

        if (matchingTicket == null) {
            return if (parsed.eventId != null && parsed.qrToken.startsWith("CP-PASS-")) {
                ScanResult(
                    success = false,
                    message = "UNAUTHORIZED SCANNER! This pass belongs to a different organizer's event.",
                    code = ScanCode.WRONG_HOST_OR_EVENT,
                    ticketId = parsed.ticketId,
                    attendeeName = parsed.userName.orEmpty()
                )
            } else {
                ScanResult(
                    success = false,
                    message = "Invalid Ticket QR. No matching pass found in your events.",
                    code = ScanCode.INVALID_TOKEN,
                    ticketId = parsed.ticketId
                )
            }
        }

        if (matchingTicket.hostId != currentHostId) {
            return ScanResult(
                success = false,
                message = "UNAUTHORIZED! Only the creator of \"${matchingTicket.eventTitle}\" can scan this pass.",
                code = ScanCode.WRONG_HOST_OR_EVENT,
                ticketId = matchingTicket.id,
                eventTitle = matchingTicket.eventTitle
            )
        }

        if (matchingTicket.cancelledFlag) {
            return ScanResult(
                success = false,
                message = "Ticket is CANCELLED and cannot be used at the gate.",
                code = ScanCode.TICKET_CANCELLED,
                ticketId = matchingTicket.id,
                attendeeName = matchingTicket.userName
            )
        }

        if (matchingTicket.enteredFlag) {
            return ScanResult(
                success = false,
                message = "ALREADY USED! Checked in at ${matchingTicket.entryTime.ifBlank { "earlier" }}. Duplicate entry rejected!",
                code = ScanCode.ALREADY_ENTERED,
                ticketId = matchingTicket.id,
                attendeeName = matchingTicket.userName,
                eventTitle = matchingTicket.eventTitle,
                entryTime = matchingTicket.entryTime
            )
        }

        val nowMs = System.currentTimeMillis()
        val nowClock = SimpleDateFormat("hh:mm:ss a", Locale.getDefault()).format(Date(nowMs))
        val docRef = db.collection("tickets").document(matchingTicket.id)

        return try {
            docRef.update(
                mapOf(
                    "entryStatus" to "entered",
                    "entryTime" to nowClock,
                    "entryTimestampMs" to nowMs,
                    "verifiedBy" to "organizer",
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            ScanResult(
                success = true,
                message = "ENTRY GRANTED! Welcome ${matchingTicket.userName}.",
                code = ScanCode.VALID,
                attendeeName = matchingTicket.userName,
                ticketId = matchingTicket.id,
                eventTitle = matchingTicket.eventTitle,
                entryTime = nowClock,
                rollNo = matchingTicket.rollNo,
                college = matchingTicket.college,
                verifiedBy = "organizer"
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docRef.path)
            ScanResult(
                success = false,
                message = e.localizedMessage ?: "Verification failed.",
                code = ScanCode.INVALID_TOKEN,
                ticketId = matchingTicket.id
            )
        }
    }

    suspend fun validateVolunteerGatePin(pin: String): Result<CollegeEvent> {
        val cleanPin = pin.trim()
        if (cleanPin.length != 6 || !cleanPin.all { it.isDigit() }) {
            return Result.failure(IllegalArgumentException("Please enter a valid 6-digit numeric Gate PIN."))
        }
        return try {
            requireUserId()
            val snap = db.collection("events")
                .whereEqualTo("gatePin", cleanPin)
                .whereIn("status", listOf("published", "sold_out"))
                .limit(1)
                .get()
                .await()
            val evt = snap.documents.mapNotNull { it.toCollegeEventSafelyOrNull() }
                .firstOrNull()
                ?: return Result.failure(IllegalArgumentException("Invalid Gate PIN or event is cancelled."))
            Result.success(evt)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.LIST, "events")
            Result.failure(e)
        }
    }

    suspend fun verifyVolunteerScan(
        rawQrInput: String,
        gatePin: String,
        targetEvent: CollegeEvent
    ): ScanResult {
        val cleanPin = gatePin.trim()
        if (cleanPin.length != 6 || cleanPin != targetEvent.gatePin) {
            return ScanResult(
                success = false,
                message = "Invalid Gate PIN session.",
                code = ScanCode.WRONG_HOST_OR_EVENT
            )
        }

        val parsed = QrCodeUtils.parseQrInput(rawQrInput)
            ?: return ScanResult(false, "Invalid Ticket QR.", ScanCode.INVALID_TOKEN)

        if (parsed.eventId != null && parsed.eventId != targetEvent.id) {
            return ScanResult(
                success = false,
                message = "WRONG EVENT PASS! This ticket does not belong to \"${targetEvent.title}\".",
                code = ScanCode.WRONG_HOST_OR_EVENT,
                ticketId = parsed.ticketId,
                attendeeName = parsed.userName.orEmpty()
            )
        }

        val nowMs = System.currentTimeMillis()
        val nowClock = SimpleDateFormat("hh:mm:ss a", Locale.getDefault()).format(Date(nowMs))
        val ticketDocRef = db.collection("tickets").document(parsed.ticketId)

        return try {
            requireUserId()
            ticketDocRef.update(
                mapOf(
                    "entryStatus" to "entered",
                    "entryTime" to nowClock,
                    "entryTimestampMs" to nowMs,
                    "verifiedBy" to "volunteer",
                    "volunteerPin" to cleanPin,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            ScanResult(
                success = true,
                message = "ENTRY GRANTED! Pass verified by Gate Staff.",
                code = ScanCode.VALID,
                attendeeName = parsed.userName?.ifBlank { "Attendee" } ?: "Attendee",
                ticketId = parsed.ticketId,
                eventTitle = targetEvent.title,
                entryTime = nowClock,
                rollNo = parsed.rollNo.orEmpty(),
                college = parsed.college.orEmpty(),
                verifiedBy = "volunteer"
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, ticketDocRef.path)
            val msg = e.localizedMessage.orEmpty()
            if (msg.contains("PERMISSION_DENIED", ignoreCase = true)) {
                ScanResult(
                    success = false,
                    message = "Entry Denied! Pass may already be entered, cancelled, or belongs to a different event.",
                    code = ScanCode.ALREADY_ENTERED,
                    ticketId = parsed.ticketId,
                    attendeeName = parsed.userName.orEmpty()
                )
            } else {
                ScanResult(
                    success = false,
                    message = msg.ifBlank { "Could not verify ticket ID ${parsed.ticketId}." },
                    code = ScanCode.INVALID_TOKEN,
                    ticketId = parsed.ticketId
                )
            }
        }
    }

    suspend fun requestPayout(
        hostName: String,
        amount: Long,
        method: String,
        destination: String,
        accountHolderName: String
    ): Result<PayoutRecord> {
        var docPath = "payouts"
        return try {
            val uid = requireUserId()
            require(amount >= 1L) { "Amount must be at least ₹1" }
            require(destination.trim().length >= 3) { "Valid UPI ID or Bank Account required" }
            require(accountHolderName.trim().length >= 2) { "Beneficiary name required" }

            val payoutId = sanitizeDocId("PAY-${System.currentTimeMillis().toString(36).uppercase()}")
            val refId = "UTR${(100000000..999999999).random()}"
            val docRef = db.collection("payouts").document(payoutId)
            docPath = docRef.path
            val nowMs = System.currentTimeMillis()

            val payload = mapOf(
                "hostId" to uid,
                "hostName" to hostName.trim().ifBlank { "Organizer" }.take(80),
                "amount" to amount,
                "method" to method,
                "destination" to destination.trim().take(120),
                "accountHolderName" to accountHolderName.trim().take(80),
                "status" to "completed",
                "referenceId" to refId,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            docRef.set(payload).await()
            Result.success(
                PayoutRecord(
                    id = payoutId,
                    hostId = uid,
                    hostName = payload["hostName"] as String,
                    amount = amount,
                    method = method,
                    destination = payload["destination"] as String,
                    accountHolderName = payload["accountHolderName"] as String,
                    status = "completed",
                    referenceId = refId,
                    createdAtMs = nowMs,
                    updatedAtMs = nowMs
                )
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    fun computeRevenueSummary(
        hostEvents: List<CollegeEvent>,
        hostTickets: List<Ticket>,
        hostPayouts: List<PayoutRecord>
    ): HostRevenueSummary {
        val totalEvents = hostEvents.size
        val totalTicketsSold = hostEvents.sumOf { it.ticketsSold }
        val ticketsRev = hostTickets.filter { it.status == "confirmed" }.sumOf { it.amount }
        val eventsRev = hostEvents.sumOf { it.ticketsSold * it.price }
        val totalRevenue = maxOf(ticketsRev, eventsRev)
        val totalCheckedIn = hostTickets.count { it.enteredFlag }
        val totalTransferred = hostPayouts.sumOf { it.amount }
        val availableBalance = (totalRevenue - totalTransferred).coerceAtLeast(0L)
        return HostRevenueSummary(
            totalEvents = totalEvents,
            totalTicketsSold = totalTicketsSold,
            totalRevenue = totalRevenue,
            totalCheckedIn = totalCheckedIn,
            totalTransferred = totalTransferred,
            availableBalance = availableBalance
        )
    }

    private fun defaultCoverForCategory(category: String): String = when (category.lowercase()) {
        "hackathon", "tech" -> "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1000&auto=format&fit=crop&q=80"
        "music", "cultural" -> "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1000&auto=format&fit=crop&q=80"
        "sports" -> "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1000&auto=format&fit=crop&q=80"
        "gaming" -> "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1000&auto=format&fit=crop&q=80"
        else -> "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&auto=format&fit=crop&q=80"
    }
}

// ============================================================================
// Defensive Firestore Snapshot Mappers (Handles Timestamp, ISO-8601 String, & Number)
// ============================================================================

private fun DocumentSnapshot.readString(vararg keys: String, defaultValue: String = ""): String {
    for (key in keys) {
        val raw = get(key, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
        when (raw) {
            is String -> if (raw.isNotEmpty()) return raw
            is Number -> return raw.toString()
        }
    }
    return defaultValue
}

private fun DocumentSnapshot.readLong(vararg keys: String, defaultValue: Long = 0L): Long {
    for (key in keys) {
        val raw = get(key, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
        when (raw) {
            is Number -> return raw.toLong()
            is String -> raw.toLongOrNull()?.let { return it }
        }
    }
    return defaultValue
}

private fun DocumentSnapshot.readEpochMillis(vararg keys: String): Long {
    for (key in keys) {
        val raw = get(key, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
        when (raw) {
            is Timestamp -> return raw.toDate().time
            is Date -> return raw.time
            is Number -> return raw.toLong()
            is String -> parseIsoEpochMillis(raw)?.let { return it }
        }
    }
    return 0L
}

private fun parseIsoEpochMillis(raw: String): Long? {
    val clean = raw.trim()
    if (clean.isEmpty()) return null
    clean.toLongOrNull()?.let { return it }
    val normalized = clean
        .replace(Regex("\\.\\d+Z$"), "Z")
        .replace(Regex("([+-]\\d{2}):(\\d{2})$"), "$1$2")
    val patterns = listOf(
        "yyyy-MM-dd'T'HH:mm:ss'Z'",
        "yyyy-MM-dd'T'HH:mm:ssZ",
        "yyyy-MM-dd'T'HH:mm:ss",
        "yyyy-MM-dd"
    )
    for (pattern in patterns) {
        try {
            val sdf = SimpleDateFormat(pattern, Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            sdf.parse(normalized)?.time?.let { return it }
        } catch (_: Exception) {
            // Try next format
        }
    }
    return null
}

private fun DocumentSnapshot.toUserProfileSafely(): UserProfile {
    return UserProfile(
        id = id,
        userId = readString("userId", "uid", defaultValue = id),
        name = readString("name", defaultValue = "Campus Member"),
        email = readString("email"),
        role = readString("role", defaultValue = "user"),
        college = readString("college"),
        phone = readString("phone"),
        photoUrl = readString("photoUrl", "photoURL"),
        createdAtMs = readEpochMillis("createdAt"),
        updatedAtMs = readEpochMillis("updatedAt")
    )
}

private fun DocumentSnapshot.toCollegeEventSafelyOrNull(): CollegeEvent? {
    return try {
        val capacityVal = readLong("capacity", defaultValue = 100L).coerceAtLeast(1L)
        val soldVal = readLong("ticketsSold", defaultValue = 0L).coerceAtLeast(0L)
        val availVal = readLong("availableTickets", defaultValue = (capacityVal - soldVal).coerceAtLeast(0L))
        CollegeEvent(
            id = id,
            hostId = readString("hostId"),
            hostName = readString("hostName", defaultValue = "Campus Organizer"),
            title = readString("title", defaultValue = "Campus Event"),
            description = readString("description"),
            imageUrl = readString("imageUrl"),
            date = readString("date"),
            startTime = readString("startTime"),
            endTime = readString("endTime"),
            location = readString("location"),
            venue = readString("venue"),
            price = readLong("price", defaultValue = 0L),
            capacity = capacityVal,
            ticketsSold = soldVal,
            availableTickets = availVal,
            status = readString("status", defaultValue = "published"),
            category = readString("category", defaultValue = "Tech"),
            gatePin = readString("gatePin"),
            createdAtMs = readEpochMillis("createdAt"),
            updatedAtMs = readEpochMillis("updatedAt")
        )
    } catch (_: Exception) {
        null
    }
}

private fun DocumentSnapshot.toTicketSafelyOrNull(): Ticket? {
    return try {
        val entryMs = readLong("entryTimestampMs", defaultValue = 0L)
            .takeIf { it > 0L }
            ?: readEpochMillis("entryTimestamp")
        Ticket(
            id = id,
            eventId = readString("eventId"),
            eventTitle = readString("eventTitle", defaultValue = "Campus Event"),
            eventDate = readString("eventDate"),
            eventTime = readString("eventTime"),
            eventVenue = readString("eventVenue"),
            eventImageUrl = readString("eventImageUrl"),
            userId = readString("userId"),
            userName = readString("userName", defaultValue = "Attendee"),
            userEmail = readString("userEmail"),
            college = readString("college"),
            rollNo = readString("rollNo"),
            hostId = readString("hostId"),
            amount = readLong("amount", defaultValue = 0L),
            status = readString("status", defaultValue = "confirmed"),
            qrToken = readString("qrToken"),
            qrHash = readString("qrHash"),
            entryStatus = readString("entryStatus", defaultValue = "not_entered"),
            entryTime = readString("entryTime"),
            entryTimestampMs = entryMs,
            verifiedBy = readString("verifiedBy"),
            volunteerPin = readString("volunteerPin"),
            createdAtMs = readEpochMillis("createdAt", "issuedAt"),
            updatedAtMs = readEpochMillis("updatedAt")
        )
    } catch (_: Exception) {
        null
    }
}

private fun DocumentSnapshot.toPayoutRecordSafelyOrNull(): PayoutRecord? {
    return try {
        PayoutRecord(
            id = id,
            hostId = readString("hostId"),
            hostName = readString("hostName"),
            amount = readLong("amount", defaultValue = 0L),
            method = readString("method", defaultValue = "UPI"),
            destination = readString("destination"),
            accountHolderName = readString("accountHolderName"),
            status = readString("status", defaultValue = "completed"),
            referenceId = readString("referenceId"),
            createdAtMs = readEpochMillis("createdAt", "timestamp"),
            updatedAtMs = readEpochMillis("updatedAt", "timestamp")
        )
    } catch (_: Exception) {
        null
    }
}
