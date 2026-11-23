package com.campuspass.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.campuspass.app.auth.CredentialAuthHelper
import com.campuspass.app.model.UiState
import com.campuspass.app.model.UserRole
import com.campuspass.app.ui.components.VolunteerGateShareDialog
import com.campuspass.app.ui.screens.AuthScreen
import com.campuspass.app.ui.screens.ExploreEventsScreen
import com.campuspass.app.ui.screens.HostDashboardScreen
import com.campuspass.app.ui.screens.MyTicketsScreen
import com.campuspass.app.ui.screens.ProfileScreen
import com.campuspass.app.ui.screens.VolunteerGateScannerScreen
import com.campuspass.app.ui.theme.CampusPassTheme
import com.campuspass.app.ui.theme.IndigoDeep
import com.campuspass.app.viewmodel.AppTab
import com.campuspass.app.viewmodel.CampusPassViewModel
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.auth

class MainActivity : ComponentActivity() {

    private var deepLinkGatePinState by mutableStateOf("")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        deepLinkGatePinState = extractGatePin(intent)

        setContent {
            CampusPassTheme {
                CampusPassRoot(
                    deepLinkGatePin = deepLinkGatePinState,
                    onConsumeDeepLinkPin = { deepLinkGatePinState = "" }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val pin = extractGatePin(intent)
        if (pin.length == 6) {
            deepLinkGatePinState = pin
        }
    }

    private fun extractGatePin(intent: Intent?): String {
        val raw = intent?.data?.getQueryParameter("gatePin").orEmpty().filter { it.isDigit() }
        return if (raw.length == 6) raw else ""
    }
}

@Composable
private fun CampusPassRoot(
    deepLinkGatePin: String,
    onConsumeDeepLinkPin: () -> Unit
) {
    var currentUser by remember { mutableStateOf<FirebaseUser?>(Firebase.auth.currentUser) }
    var preferredRole by remember { mutableStateOf(UserRole.USER) }
    var launchVolunteerAfterAuth by remember { mutableStateOf(deepLinkGatePin.length == 6) }
    var enteredGatePin by remember { mutableStateOf(deepLinkGatePin) }

    DisposableEffect(Unit) {
        val listener = FirebaseAuth.AuthStateListener { auth ->
            currentUser = auth.currentUser
            if (auth.currentUser == null) {
                launchVolunteerAfterAuth = false
            }
        }
        Firebase.auth.addAuthStateListener(listener)
        onDispose { Firebase.auth.removeAuthStateListener(listener) }
    }

    val activeUser = currentUser
    if (activeUser == null) {
        AuthScreen(
            selectedRole = preferredRole,
            onSelectRole = { preferredRole = it },
            pendingGatePin = deepLinkGatePin,
            onAuthSuccess = { volunteerMode, pin ->
                launchVolunteerAfterAuth = volunteerMode || deepLinkGatePin.length == 6
                if (pin.length == 6) {
                    enteredGatePin = pin
                }
                currentUser = Firebase.auth.currentUser
            }
        )
    } else {
        key(activeUser.uid) {
            val resolvedPin = if (deepLinkGatePin.length == 6) deepLinkGatePin else enteredGatePin
            AuthenticatedShell(
                uid = activeUser.uid,
                preferredRole = preferredRole,
                pendingGatePin = resolvedPin,
                startInVolunteerMode = launchVolunteerAfterAuth || deepLinkGatePin.length == 6,
                onConsumeDeepLinkPin = {
                    enteredGatePin = ""
                    onConsumeDeepLinkPin()
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterial3WindowSizeClassApi::class)
@Composable
private fun AuthenticatedShell(
    uid: String,
    preferredRole: UserRole,
    pendingGatePin: String,
    startInVolunteerMode: Boolean,
    onConsumeDeepLinkPin: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as ComponentActivity
    val windowSizeClass = calculateWindowSizeClass(activity)
    val useNavRail = windowSizeClass.widthSizeClass != WindowWidthSizeClass.Compact
    val scope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }

    val viewModel: CampusPassViewModel = viewModel(
        key = uid,
        factory = CampusPassViewModel.Factory(uid, preferredRole, context)
    )

    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val hostSubTab by viewModel.hostSubTab.collectAsStateWithLifecycle()
    val userProfileState by viewModel.userProfileState.collectAsStateWithLifecycle()
    val filteredEventsState by viewModel.filteredEventsState.collectAsStateWithLifecycle()
    val studentTicketsState by viewModel.studentTicketsState.collectAsStateWithLifecycle()
    val hostEventsState by viewModel.hostEventsState.collectAsStateWithLifecycle()
    val recentGateEntries by viewModel.recentGateEntries.collectAsStateWithLifecycle()
    val hostPayoutsState by viewModel.hostPayoutsState.collectAsStateWithLifecycle()
    val revenueSummary by viewModel.hostRevenueSummary.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    val selectedCategory by viewModel.selectedCategory.collectAsStateWithLifecycle()
    val statusBanner by viewModel.statusBanner.collectAsStateWithLifecycle()
    val shareVolunteerEvent by viewModel.shareVolunteerEvent.collectAsStateWithLifecycle()
    val scannerTargetEvent by viewModel.scannerTargetEvent.collectAsStateWithLifecycle()
    val volunteerPinInput by viewModel.volunteerPinInput.collectAsStateWithLifecycle()
    val volunteerActiveEvent by viewModel.volunteerActiveEvent.collectAsStateWithLifecycle()
    val volunteerPinError by viewModel.volunteerPinError.collectAsStateWithLifecycle()
    val volunteerValidating by viewModel.volunteerValidating.collectAsStateWithLifecycle()
    val lastScanResult by viewModel.lastScanResult.collectAsStateWithLifecycle()
    val volunteerSessionLog by viewModel.volunteerSessionLog.collectAsStateWithLifecycle()

    val userProfile = (userProfileState as? UiState.Success)?.data
    val isHost = (userProfile?.activeRole ?: preferredRole) == UserRole.HOST
    val isVolunteerSession = startInVolunteerMode || selectedTab == AppTab.VOLUNTEER_SCAN

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(pendingGatePin, startInVolunteerMode) {
        if (pendingGatePin.length == 6) {
            viewModel.setVolunteerPinInput(pendingGatePin)
            viewModel.unlockVolunteerGateWithPin(pendingGatePin)
            onConsumeDeepLinkPin()
        } else if (startInVolunteerMode) {
            viewModel.selectTab(AppTab.VOLUNTEER_SCAN)
        }
    }

    LaunchedEffect(statusBanner) {
        val msg = statusBanner
        if (msg != null) {
            snackbarHostState.showSnackbar(msg)
            viewModel.dismissBanner()
        }
    }

    if (shareVolunteerEvent != null) {
        BackHandler { viewModel.openVolunteerShareDialog(null) }
        VolunteerGateShareDialog(
            event = shareVolunteerEvent!!,
            onDismiss = { viewModel.openVolunteerShareDialog(null) },
            onNotify = { msg -> viewModel.showBanner(msg) }
        )
    }

    // Remove Gate Scanner / Volunteer option completely from Student & Organizer navigation bars
    val navItems = remember(isHost) {
        buildList {
            add(NavDestination(AppTab.EXPLORE, context.getString(R.string.explore_events), Icons.Filled.Explore))
            add(NavDestination(AppTab.MY_TICKETS, context.getString(R.string.my_tickets), Icons.Filled.ConfirmationNumber))
            if (isHost) {
                add(NavDestination(AppTab.HOST_DASHBOARD, context.getString(R.string.host_dashboard), Icons.Filled.Dashboard))
            }
            add(NavDestination(AppTab.PROFILE, context.getString(R.string.profile_tab), Icons.Filled.AccountCircle))
        }
    }

    val homeTab = if (isHost) AppTab.HOST_DASHBOARD else AppTab.EXPLORE
    BackHandler(enabled = !isVolunteerSession && selectedTab != homeTab) {
        viewModel.selectTab(homeTab)
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = stringResource(R.string.app_name),
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                        Text(
                            text = if (isVolunteerSession) {
                                "Gate Staff QR Verification"
                            } else {
                                when (selectedTab) {
                                    AppTab.EXPLORE -> "Explore Campus Fests"
                                    AppTab.MY_TICKETS -> "Digital QR Passes"
                                    AppTab.HOST_DASHBOARD -> "Organizer Hub (Strictly Isolated)"
                                    AppTab.VOLUNTEER_SCAN -> "Gate Staff QR Verification"
                                    AppTab.PROFILE -> "Account & Role Settings"
                                }
                            },
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = IndigoDeep,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        bottomBar = {
            if (!useNavRail && !isVolunteerSession) {
                Surface(shadowElevation = 8.dp) {
                    NavigationBar(
                        modifier = Modifier.windowInsetsPadding(WindowInsets.navigationBars)
                    ) {
                        navItems.forEach { item ->
                            NavigationBarItem(
                                selected = selectedTab == item.tab,
                                onClick = { viewModel.selectTab(item.tab) },
                                icon = { Icon(item.icon, contentDescription = item.label) },
                                label = { Text(item.label, maxLines = 1) },
                                modifier = Modifier.testTag("nav_tab_${item.tab.name.lowercase()}")
                            )
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (useNavRail && !isVolunteerSession) {
                NavigationRail {
                    navItems.forEach { item ->
                        NavigationRailItem(
                            selected = selectedTab == item.tab,
                            onClick = { viewModel.selectTab(item.tab) },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                            modifier = Modifier.testTag("rail_tab_${item.tab.name.lowercase()}")
                        )
                    }
                }
            }

            Box(modifier = Modifier.weight(1f).fillMaxSize()) {
                if (isVolunteerSession) {
                    VolunteerGateScannerScreen(
                        pinInput = volunteerPinInput,
                        activeEvent = volunteerActiveEvent,
                        isValidating = volunteerValidating,
                        pinError = volunteerPinError,
                        lastScanResult = lastScanResult,
                        sessionLog = volunteerSessionLog,
                        onPinInputChange = viewModel::setVolunteerPinInput,
                        onUnlockGate = { viewModel.unlockVolunteerGateWithPin() },
                        onExitGateSession = viewModel::exitVolunteerGateSession,
                        onSignOutClick = {
                            viewModel.exitVolunteerGateSession()
                            CredentialAuthHelper.signOut(credentialManager, scope)
                        },
                        onQrDetected = viewModel::verifyVolunteerTicketQr,
                        onClearResult = viewModel::clearScanResult
                    )
                } else {
                    when (selectedTab) {
                        AppTab.EXPLORE -> ExploreEventsScreen(
                            eventsState = filteredEventsState,
                            searchQuery = searchQuery,
                            selectedCategory = selectedCategory,
                            currentUid = uid,
                            userProfile = userProfile,
                            onSearchChange = viewModel::updateSearchQuery,
                            onCategorySelect = viewModel::selectCategory,
                            onOpenVolunteerShare = viewModel::openVolunteerShareDialog,
                            onBookTicket = viewModel::bookTicket
                        )
                        AppTab.MY_TICKETS -> MyTicketsScreen(
                            ticketsState = studentTicketsState,
                            onCancelTicket = viewModel::cancelTicket
                        )
                        AppTab.HOST_DASHBOARD -> HostDashboardScreen(
                            selectedSubTab = hostSubTab,
                            userProfile = userProfile,
                            hostEventsState = hostEventsState,
                            recentGateEntries = recentGateEntries,
                            hostPayoutsState = hostPayoutsState,
                            revenueSummary = revenueSummary,
                            scannerTargetEvent = scannerTargetEvent,
                            lastScanResult = lastScanResult,
                            onSelectSubTab = viewModel::selectHostSubTab,
                            onOpenVolunteerShare = viewModel::openVolunteerShareDialog,
                            onOpenScanner = viewModel::openOrganizerScanner,
                            onOrganizerQrDetected = viewModel::verifyOrganizerTicketQr,
                            onClearScanResult = viewModel::clearScanResult,
                            onCreateEvent = viewModel::createEvent,
                            onCancelEvent = viewModel::cancelHostEvent,
                            onDeleteEvent = viewModel::deleteHostEvent,
                            onRequestPayout = viewModel::requestPayout
                        )
                        AppTab.VOLUNTEER_SCAN -> VolunteerGateScannerScreen(
                            pinInput = volunteerPinInput,
                            activeEvent = volunteerActiveEvent,
                            isValidating = volunteerValidating,
                            pinError = volunteerPinError,
                            lastScanResult = lastScanResult,
                            sessionLog = volunteerSessionLog,
                            onPinInputChange = viewModel::setVolunteerPinInput,
                            onUnlockGate = { viewModel.unlockVolunteerGateWithPin() },
                            onExitGateSession = viewModel::exitVolunteerGateSession,
                            onSignOutClick = {
                                viewModel.exitVolunteerGateSession()
                                CredentialAuthHelper.signOut(credentialManager, scope)
                            },
                            onQrDetected = viewModel::verifyVolunteerTicketQr,
                            onClearResult = viewModel::clearScanResult
                        )
                        AppTab.PROFILE -> ProfileScreen(
                            userProfile = userProfile,
                            onSaveProfile = viewModel::updateProfile,
                            onSignOutClick = {
                                CredentialAuthHelper.signOut(credentialManager, scope)
                            }
                        )
                    }
                }
            }
        }
    }
}

private data class NavDestination(
    val tab: AppTab,
    val label: String,
    val icon: ImageVector
)
