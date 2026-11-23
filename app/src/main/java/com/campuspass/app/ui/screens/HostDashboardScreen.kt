package com.campuspass.app.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.campuspass.app.model.CollegeEvent
import com.campuspass.app.model.EventCategory
import com.campuspass.app.model.HostRevenueSummary
import com.campuspass.app.model.PayoutRecord
import com.campuspass.app.model.ScanResult
import com.campuspass.app.model.Ticket
import com.campuspass.app.model.UiState
import com.campuspass.app.model.UserProfile
import com.campuspass.app.ui.components.GateQrScannerPanel
import com.campuspass.app.ui.theme.AmberDark
import com.campuspass.app.ui.theme.AmberSoft
import com.campuspass.app.ui.theme.AmberVibrant
import com.campuspass.app.ui.theme.EmeraldSoft
import com.campuspass.app.ui.theme.EmeraldVerified
import com.campuspass.app.ui.theme.IndigoDeep
import com.campuspass.app.ui.theme.IndigoPrimary
import com.campuspass.app.ui.theme.IndigoSoft
import com.campuspass.app.ui.theme.MonoFontFamily
import com.campuspass.app.ui.theme.RoseAlert
import com.campuspass.app.ui.theme.RoseSoft
import com.campuspass.app.viewmodel.HostSubTab

@Composable
fun HostDashboardScreen(
    selectedSubTab: HostSubTab,
    userProfile: UserProfile?,
    hostEventsState: UiState<List<CollegeEvent>>,
    recentGateEntries: List<Ticket>,
    hostPayoutsState: UiState<List<PayoutRecord>>,
    revenueSummary: HostRevenueSummary,
    scannerTargetEvent: CollegeEvent?,
    lastScanResult: ScanResult?,
    onSelectSubTab: (HostSubTab) -> Unit,
    onOpenVolunteerShare: (CollegeEvent) -> Unit,
    onOpenScanner: (CollegeEvent?) -> Unit,
    onOrganizerQrDetected: (String) -> Unit,
    onClearScanResult: () -> Unit,
    onCreateEvent: (
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
    ) -> Unit,
    onCancelEvent: (CollegeEvent) -> Unit,
    onDeleteEvent: (CollegeEvent) -> Unit,
    onRequestPayout: (
        hostName: String,
        amount: Long,
        method: String,
        destination: String,
        accountHolderName: String,
        onComplete: (Result<PayoutRecord>) -> Unit
    ) -> Unit
) {
    var showCreateEventDialog by remember { mutableStateOf(false) }
    var showPayoutDialog by remember { mutableStateOf(false) }

    if (showCreateEventDialog) {
        BackHandler { showCreateEventDialog = false }
        CreateEventDialog(
            defaultHostName = userProfile?.name.orEmpty().ifBlank { "Campus Organizer" },
            onDismiss = { showCreateEventDialog = false },
            onCreate = { hostName, title, desc, img, date, start, end, loc, venue, price, cap, cat, onDone ->
                onCreateEvent(hostName, title, desc, img, date, start, end, loc, venue, price, cap, cat) { res ->
                    onDone(res)
                    if (res.isSuccess) showCreateEventDialog = false
                }
            }
        )
    }

    if (showPayoutDialog) {
        BackHandler { showPayoutDialog = false }
        WithdrawPayoutDialog(
            availableBalance = revenueSummary.availableBalance,
            defaultHolderName = userProfile?.name.orEmpty(),
            onDismiss = { showPayoutDialog = false },
            onSubmit = { amount, method, dest, holder, onDone ->
                onRequestPayout(
                    userProfile?.name.orEmpty().ifBlank { "Organizer" },
                    amount,
                    method,
                    dest,
                    holder
                ) { res ->
                    onDone(res)
                    if (res.isSuccess) showPayoutDialog = false
                }
            }
        )
    }

    if (scannerTargetEvent != null) {
        BackHandler { onOpenScanner(null) }
        OrganizerScannerDialog(
            event = scannerTargetEvent,
            lastResult = lastScanResult,
            onDismiss = { onOpenScanner(null) },
            onQrDetected = onOrganizerQrDetected,
            onClearResult = onClearScanResult
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Spacer(Modifier.height(8.dp))

        TabRow(
            selectedTabIndex = HostSubTab.entries.indexOf(selectedSubTab),
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            contentColor = IndigoPrimary
        ) {
            HostSubTab.entries.forEach { tab ->
                Tab(
                    selected = selectedSubTab == tab,
                    onClick = { onSelectSubTab(tab) },
                    text = { Text(tab.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    modifier = Modifier.testTag("host_subtab_${tab.name.lowercase()}")
                )
            }
        }

        Spacer(Modifier.height(10.dp))

        val hostEvents = (hostEventsState as? UiState.Success)?.data.orEmpty()

        when (selectedSubTab) {
            HostSubTab.OVERVIEW -> {
                HostOverviewContent(
                    summary = revenueSummary,
                    hostEvents = hostEvents,
                    recentGateEntries = recentGateEntries,
                    onOpenVolunteerShare = onOpenVolunteerShare,
                    onOpenScanner = onOpenScanner,
                    onOpenCreateEvent = { showCreateEventDialog = true }
                )
            }
            HostSubTab.MY_EVENTS -> {
                HostMyEventsContent(
                    eventsState = hostEventsState,
                    onAddEventClick = { showCreateEventDialog = true },
                    onOpenVolunteerShare = onOpenVolunteerShare,
                    onOpenScanner = onOpenScanner,
                    onCancelEvent = onCancelEvent,
                    onDeleteEvent = onDeleteEvent
                )
            }
            HostSubTab.REVENUE -> {
                HostRevenueContent(
                    summary = revenueSummary,
                    payoutsState = hostPayoutsState,
                    onWithdrawClick = { showPayoutDialog = true }
                )
            }
        }
    }
}

@Composable
private fun HostOverviewContent(
    summary: HostRevenueSummary,
    hostEvents: List<CollegeEvent>,
    recentGateEntries: List<Ticket>,
    onOpenVolunteerShare: (CollegeEvent) -> Unit,
    onOpenScanner: (CollegeEvent?) -> Unit,
    onOpenCreateEvent: () -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(top = 4.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    KpiStatCard(
                        label = "My Events",
                        value = summary.totalEvents.toString(),
                        accent = IndigoPrimary,
                        modifier = Modifier.weight(1f)
                    )
                    KpiStatCard(
                        label = "Passes Sold",
                        value = summary.totalTicketsSold.toString(),
                        accent = IndigoDeep,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    KpiStatCard(
                        label = "Checked-In",
                        value = summary.totalCheckedIn.toString(),
                        accent = EmeraldVerified,
                        modifier = Modifier.weight(1f)
                    )
                    KpiStatCard(
                        label = "Gross Revenue",
                        value = "₹${summary.totalRevenue}",
                        accent = AmberDark,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Strict Organizer-Isolated Recent Gate Entries (newest at top)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Recent Gate Entries",
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Strictly your events only • Latest entry pinned at top",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Surface(shape = RoundedCornerShape(10.dp), color = EmeraldSoft) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(Icons.Filled.Shield, contentDescription = null, tint = EmeraldVerified, modifier = Modifier.size(14.dp))
                        Text("ISOLATED", style = MaterialTheme.typography.labelMedium, color = EmeraldVerified)
                    }
                }
            }
        }

        if (recentGateEntries.isEmpty()) {
            item {
                Card(
                    shape = MaterialTheme.shapes.large,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("No gate entries recorded yet", style = MaterialTheme.typography.titleMedium)
                        Text(
                            text = "Scanned student passes for your events appear here live, with the newest check-in at the top.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        } else {
            itemsIndexed(recentGateEntries, key = { _, t -> t.id }) { index, entry ->
                val isLatest = index == 0
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isLatest) EmeraldSoft.copy(alpha = 0.55f) else MaterialTheme.colorScheme.surface
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .then(
                            if (isLatest) {
                                Modifier.border(1.5.dp, EmeraldVerified, RoundedCornerShape(16.dp))
                            } else {
                                Modifier
                            }
                        )
                        .testTag("recent_gate_entry_$index")
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.CheckCircle,
                            contentDescription = "Checked in",
                            tint = EmeraldVerified,
                            modifier = Modifier.size(28.dp)
                        )
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            if (isLatest) {
                                Surface(shape = RoundedCornerShape(6.dp), color = EmeraldVerified) {
                                    Text(
                                        text = "JUST ENTERED • TOP",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = Color.White,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            Text(
                                text = entry.userName + if (entry.rollNo.isNotBlank()) " (${entry.rollNo})" else "",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "${entry.eventTitle} • ${entry.id}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = entry.entryTime.ifBlank { "Entered" },
                                style = MaterialTheme.typography.labelMedium.copy(fontFamily = MonoFontFamily),
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (entry.verifiedBy == "volunteer") AmberSoft else IndigoSoft
                            ) {
                                Text(
                                    text = if (entry.verifiedBy == "volunteer") "VOLUNTEER" else "ORGANIZER",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (entry.verifiedBy == "volunteer") AmberDark else IndigoPrimary,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HostMyEventsContent(
    eventsState: UiState<List<CollegeEvent>>,
    onAddEventClick: () -> Unit,
    onOpenVolunteerShare: (CollegeEvent) -> Unit,
    onOpenScanner: (CollegeEvent) -> Unit,
    onCancelEvent: (CollegeEvent) -> Unit,
    onDeleteEvent: (CollegeEvent) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Your Published Events",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface
            )
            Button(
                onClick = onAddEventClick,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                modifier = Modifier
                    .minimumInteractiveComponentSize()
                    .testTag("add_event_button")
            ) {
                Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Add Event")
            }
        }

        Spacer(Modifier.height(10.dp))

        when (eventsState) {
            is UiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = IndigoPrimary)
                }
            }
            is UiState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(eventsState.message, color = MaterialTheme.colorScheme.error)
                }
            }
            is UiState.Success -> {
                val events = eventsState.data
                if (events.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.Event, contentDescription = null, modifier = Modifier.size(48.dp))
                            Spacer(Modifier.height(8.dp))
                            Text("You haven't created any events yet", style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.height(10.dp))
                            Button(onClick = onAddEventClick) {
                                Text("Create Your First Event")
                            }
                        }
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(top = 4.dp, bottom = 28.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(events, key = { it.id }) { event ->
                            Card(
                                shape = MaterialTheme.shapes.large,
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = event.title,
                                                style = MaterialTheme.typography.titleLarge,
                                                maxLines = 2,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Text(
                                                text = "${event.date} • ${event.venue} • ${event.ticketsSold}/${event.capacity} sold",
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                        Surface(
                                            shape = RoundedCornerShape(10.dp),
                                            color = if (event.cancelledFlag) RoseSoft else EmeraldSoft
                                        ) {
                                            Text(
                                                text = event.status.uppercase(),
                                                style = MaterialTheme.typography.labelMedium,
                                                color = if (event.cancelledFlag) RoseAlert else EmeraldVerified,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                    }

                                    // Prominent Volunteer Code & Link button requested by user
                                    Button(
                                        onClick = { onOpenVolunteerShare(event) },
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = AmberSoft,
                                            contentColor = AmberDark
                                        ),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .minimumInteractiveComponentSize()
                                            .testTag("volunteer_code_link_button_${event.id}")
                                    ) {
                                        Icon(Icons.Filled.Key, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(
                                            text = "Volunteer Code & Link • PIN ${event.gatePin}",
                                            fontWeight = FontWeight.Bold
                                        )
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Button(
                                            onClick = { onOpenScanner(event) },
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                                            modifier = Modifier.weight(1f).minimumInteractiveComponentSize()
                                        ) {
                                            Icon(Icons.Filled.QrCodeScanner, contentDescription = null, modifier = Modifier.size(18.dp))
                                            Spacer(Modifier.width(6.dp))
                                            Text("Scan Gate")
                                        }
                                        if (!event.cancelledFlag) {
                                            OutlinedButton(
                                                onClick = { onCancelEvent(event) },
                                                shape = RoundedCornerShape(12.dp),
                                                modifier = Modifier.minimumInteractiveComponentSize()
                                            ) {
                                                Text("Cancel")
                                            }
                                        }
                                        IconButton(
                                            onClick = { onDeleteEvent(event) },
                                            modifier = Modifier.minimumInteractiveComponentSize()
                                        ) {
                                            Icon(
                                                Icons.Filled.Delete,
                                                contentDescription = "Delete Event",
                                                tint = RoseAlert
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HostRevenueContent(
    summary: HostRevenueSummary,
    payoutsState: UiState<List<PayoutRecord>>,
    onWithdrawClick: () -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(top = 4.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(
                shape = MaterialTheme.shapes.extraLarge,
                colors = CardDefaults.cardColors(containerColor = IndigoDeep),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "AVAILABLE PAYOUT BALANCE",
                        style = MaterialTheme.typography.labelMedium,
                        color = AmberVibrant
                    )
                    Text(
                        text = "₹${summary.availableBalance}",
                        style = MaterialTheme.typography.displayLarge,
                        color = Color.White
                    )
                    Text(
                        text = "Gross: ₹${summary.totalRevenue}  •  Transferred: ₹${summary.totalTransferred}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                    Button(
                        onClick = onWithdrawClick,
                        enabled = summary.availableBalance > 0L,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AmberVibrant,
                            contentColor = IndigoDeep
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("withdraw_payout_button")
                    ) {
                        Icon(Icons.Filled.AccountBalanceWallet, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Withdraw to UPI / Bank", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Text(
                text = "Transfer Ledger",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        when (payoutsState) {
            is UiState.Loading -> item { CircularProgressIndicator() }
            is UiState.Error -> item { Text(payoutsState.message, color = RoseAlert) }
            is UiState.Success -> {
                val payouts = payoutsState.data
                if (payouts.isEmpty()) {
                    item {
                        Text(
                            text = "No payouts withdrawn yet.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                } else {
                    items(payouts, key = { it.id }) { pay ->
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "${pay.method} • ${pay.destination}",
                                        style = MaterialTheme.typography.titleMedium
                                    )
                                    Text(
                                        text = "Ref: ${pay.referenceId} • ${pay.accountHolderName}",
                                        style = MaterialTheme.typography.bodyMedium.copy(fontFamily = MonoFontFamily),
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Text(
                                    text = "₹${pay.amount}",
                                    style = MaterialTheme.typography.titleLarge,
                                    color = EmeraldVerified
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun KpiStatCard(
    label: String,
    value: String,
    accent: Color,
    modifier: Modifier = Modifier
) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
                color = accent
            )
        }
    }
}

@Composable
private fun OrganizerScannerDialog(
    event: CollegeEvent,
    lastResult: ScanResult?,
    onDismiss: () -> Unit,
    onQrDetected: (String) -> Unit,
    onClearResult: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            shape = MaterialTheme.shapes.extraLarge,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth(0.94f)
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Organizer Gate Scanner", style = MaterialTheme.typography.titleLarge)
                        Text(
                            text = "Locked to your events (${event.title})",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Filled.Close, contentDescription = "Close scanner")
                    }
                }

                GateQrScannerPanel(
                    lastResult = lastResult,
                    onQrDetected = onQrDetected,
                    onClearResult = onClearResult
                )
            }
        }
    }
}

@Composable
private fun CreateEventDialog(
    defaultHostName: String,
    onDismiss: () -> Unit,
    onCreate: (
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
        onDone: (Result<CollegeEvent>) -> Unit
    ) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("2026-12-15") }
    var startTime by remember { mutableStateOf("10:00 AM") }
    var endTime by remember { mutableStateOf("05:00 PM") }
    var venue by remember { mutableStateOf("Main Auditorium") }
    var location by remember { mutableStateOf("Central Campus") }
    var priceStr by remember { mutableStateOf("199") }
    var capacityStr by remember { mutableStateOf("150") }
    var category by remember { mutableStateOf(EventCategory.HACKATHON) }
    var submitting by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            shape = MaterialTheme.shapes.extraLarge,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth(0.94f)
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Publish Campus Event", style = MaterialTheme.typography.titleLarge)
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Filled.Close, contentDescription = "Close")
                    }
                }

                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Event Title*") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("create_event_title_input")
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = date,
                        onValueChange = { date = it },
                        label = { Text("Date") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = startTime,
                        onValueChange = { startTime = it },
                        label = { Text("Start") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = venue,
                        onValueChange = { venue = it },
                        label = { Text("Venue") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = location,
                        onValueChange = { location = it },
                        label = { Text("Campus / City") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = priceStr,
                        onValueChange = { priceStr = it.filter { c -> c.isDigit() } },
                        label = { Text("Price (₹)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = capacityStr,
                        onValueChange = { capacityStr = it.filter { c -> c.isDigit() } },
                        label = { Text("Capacity") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }

                Text("Category", style = MaterialTheme.typography.labelLarge)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    EventCategory.creatable.take(4).forEach { cat ->
                        FilterChip(
                            selected = category == cat,
                            onClick = { category = cat },
                            label = { Text(cat.label) }
                        )
                    }
                }

                if (errorMsg != null) {
                    Text(errorMsg.orEmpty(), color = RoseAlert, style = MaterialTheme.typography.bodyMedium)
                }

                Button(
                    onClick = {
                        val price = priceStr.toLongOrNull() ?: 0L
                        val cap = capacityStr.toLongOrNull() ?: 100L
                        if (title.trim().length < 2) {
                            errorMsg = "Enter an event title (at least 2 chars)."
                            return@Button
                        }
                        submitting = true
                        errorMsg = null
                        onCreate(
                            defaultHostName,
                            title,
                            description,
                            "",
                            date,
                            startTime,
                            endTime,
                            location,
                            venue,
                            price,
                            cap,
                            category.label
                        ) { res ->
                            submitting = false
                            res.onFailure { errorMsg = it.localizedMessage ?: "Failed to create event." }
                        }
                    },
                    enabled = !submitting,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .testTag("submit_create_event_button")
                ) {
                    if (submitting) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Text("Publish Event & Generate Gate PIN")
                    }
                }
            }
        }
    }
}

@Composable
private fun WithdrawPayoutDialog(
    availableBalance: Long,
    defaultHolderName: String,
    onDismiss: () -> Unit,
    onSubmit: (
        amount: Long,
        method: String,
        destination: String,
        holderName: String,
        onDone: (Result<PayoutRecord>) -> Unit
    ) -> Unit
) {
    var amountStr by remember { mutableStateOf(availableBalance.toString()) }
    var method by remember { mutableStateOf("UPI") }
    var destination by remember { mutableStateOf("") }
    var holderName by remember { mutableStateOf(defaultHolderName) }
    var submitting by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = MaterialTheme.shapes.extraLarge,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Withdraw Event Revenue", style = MaterialTheme.typography.titleLarge)
                Text("Available: ₹$availableBalance", style = MaterialTheme.typography.bodyMedium, color = EmeraldVerified)

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = method == "UPI", onClick = { method = "UPI" }, label = { Text("UPI") })
                    FilterChip(selected = method == "BANK", onClick = { method = "BANK" }, label = { Text("Bank Transfer") })
                }

                OutlinedTextField(
                    value = amountStr,
                    onValueChange = { amountStr = it.filter { c -> c.isDigit() } },
                    label = { Text("Amount (₹)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = destination,
                    onValueChange = { destination = it },
                    label = { Text(if (method == "UPI") "UPI ID (e.g. fest@okaxis)" else "Bank Account / IFSC") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = holderName,
                    onValueChange = { holderName = it },
                    label = { Text("Beneficiary Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                if (errorMsg != null) {
                    Text(errorMsg.orEmpty(), color = RoseAlert, style = MaterialTheme.typography.bodyMedium)
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text("Cancel") }
                    Button(
                        onClick = {
                            val amt = amountStr.toLongOrNull() ?: 0L
                            if (amt < 1L || amt > availableBalance) {
                                errorMsg = "Enter an amount between ₹1 and ₹$availableBalance"
                                return@Button
                            }
                            submitting = true
                            errorMsg = null
                            onSubmit(amt, method, destination, holderName) { res ->
                                submitting = false
                                res.onFailure { errorMsg = it.localizedMessage ?: "Payout failed" }
                            }
                        },
                        enabled = !submitting,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (submitting) "Sending..." else "Withdraw")
                    }
                }
            }
        }
    }
}
