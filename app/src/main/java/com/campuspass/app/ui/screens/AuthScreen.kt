package com.campuspass.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.credentials.CredentialManager
import com.campuspass.app.R
import com.campuspass.app.auth.CredentialAuthHelper
import com.campuspass.app.model.UserRole
import com.campuspass.app.ui.theme.AmberVibrant
import com.campuspass.app.ui.theme.EmeraldVerified
import com.campuspass.app.ui.theme.IndigoDeep
import com.campuspass.app.ui.theme.IndigoPrimary
import com.campuspass.app.ui.theme.MonoFontFamily

enum class AuthPortalOption(
    val title: String,
    val subtitle: String
) {
    STUDENT("Student", "Explore fests & book passes"),
    ORGANIZER("Event Organizer", "Publish events, manage gate & payouts"),
    VOLUNTEER("Gate Volunteer (Gate PIN)", "Verify student QR passes using 6-digit PIN")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen(
    selectedRole: UserRole,
    onSelectRole: (UserRole) -> Unit,
    pendingGatePin: String,
    onAuthSuccess: (launchVolunteerMode: Boolean, enteredPin: String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }

    var portalOption by remember(pendingGatePin) {
        mutableStateOf(
            when {
                pendingGatePin.length == 6 -> AuthPortalOption.VOLUNTEER
                selectedRole == UserRole.HOST -> AuthPortalOption.ORGANIZER
                else -> AuthPortalOption.STUDENT
            }
        )
    }
    var dropdownExpanded by remember { mutableStateOf(false) }
    var gatePinInput by remember(pendingGatePin) { mutableStateOf(pendingGatePin) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        CredentialAuthHelper.attemptAutoSignIn(
            context = context,
            credentialManager = credentialManager,
            scope = scope,
            onAuthSuccess = {
                onAuthSuccess(portalOption == AuthPortalOption.VOLUNTEER, gatePinInput)
            },
            onUnauthenticated = { }
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(IndigoDeep, Color(0xFF312E81), MaterialTheme.colorScheme.background)
                )
            )
            .safeDrawingPadding()
            .padding(horizontal = 20.dp, vertical = 24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 520.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = AmberVibrant,
                shadowElevation = 6.dp,
                modifier = Modifier.size(64.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Filled.ConfirmationNumber,
                        contentDescription = stringResource(R.string.app_name),
                        tint = IndigoDeep,
                        modifier = Modifier.size(34.dp)
                    )
                }
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = stringResource(R.string.app_name),
                    style = MaterialTheme.typography.displayLarge,
                    color = Color.White,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = stringResource(R.string.tagline),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.85f),
                    textAlign = TextAlign.Center
                )
            }

            Card(
                shape = MaterialTheme.shapes.extraLarge,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(22.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Sign In Portal",
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    // Single clean Portal Dropdown (Student / Organizer / Gate PIN)
                    ExposedDropdownMenuBox(
                        expanded = dropdownExpanded,
                        onExpandedChange = { dropdownExpanded = !dropdownExpanded }
                    ) {
                        OutlinedTextField(
                            value = portalOption.title,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Select Login Mode") },
                            leadingIcon = {
                                Icon(
                                    imageVector = when (portalOption) {
                                        AuthPortalOption.STUDENT -> Icons.Filled.ConfirmationNumber
                                        AuthPortalOption.ORGANIZER -> Icons.Filled.Event
                                        AuthPortalOption.VOLUNTEER -> Icons.Filled.Key
                                    },
                                    contentDescription = null,
                                    tint = IndigoPrimary
                                )
                            },
                            trailingIcon = {
                                ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded)
                            },
                            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                                .fillMaxWidth()
                                .testTag("portal_role_dropdown")
                        )

                        ExposedDropdownMenu(
                            expanded = dropdownExpanded,
                            onDismissRequest = { dropdownExpanded = false }
                        ) {
                            AuthPortalOption.entries.forEach { option ->
                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text(
                                                text = option.title,
                                                style = MaterialTheme.typography.titleMedium
                                            )
                                            Text(
                                                text = option.subtitle,
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = when (option) {
                                                AuthPortalOption.STUDENT -> Icons.Filled.ConfirmationNumber
                                                AuthPortalOption.ORGANIZER -> Icons.Filled.Event
                                                AuthPortalOption.VOLUNTEER -> Icons.Filled.Key
                                            },
                                            contentDescription = null,
                                            tint = IndigoPrimary
                                        )
                                    },
                                    onClick = {
                                        portalOption = option
                                        dropdownExpanded = false
                                        errorMessage = null
                                        when (option) {
                                            AuthPortalOption.STUDENT -> onSelectRole(UserRole.USER)
                                            AuthPortalOption.ORGANIZER -> onSelectRole(UserRole.HOST)
                                            AuthPortalOption.VOLUNTEER -> onSelectRole(UserRole.USER)
                                        }
                                    },
                                    modifier = Modifier.testTag("portal_option_${option.name.lowercase()}")
                                )
                            }
                        }
                    }

                    // Show Gate PIN field ONLY when Gate Volunteer is picked from the dropdown
                    if (portalOption == AuthPortalOption.VOLUNTEER) {
                        OutlinedTextField(
                            value = gatePinInput,
                            onValueChange = { raw ->
                                gatePinInput = raw.filter { it.isDigit() }.take(6)
                                errorMessage = null
                            },
                            label = { Text("6-Digit Event Gate PIN") },
                            placeholder = { Text("e.g. 482910") },
                            leadingIcon = {
                                Icon(Icons.Filled.Key, contentDescription = null, tint = IndigoPrimary)
                            },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            textStyle = MaterialTheme.typography.titleLarge.copy(
                                fontFamily = MonoFontFamily,
                                letterSpacing = 4.sp
                            ),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("landing_gate_pin_input")
                        )
                    }

                    if (errorMessage != null) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.errorContainer,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = errorMessage.orEmpty(),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    Button(
                        onClick = {
                            if (portalOption == AuthPortalOption.VOLUNTEER && gatePinInput.length != 6) {
                                errorMessage = "Enter the 6-digit Gate PIN provided by your organizer."
                                return@Button
                            }
                            errorMessage = null
                            isLoading = true
                            CredentialAuthHelper.onGoogleSignInClicked(
                                context = context,
                                credentialManager = credentialManager,
                                scope = scope,
                                onAuthSuccess = {
                                    isLoading = false
                                    onAuthSuccess(portalOption == AuthPortalOption.VOLUNTEER, gatePinInput)
                                },
                                onAuthError = { msg ->
                                    isLoading = false
                                    errorMessage = msg
                                },
                                onAuthCancelled = {
                                    isLoading = false
                                }
                            )
                        },
                        enabled = !isLoading,
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = IndigoPrimary,
                            contentColor = Color.White
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                            .testTag("google_sign_in_button")
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(22.dp),
                                color = Color.White,
                                strokeWidth = 2.5.dp
                            )
                            Spacer(Modifier.width(10.dp))
                            Text("Signing in...", fontWeight = FontWeight.Bold)
                        } else {
                            Icon(
                                imageVector = Icons.Filled.AccountCircle,
                                contentDescription = null,
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                text = if (portalOption == AuthPortalOption.VOLUNTEER) {
                                    "Sign in & Open Gate Scanner"
                                } else {
                                    stringResource(R.string.sign_in_with_google)
                                },
                                style = MaterialTheme.typography.labelLarge
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Shield,
                            contentDescription = null,
                            tint = EmeraldVerified,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "Strict organizer isolation & instant Firestore sync",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
