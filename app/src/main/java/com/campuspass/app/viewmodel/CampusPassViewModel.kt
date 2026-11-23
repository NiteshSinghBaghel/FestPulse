package com.campuspass.app.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.campuspass.app.data.CampusPassRepository
import com.campuspass.app.model.CollegeEvent
import com.campuspass.app.model.EventCategory
import com.campuspass.app.model.HostRevenueSummary
import com.campuspass.app.model.PayoutRecord
import com.campuspass.app.model.ScanResult
import com.campuspass.app.model.Ticket
import com.campuspass.app.model.UiState
import com.campuspass.app.model.UserProfile
import com.campuspass.app.model.UserRole
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class AppTab {
    EXPLORE,
    MY_TICKETS,
    HOST_DASHBOARD,
    VOLUNTEER_SCAN,
    PROFILE
}

enum class HostSubTab(val label: String) {
    OVERVIEW("Overview"),
    MY_EVENTS("My Events"),
    REVENUE("Revenue & Payouts")
}

class CampusPassViewModel(
    private val uid: String,
    private val preferredRole: UserRole,
    private val repo: CampusPassRepository
) : ViewModel() {

    private val _selectedTab = MutableStateFlow(
        if (preferredRole == UserRole.HOST) AppTab.HOST_DASHBOARD else AppTab.EXPLORE
    )
    val selectedTab: StateFlow<AppTab> = _selectedTab.asStateFlow()

    private val _hostSubTab = MutableStateFlow(HostSubTab.OVERVIEW)
    val hostSubTab: StateFlow<HostSubTab> = _hostSubTab.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedCategory = MutableStateFlow(EventCategory.ALL)
    val selectedCategory: StateFlow<EventCategory> = _selectedCategory.asStateFlow()

    private val _statusBanner = MutableStateFlow<String?>(null)
    val statusBanner: StateFlow<String?> = _statusBanner.asStateFlow()

    private val _shareVolunteerEvent = MutableStateFlow<CollegeEvent?>(null)
    val shareVolunteerEvent: StateFlow<CollegeEvent?> = _shareVolunteerEvent.asStateFlow()

    private val _scannerTargetEvent = MutableStateFlow<CollegeEvent?>(null)
    val scannerTargetEvent: StateFlow<CollegeEvent?> = _scannerTargetEvent.asStateFlow()

    // Volunteer sandboxed state
    private val _volunteerPinInput = MutableStateFlow("")
    val volunteerPinInput: StateFlow<String> = _volunteerPinInput.asStateFlow()

    private val _volunteerActiveEvent = MutableStateFlow<CollegeEvent?>(null)
    val volunteerActiveEvent: StateFlow<CollegeEvent?> = _volunteerActiveEvent.asStateFlow()

    private val _volunteerPinError = MutableStateFlow<String?>(null)
    val volunteerPinError: StateFlow<String?> = _volunteerPinError.asStateFlow()

    private val _volunteerValidating = MutableStateFlow(false)
    val volunteerValidating: StateFlow<Boolean> = _volunteerValidating.asStateFlow()

    private val _lastScanResult = MutableStateFlow<ScanResult?>(null)
    val lastScanResult: StateFlow<ScanResult?> = _lastScanResult.asStateFlow()

    private val _volunteerSessionLog = MutableStateFlow<List<ScanResult>>(emptyList())
    val volunteerSessionLog: StateFlow<List<ScanResult>> = _volunteerSessionLog.asStateFlow()

    val userProfileState: StateFlow<UiState<UserProfile?>> = repo.observeUserProfile(uid)
        .map<UserProfile?, UiState<UserProfile?>> { UiState.Success(it) }
        .catch { e ->
            if (e is CancellationException) throw e
            emit(UiState.Error(e.localizedMessage ?: "Failed to load profile"))
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiState.Loading)

    val publicEventsState: StateFlow<UiState<List<CollegeEvent>>> = repo.observePublicEvents(uid)
        .map<List<CollegeEvent>, UiState<List<CollegeEvent>>> { UiState.Success(it) }
        .catch { e ->
            if (e is CancellationException) throw e
            emit(UiState.Error(e.localizedMessage ?: "Failed to load campus events"))
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiState.Loading)

    val filteredEventsState: StateFlow<UiState<List<CollegeEvent>>> = combine(
        publicEventsState,
        _searchQuery,
        _selectedCategory
    ) { state, query, category ->
        when (state) {
            is UiState.Loading -> UiState.Loading
            is UiState.Error -> state
            is UiState.Success -> {
                val q = query.trim().lowercase()
                val filtered = state.data.filter { evt ->
                    val catMatch = category == EventCategory.ALL ||
                        evt.category.equals(category.label, ignoreCase = true)
                    val queryMatch = q.isEmpty() ||
                        evt.title.lowercase().contains(q) ||
                        evt.venue.lowercase().contains(q) ||
                        evt.location.lowercase().contains(q) ||
                        evt.hostName.lowercase().contains(q) ||
                        evt.category.lowercase().contains(q)
                    catMatch && queryMatch
                }
                UiState.Success(filtered)
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiState.Loading)

    val studentTicketsState: StateFlow<UiState<List<Ticket>>> = repo.observeStudentTickets(uid)
        .map<List<Ticket>, UiState<List<Ticket>>> { UiState.Success(it) }
        .catch { e ->
            if (e is CancellationException) throw e
            emit(UiState.Error(e.localizedMessage ?: "Failed to load your passes"))
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiState.Loading)

    val hostEventsState: StateFlow<UiState<List<CollegeEvent>>> = repo.observeHostEvents(uid)
        .map<List<CollegeEvent>, UiState<List<CollegeEvent>>> { UiState.Success(it) }
        .catch { e ->
            if (e is CancellationException) throw e
            emit(UiState.Error(e.localizedMessage ?: "Failed to load your hosted events"))
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiState.Loading)

    val hostTicketsState: StateFlow<UiState<List<Ticket>>> = repo.observeHostTickets(uid)
        .map<List<Ticket>, UiState<List<Ticket>>> { UiState.Success(it) }
        .catch { e ->
            if (e is CancellationException) throw e
            emit(UiState.Error(e.localizedMessage ?: "Failed to load organizer gate entries"))
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiState.Loading)

    // Strictly scoped to host's own tickets, strictly sorted newest gate check-in at top
    val recentGateEntries: StateFlow<List<Ticket>> = hostTicketsState
        .map { state ->
            when (state) {
                is UiState.Success -> state.data
                    .filter { it.hostId == uid && it.enteredFlag }
                    .sortedByDescending { it.entryTimestampMs }
                else -> emptyList()
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val hostPayoutsState: StateFlow<UiState<List<PayoutRecord>>> = repo.observeHostPayouts(uid)
        .map<List<PayoutRecord>, UiState<List<PayoutRecord>>> { UiState.Success(it) }
        .catch { e ->
            if (e is CancellationException) throw e
            emit(UiState.Error(e.localizedMessage ?: "Failed to load payout history"))
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiState.Loading)

    val hostRevenueSummary: StateFlow<HostRevenueSummary> = combine(
        hostEventsState,
        hostTicketsState,
        hostPayoutsState
    ) { evState, tktState, payState ->
        val evs = (evState as? UiState.Success)?.data.orEmpty().filter { it.hostId == uid }
        val tkts = (tktState as? UiState.Success)?.data.orEmpty().filter { it.hostId == uid }
        val pays = (payState as? UiState.Success)?.data.orEmpty().filter { it.hostId == uid }
        repo.computeRevenueSummary(evs, tkts, pays)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), HostRevenueSummary())

    init {
        ensureProfileInitialized()
    }

    private fun ensureProfileInitialized() {
        viewModelScope.launch {
            repo.ensureUserProfile(preferredRole = preferredRole)
                .onSuccess { profile ->
                    if (profile.activeRole == UserRole.HOST && _selectedTab.value == AppTab.EXPLORE) {
                        _selectedTab.value = AppTab.HOST_DASHBOARD
                    }
                }
        }
    }

    fun selectTab(tab: AppTab) {
        _selectedTab.value = tab
    }

    fun selectHostSubTab(subTab: HostSubTab) {
        _hostSubTab.value = subTab
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun selectCategory(category: EventCategory) {
        _selectedCategory.value = category
    }

    fun showBanner(message: String) {
        _statusBanner.value = message
    }

    fun dismissBanner() {
        _statusBanner.value = null
    }

    fun openVolunteerShareDialog(event: CollegeEvent?) {
        _shareVolunteerEvent.value = event
    }

    fun openOrganizerScanner(event: CollegeEvent?) {
        _lastScanResult.value = null
        _scannerTargetEvent.value = event
    }

    fun clearScanResult() {
        _lastScanResult.value = null
    }

    fun setVolunteerPinInput(pin: String) {
        _volunteerPinInput.value = pin.filter { it.isDigit() }.take(6)
        _volunteerPinError.value = null
    }

    fun unlockVolunteerGateWithPin(pinOverride: String? = null) {
        val pin = (pinOverride ?: _volunteerPinInput.value).trim()
        if (pin.length != 6 || !pin.all { it.isDigit() }) {
            _volunteerPinError.value = "Please enter a valid 6-digit numeric Gate PIN."
            return
        }
        viewModelScope.launch {
            _volunteerValidating.value = true
            _volunteerPinError.value = null
            _lastScanResult.value = null
            repo.validateVolunteerGatePin(pin)
                .onSuccess { evt ->
                    _volunteerPinInput.value = pin
                    _volunteerActiveEvent.value = evt
                    _selectedTab.value = AppTab.VOLUNTEER_SCAN
                }
                .onFailure { err ->
                    _volunteerPinError.value = err.localizedMessage ?: "Invalid Gate PIN or event cancelled."
                }
            _volunteerValidating.value = false
        }
    }

    fun exitVolunteerGateSession() {
        _volunteerActiveEvent.value = null
        _lastScanResult.value = null
        _volunteerSessionLog.value = emptyList()
    }

    fun verifyVolunteerTicketQr(rawQr: String) {
        val evt = _volunteerActiveEvent.value ?: return
        val pin = evt.gatePin.ifBlank { _volunteerPinInput.value }
        viewModelScope.launch {
            val result = repo.verifyVolunteerScan(
                rawQrInput = rawQr,
                gatePin = pin,
                targetEvent = evt
            )
            _lastScanResult.value = result
            if (result.success) {
                _volunteerSessionLog.value = (listOf(result) + _volunteerSessionLog.value).take(30)
            }
        }
    }

    fun verifyOrganizerTicketQr(rawQr: String) {
        val allHostTickets = (hostTicketsState.value as? UiState.Success)?.data.orEmpty()
        viewModelScope.launch {
            val result = repo.verifyOrganizerScan(
                rawQrInput = rawQr,
                hostTickets = allHostTickets
            )
            _lastScanResult.value = result
        }
    }

    fun bookTicket(
        event: CollegeEvent,
        attendeeName: String,
        attendeeEmail: String,
        college: String,
        rollNo: String,
        onComplete: (Result<Ticket>) -> Unit
    ) {
        viewModelScope.launch {
            val result = repo.bookTicket(
                event = event,
                attendeeName = attendeeName,
                attendeeEmail = attendeeEmail,
                college = college,
                rollNo = rollNo
            )
            result.onSuccess {
                _statusBanner.value = "Pass confirmed for ${event.title}!"
            }.onFailure { err ->
                _statusBanner.value = err.localizedMessage ?: "Booking failed."
            }
            onComplete(result)
        }
    }

    fun cancelTicket(ticket: Ticket) {
        val allEvents = (publicEventsState.value as? UiState.Success)?.data.orEmpty()
        val parentEvent = allEvents.firstOrNull { it.id == ticket.eventId }
        viewModelScope.launch {
            repo.cancelTicket(ticket, parentEvent)
                .onSuccess {
                    _statusBanner.value = "Pass ${ticket.id} cancelled."
                }
                .onFailure { err ->
                    _statusBanner.value = err.localizedMessage ?: "Could not cancel pass."
                }
        }
    }

    fun createEvent(
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
        category: String,
        onComplete: (Result<CollegeEvent>) -> Unit
    ) {
        viewModelScope.launch {
            val result = repo.createEvent(
                hostName = hostName,
                title = title,
                description = description,
                imageUrl = imageUrl,
                date = date,
                startTime = startTime,
                endTime = endTime,
                location = location,
                venue = venue,
                price = price,
                capacity = capacity,
                category = category
            )
            result.onSuccess { evt ->
                _statusBanner.value = "Event \"${evt.title}\" published! Gate PIN: ${evt.gatePin}"
            }.onFailure { err ->
                _statusBanner.value = err.localizedMessage ?: "Failed to create event."
            }
            onComplete(result)
        }
    }

    fun cancelHostEvent(event: CollegeEvent) {
        viewModelScope.launch {
            repo.cancelEvent(event)
                .onSuccess { _statusBanner.value = "\"${event.title}\" cancelled." }
                .onFailure { err -> _statusBanner.value = err.localizedMessage ?: "Could not cancel event." }
        }
    }

    fun deleteHostEvent(event: CollegeEvent) {
        viewModelScope.launch {
            repo.deleteEvent(event)
                .onSuccess { _statusBanner.value = "\"${event.title}\" deleted." }
                .onFailure { err -> _statusBanner.value = err.localizedMessage ?: "Could not delete event." }
        }
    }

    fun requestPayout(
        hostName: String,
        amount: Long,
        method: String,
        destination: String,
        accountHolderName: String,
        onComplete: (Result<PayoutRecord>) -> Unit
    ) {
        val available = hostRevenueSummary.value.availableBalance
        if (amount > available) {
            onComplete(Result.failure(IllegalArgumentException("Requested amount exceeds available balance (₹$available).")))
            return
        }
        viewModelScope.launch {
            val result = repo.requestPayout(
                hostName = hostName,
                amount = amount,
                method = method,
                destination = destination,
                accountHolderName = accountHolderName
            )
            result.onSuccess { pay ->
                _statusBanner.value = "Payout ₹${pay.amount} initiated (Ref: ${pay.referenceId})."
            }.onFailure { err ->
                _statusBanner.value = err.localizedMessage ?: "Payout failed."
            }
            onComplete(result)
        }
    }

    fun updateProfile(
        name: String,
        role: UserRole,
        college: String,
        phone: String,
        onComplete: (Result<Unit>) -> Unit
    ) {
        viewModelScope.launch {
            val res = repo.updateUserProfile(name, role, college, phone)
            res.onSuccess {
                _statusBanner.value = "Profile updated (${role.displayLabel} mode)."
            }.onFailure { err ->
                _statusBanner.value = err.localizedMessage ?: "Failed to update profile."
            }
            onComplete(res)
        }
    }

    class Factory(
        private val uid: String,
        private val preferredRole: UserRole,
        private val context: Context
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return CampusPassViewModel(
                uid = uid,
                preferredRole = preferredRole,
                repo = CampusPassRepository(context.applicationContext)
            ) as T
        }
    }
}
