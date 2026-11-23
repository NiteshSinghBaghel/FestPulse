package com.campuspass.app.ui.screens

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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.campuspass.app.model.CollegeEvent
import com.campuspass.app.model.ScanResult
import com.campuspass.app.ui.components.GateQrScannerPanel
import com.campuspass.app.ui.theme.AmberSoft
import com.campuspass.app.ui.theme.AmberVibrant
import com.campuspass.app.ui.theme.EmeraldSoft
import com.campuspass.app.ui.theme.EmeraldVerified
import com.campuspass.app.ui.theme.IndigoDeep
import com.campuspass.app.ui.theme.IndigoPrimary
import com.campuspass.app.ui.theme.MonoFontFamily
import com.campuspass.app.ui.theme.RoseAlert
import com.campuspass.app.ui.theme.RoseSoft

@Composable
fun VolunteerGateScannerScreen(
    pinInput: String,
    activeEvent: CollegeEvent?,
    isValidating: Boolean,
    pinError: String?,
    lastScanResult: ScanResult?,
    sessionLog: List<ScanResult>,
    onPinInputChange: (String) -> Unit,
    onUnlockGate: () -> Unit,
    onExitGateSession: () -> Unit,
    onSignOutClick: () -> Unit,
    onQrDetected: (String) -> Unit,
    onClearResult: () -> Unit
) {
    if (activeEvent == null) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                shape = MaterialTheme.shapes.extraLarge,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
                modifier = Modifier
                    .widthIn(max = 480.dp)
                    .fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(22.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(18.dp),
                        color = AmberSoft,
                        modifier = Modifier.size(60.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Filled.Key,
                                contentDescription = "Gate PIN",
                                tint = IndigoDeep,
                                modifier = Modifier.size(30.dp)
                            )
                        }
                    }

                    Text(
                        text = "Volunteer Gate Verification",
                        style = MaterialTheme.typography.headlineMedium,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = "Enter the 6-digit Gate PIN provided by your event organizer to start scanning passes.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )

                    OutlinedTextField(
                        value = pinInput,
                        onValueChange = onPinInputChange,
                        label = { Text("6-Digit Event Gate PIN") },
                        placeholder = { Text("e.g. 482910") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        textStyle = MaterialTheme.typography.headlineMedium.copy(
                            fontFamily = MonoFontFamily,
                            textAlign = TextAlign.Center,
                            letterSpacing = 6.sp
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("volunteer_pin_input")
                    )

                    if (pinError != null) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = RoseSoft,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = pinError,
                                style = MaterialTheme.typography.bodyMedium,
                                color = RoseAlert,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    Button(
                        onClick = onUnlockGate,
                        enabled = !isValidating && pinInput.length == 6,
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .testTag("unlock_gate_scanner_button")
                    ) {
                        if (isValidating) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("Verifying PIN...")
                        } else {
                            Icon(Icons.Filled.LockOpen, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Unlock Gate Scanner", style = MaterialTheme.typography.labelLarge)
                        }
                    }

                    TextButton(
                        onClick = onSignOutClick,
                        modifier = Modifier.minimumInteractiveComponentSize()
                    ) {
                        Icon(Icons.Filled.Logout, contentDescription = null, modifier = Modifier.size(16.dp), tint = RoseAlert)
                        Spacer(Modifier.width(6.dp))
                        Text("Back to Sign In", color = RoseAlert)
                    }
                }
            }
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            item {
                Card(
                    shape = MaterialTheme.shapes.large,
                    colors = CardDefaults.cardColors(containerColor = IndigoDeep),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Surface(shape = RoundedCornerShape(8.dp), color = AmberVibrant) {
                                Text(
                                    text = "GATE SCANNER • PIN ${activeEvent.gatePin}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = IndigoDeep,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                            Text(
                                text = activeEvent.title,
                                style = MaterialTheme.typography.titleLarge,
                                color = Color.White
                            )
                            Text(
                                text = "${activeEvent.date} • ${activeEvent.venue}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.8f)
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            OutlinedButton(
                                onClick = onExitGateSession,
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                                modifier = Modifier
                                    .minimumInteractiveComponentSize()
                                    .testTag("exit_volunteer_gate_button")
                            ) {
                                Icon(Icons.Filled.ExitToApp, contentDescription = "Change PIN", modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("PIN")
                            }
                            OutlinedButton(
                                onClick = onSignOutClick,
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = AmberVibrant),
                                modifier = Modifier.minimumInteractiveComponentSize()
                            ) {
                                Text("Exit")
                            }
                        }
                    }
                }
            }

            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = EmeraldSoft,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Filled.Shield, contentDescription = null, tint = EmeraldVerified)
                        Text(
                            text = "Verified entries sync immediately to the event organizer's dashboard.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = EmeraldVerified
                        )
                    }
                }
            }

            item {
                GateQrScannerPanel(
                    lastResult = lastScanResult,
                    onQrDetected = onQrDetected,
                    onClearResult = onClearResult
                )
            }

            if (sessionLog.isNotEmpty()) {
                item {
                    Text(
                        text = "Checked In During This Shift (${sessionLog.size})",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
                itemsIndexed(sessionLog) { idx, item ->
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        modifier = Modifier
                            .fillMaxWidth()
                            .then(
                                if (idx == 0) Modifier.border(1.dp, EmeraldVerified, RoundedCornerShape(14.dp))
                                else Modifier
                            )
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = EmeraldVerified)
                            Column(modifier = Modifier.weight(1f)) {
                                Text(item.attendeeName.ifBlank { "Attendee" }, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    text = "${item.ticketId} • ${item.rollNo.ifBlank { item.college }}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = item.entryTime,
                                style = MaterialTheme.typography.labelMedium.copy(fontFamily = MonoFontFamily)
                            )
                        }
                    }
                }
            }
        }
    }
}
