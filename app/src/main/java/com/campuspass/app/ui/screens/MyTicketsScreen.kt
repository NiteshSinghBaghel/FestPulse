package com.campuspass.app.ui.screens

import androidx.compose.foundation.Image
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.campuspass.app.model.Ticket
import com.campuspass.app.model.UiState
import com.campuspass.app.ui.theme.EmeraldSoft
import com.campuspass.app.ui.theme.EmeraldVerified
import com.campuspass.app.ui.theme.IndigoDeep
import com.campuspass.app.ui.theme.IndigoPrimary
import com.campuspass.app.ui.theme.IndigoSoft
import com.campuspass.app.ui.theme.MonoFontFamily
import com.campuspass.app.ui.theme.RoseAlert
import com.campuspass.app.ui.theme.RoseSoft
import com.campuspass.app.util.QrCodeUtils

@Composable
fun MyTicketsScreen(
    ticketsState: UiState<List<Ticket>>,
    onCancelTicket: (Ticket) -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Spacer(Modifier.height(8.dp))
        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            contentColor = IndigoPrimary
        ) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                text = { Text("Active Passes") },
                modifier = Modifier.testTag("tab_active_tickets")
            )
            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                text = { Text("Entered / Cancelled") },
                modifier = Modifier.testTag("tab_past_tickets")
            )
        }

        Spacer(Modifier.height(10.dp))

        when (ticketsState) {
            is UiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = IndigoPrimary)
                }
            }
            is UiState.Error -> {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(ticketsState.message, color = MaterialTheme.colorScheme.error)
                }
            }
            is UiState.Success -> {
                val filtered = ticketsState.data.filter { t ->
                    if (selectedTab == 0) {
                        !t.cancelledFlag && !t.enteredFlag
                    } else {
                        t.cancelledFlag || t.enteredFlag
                    }
                }
                if (filtered.isEmpty()) {
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
                                text = if (selectedTab == 0) "No active passes yet" else "No past or checked-in passes",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = "Book an event pass in Explore to see your digital QR pass here.",
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
                        items(filtered, key = { it.id }) { ticket ->
                            TicketPassCard(
                                ticket = ticket,
                                onCancelClick = { onCancelTicket(ticket) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TicketPassCard(
    ticket: Ticket,
    onCancelClick: () -> Unit
) {
    var showQrExpanded by remember(ticket.id) { mutableStateOf(!ticket.cancelledFlag && !ticket.enteredFlag) }
    val qrPayload = remember(ticket.id, ticket.qrToken, ticket.qrHash) { ticket.buildQrPayload() }
    val qrBitmap = remember(qrPayload) { QrCodeUtils.generateQrBitmap(qrPayload, 520) }

    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        modifier = Modifier
            .fillMaxWidth()
            .testTag("ticket_card_${ticket.id}")
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
                        text = ticket.eventTitle,
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "${ticket.eventDate} • ${ticket.eventVenue}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.width(8.dp))
                val (badgeBg, badgeFg, badgeLabel) = when {
                    ticket.cancelledFlag -> Triple(RoseSoft, RoseAlert, "CANCELLED")
                    ticket.enteredFlag -> Triple(EmeraldSoft, EmeraldVerified, "ENTERED")
                    else -> Triple(IndigoSoft, IndigoPrimary, "VALID PASS")
                }
                Surface(shape = RoundedCornerShape(10.dp), color = badgeBg) {
                    Text(
                        text = badgeLabel,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = badgeFg,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                    )
                }
            }

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Text(
                        text = "Attendee: ${ticket.userName}" +
                            if (ticket.rollNo.isNotBlank()) " (${ticket.rollNo})" else "",
                        style = MaterialTheme.typography.titleMedium
                    )
                    if (ticket.college.isNotBlank()) {
                        Text(
                            text = ticket.college,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Text(
                        text = "Pass ID: ${ticket.id} • ${if (ticket.amount == 0L) "FREE" else "₹${ticket.amount}"}",
                        style = MaterialTheme.typography.labelMedium.copy(fontFamily = MonoFontFamily),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (ticket.enteredFlag) {
                Surface(shape = RoundedCornerShape(12.dp), color = EmeraldSoft, modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = EmeraldVerified)
                        Text(
                            text = "Checked in at ${ticket.entryTime.ifBlank { "Gate" }} (${ticket.verifiedBy.ifBlank { "staff" }})",
                            style = MaterialTheme.typography.bodyMedium,
                            color = EmeraldVerified
                        )
                    }
                }
            }

            if (showQrExpanded && !ticket.cancelledFlag) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(IndigoDeep, RoundedCornerShape(18.dp))
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White,
                        modifier = Modifier.padding(4.dp)
                    ) {
                        if (qrBitmap != null) {
                            Image(
                                bitmap = qrBitmap.asImageBitmap(),
                                contentDescription = "Digital Event Entry QR Pass",
                                modifier = Modifier
                                    .size(200.dp)
                                    .padding(10.dp)
                            )
                        } else {
                            Box(
                                modifier = Modifier.size(200.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(ticket.id, fontFamily = MonoFontFamily)
                            }
                        }
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Shield,
                            contentDescription = null,
                            tint = EmeraldVerified,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = "HASH ${ticket.qrHash.take(12).uppercase()}",
                            style = MaterialTheme.typography.labelMedium.copy(fontFamily = MonoFontFamily),
                            color = Color.White.copy(alpha = 0.85f)
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (!ticket.cancelledFlag) {
                    OutlinedButton(
                        onClick = { showQrExpanded = !showQrExpanded },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f).minimumInteractiveComponentSize()
                    ) {
                        Icon(Icons.Filled.QrCode2, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(if (showQrExpanded) "Hide QR" else "Show QR")
                    }
                }
                if (!ticket.cancelledFlag && !ticket.enteredFlag) {
                    OutlinedButton(
                        onClick = onCancelClick,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = RoseAlert),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .minimumInteractiveComponentSize()
                            .testTag("cancel_ticket_button_${ticket.id}")
                    ) {
                        Text("Cancel Pass")
                    }
                }
            }
        }
    }
}
