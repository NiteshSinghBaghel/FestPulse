package com.campuspass.app.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.campuspass.app.model.CollegeEvent
import com.campuspass.app.model.EventCategory
import com.campuspass.app.model.Ticket
import com.campuspass.app.model.UiState
import com.campuspass.app.model.UserProfile
import com.campuspass.app.ui.theme.AmberDark
import com.campuspass.app.ui.theme.AmberSoft
import com.campuspass.app.ui.theme.EmeraldSoft
import com.campuspass.app.ui.theme.EmeraldVerified
import com.campuspass.app.ui.theme.IndigoDeep
import com.campuspass.app.ui.theme.IndigoPrimary
import com.campuspass.app.ui.theme.IndigoSoft
import com.campuspass.app.ui.theme.RoseAlert
import com.campuspass.app.ui.theme.RoseSoft

@Composable
fun ExploreEventsScreen(
    eventsState: UiState<List<CollegeEvent>>,
    searchQuery: String,
    selectedCategory: EventCategory,
    currentUid: String,
    userProfile: UserProfile?,
    onSearchChange: (String) -> Unit,
    onCategorySelect: (EventCategory) -> Unit,
    onOpenVolunteerShare: (CollegeEvent) -> Unit,
    onBookTicket: (
        event: CollegeEvent,
        name: String,
        email: String,
        college: String,
        rollNo: String,
        onDone: (Result<Ticket>) -> Unit
    ) -> Unit
) {
    var detailEvent by remember { mutableStateOf<CollegeEvent?>(null) }
    var bookingEvent by remember { mutableStateOf<CollegeEvent?>(null) }

    if (detailEvent != null) {
        BackHandler { detailEvent = null }
        EventDetailDialog(
            event = detailEvent!!,
            isOwner = detailEvent!!.hostId == currentUid,
            onDismiss = { detailEvent = null },
            onBookClick = {
                val target = detailEvent
                detailEvent = null
                bookingEvent = target
            },
            onShareVolunteerClick = {
                val target = detailEvent!!
                detailEvent = null
                onOpenVolunteerShare(target)
            }
        )
    }

    if (bookingEvent != null) {
        BackHandler { bookingEvent = null }
        BookPassDialog(
            event = bookingEvent!!,
            userProfile = userProfile,
            onDismiss = { bookingEvent = null },
            onConfirmBooking = { name, email, college, rollNo, onDone ->
                onBookTicket(bookingEvent!!, name, email, college, rollNo) { res ->
                    onDone(res)
                    if (res.isSuccess) {
                        bookingEvent = null
                    }
                }
            }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Spacer(Modifier.height(10.dp))

        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            placeholder = { Text("Search hackathons, concerts, venues...") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = "Search") },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { onSearchChange("") }) {
                        Icon(Icons.Filled.Close, contentDescription = "Clear search")
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("explore_search_input")
        )

        Spacer(Modifier.height(10.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            EventCategory.entries.forEach { cat ->
                FilterChip(
                    selected = selectedCategory == cat,
                    onClick = { onCategorySelect(cat) },
                    label = { Text(cat.label) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = IndigoPrimary,
                        selectedLabelColor = Color.White
                    ),
                    modifier = Modifier.testTag("category_chip_${cat.name.lowercase()}")
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        when (eventsState) {
            is UiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = IndigoPrimary)
                }
            }
            is UiState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = eventsState.message,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
            is UiState.Success -> {
                val events = eventsState.data
                if (events.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Filled.ConfirmationNumber,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = "No matching campus events yet",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "Switch to Organizer mode to publish your first college fest!",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(top = 4.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(events, key = { it.id }) { event ->
                            EventCardItem(
                                event = event,
                                isOwner = event.hostId == currentUid,
                                onCardClick = { detailEvent = event },
                                onBookClick = { bookingEvent = event },
                                onVolunteerCodeClick = { onOpenVolunteerShare(event) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EventCardItem(
    event: CollegeEvent,
    isOwner: Boolean,
    onCardClick: () -> Unit,
    onBookClick: () -> Unit,
    onVolunteerCodeClick: () -> Unit
) {
    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onCardClick)
            .testTag("event_card_${event.id}")
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(164.dp)
            ) {
                AsyncImage(
                    model = event.imageUrl,
                    contentDescription = event.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxSize()
                        .background(IndigoSoft)
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = IndigoDeep.copy(alpha = 0.85f)
                    ) {
                        Text(
                            text = event.category.uppercase(),
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                        )
                    }
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = if (event.price == 0L) EmeraldSoft else AmberSoft
                    ) {
                        Text(
                            text = if (event.price == 0L) "FREE PASS" else "₹${event.price}",
                            style = MaterialTheme.typography.labelLarge,
                            color = if (event.price == 0L) EmeraldVerified else AmberDark,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                        )
                    }
                }
            }

            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = event.title,
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.CalendarToday,
                        contentDescription = null,
                        tint = IndigoPrimary,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "${event.date} • ${event.startTime}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.LocationOn,
                        contentDescription = null,
                        tint = IndigoPrimary,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "${event.venue}, ${event.location}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "${event.ticketsSold}/${event.capacity} booked",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = if (event.soldOutFlag) "SOLD OUT" else "${event.availableTickets} left",
                            style = MaterialTheme.typography.labelMedium,
                            color = if (event.soldOutFlag) RoseAlert else EmeraldVerified
                        )
                    }
                    LinearProgressIndicator(
                        progress = { event.percentBooked / 100f },
                        color = if (event.soldOutFlag) RoseAlert else IndigoPrimary,
                        trackColor = MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(4.dp))
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (isOwner) {
                        OutlinedButton(
                            onClick = onVolunteerCodeClick,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .weight(1f)
                                .minimumInteractiveComponentSize()
                                .testTag("explore_volunteer_code_${event.id}")
                        ) {
                            Icon(Icons.Filled.Key, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Volunteer Code & Link", maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    Button(
                        onClick = onBookClick,
                        enabled = !event.soldOutFlag && !event.cancelledFlag,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                        modifier = Modifier
                            .weight(1f)
                            .minimumInteractiveComponentSize()
                            .testTag("book_event_button_${event.id}")
                    ) {
                        Text(
                            text = when {
                                event.cancelledFlag -> "Cancelled"
                                event.soldOutFlag -> "Sold Out"
                                else -> "Book Pass"
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EventDetailDialog(
    event: CollegeEvent,
    isOwner: Boolean,
    onDismiss: () -> Unit,
    onBookClick: () -> Unit,
    onShareVolunteerClick: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Card(
            shape = MaterialTheme.shapes.extraLarge,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier.fillMaxWidth(0.92f)
        ) {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Box(modifier = Modifier.height(200.dp).fillMaxWidth()) {
                    AsyncImage(
                        model = event.imageUrl,
                        contentDescription = event.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().background(IndigoSoft)
                    )
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .background(Color.Black.copy(alpha = 0.55f), RoundedCornerShape(12.dp))
                    ) {
                        Icon(Icons.Filled.Close, contentDescription = "Close", tint = Color.White)
                    }
                }
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = event.title,
                        style = MaterialTheme.typography.headlineMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Hosted by ${event.hostName}",
                        style = MaterialTheme.typography.labelLarge,
                        color = IndigoPrimary
                    )
                    Text(
                        text = "${event.date} • ${event.startTime} - ${event.endTime}\n${event.venue}, ${event.location}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = event.description,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (isOwner) {
                        OutlinedButton(
                            onClick = onShareVolunteerClick,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth().minimumInteractiveComponentSize()
                        ) {
                            Icon(Icons.Filled.Key, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Volunteer Code & Link")
                        }
                    }
                    Button(
                        onClick = onBookClick,
                        enabled = !event.soldOutFlag && !event.cancelledFlag,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                        modifier = Modifier.fillMaxWidth().height(50.dp)
                    ) {
                        Text(if (event.price == 0L) "Get Free Instant Pass" else "Book Pass • ₹${event.price}")
                    }
                }
            }
        }
    }
}

@Composable
private fun BookPassDialog(
    event: CollegeEvent,
    userProfile: UserProfile?,
    onDismiss: () -> Unit,
    onConfirmBooking: (
        name: String,
        email: String,
        college: String,
        rollNo: String,
        onDone: (Result<Ticket>) -> Unit
    ) -> Unit
) {
    var name by remember(userProfile) { mutableStateOf(userProfile?.name.orEmpty()) }
    var email by remember(userProfile) { mutableStateOf(userProfile?.email.orEmpty()) }
    var college by remember(userProfile) { mutableStateOf(userProfile?.college.orEmpty().ifBlank { "Main Campus" }) }
    var rollNo by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = MaterialTheme.shapes.extraLarge,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Confirm Student Pass",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "${event.title} • ${if (event.price == 0L) "FREE" else "₹${event.price}"}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = IndigoPrimary
                )

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Full Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("booking_name_input")
                )
                OutlinedTextField(
                    value = college,
                    onValueChange = { college = it },
                    label = { Text("College / Institute") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("booking_college_input")
                )
                OutlinedTextField(
                    value = rollNo,
                    onValueChange = { rollNo = it },
                    label = { Text("Student Roll No / ID") },
                    placeholder = { Text("e.g. CS2026-042") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("booking_roll_input")
                )

                if (errorMsg != null) {
                    Surface(shape = RoundedCornerShape(10.dp), color = RoseSoft) {
                        Text(
                            text = errorMsg.orEmpty(),
                            style = MaterialTheme.typography.bodyMedium,
                            color = RoseAlert,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        enabled = !submitting,
                        modifier = Modifier.weight(1f).minimumInteractiveComponentSize()
                    ) {
                        Text("Cancel")
                    }
                    Button(
                        onClick = {
                            if (name.trim().isEmpty()) {
                                errorMsg = "Enter attendee name"
                                return@Button
                            }
                            submitting = true
                            errorMsg = null
                            onConfirmBooking(name, email, college, rollNo) { res ->
                                submitting = false
                                res.onFailure { errorMsg = it.localizedMessage ?: "Booking failed" }
                            }
                        },
                        enabled = !submitting,
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                        modifier = Modifier
                            .weight(1f)
                            .minimumInteractiveComponentSize()
                            .testTag("confirm_book_pass_button")
                    ) {
                        if (submitting) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Text(if (event.price == 0L) "Issue Pass" else "Pay ₹${event.price}")
                        }
                    }
                }
            }
        }
    }
}
