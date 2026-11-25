import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { CollegeEvent, Ticket, UserRole } from './types';
import { StorageService } from './services/storageService';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { HomePage } from './pages/HomePage';
import { EventDetailPage } from './pages/EventDetailPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { ProfilePage } from './pages/ProfilePage';
import { HostDashboardPage } from './pages/HostDashboardPage';
import { HostAttendeesPage } from './pages/HostAttendeesPage';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { QrScannerModal } from './components/QrScannerModal';
import { VolunteerGateScannerModal } from './components/VolunteerGateScannerModal';
import { CreateEventModal } from './components/CreateEventModal';
import { DigitalTicket } from './components/DigitalTicket';
import { Footer } from './components/Footer';
import {
  AppTab,
  getDefaultTabForRole,
  getPathForEvent,
  getPathForLogin,
  getPathForTab,
  isValidTabForRole,
  resolveRoute,
} from './utils/routes';

export const App: React.FC = () => {
  const { currentUser, role } = useAuth();

  // Compute initial route synchronously from window.location so refresh never flashes wrong screens
  const initialParsed =
    typeof window !== 'undefined'
      ? resolveRoute(
          window.location.pathname,
          window.location.search,
          Boolean(currentUser),
          role
        )
      : { kind: currentUser ? ('tab' as const) : ('landing' as const), tab: getDefaultTabForRole(role) };

  // Navigation State
  const [activeTab, setActiveTab] = useState<AppTab>(
    initialParsed.tab || getDefaultTabForRole(role)
  );
  const [pendingEventId, setPendingEventId] = useState<string | null>(
    initialParsed.kind === 'event' ? initialParsed.eventId || null : null
  );
  const [selectedEvent, setSelectedEvent] = useState<CollegeEvent | null>(null);
  const [selectedAttendeeEvent, setSelectedAttendeeEvent] = useState<CollegeEvent | null>(null);
  const [pendingAttendeeEventId, setPendingAttendeeEventId] = useState<string | null>(
    initialParsed.attendeeEventId || null
  );
  const [focusSearchTrigger, setFocusSearchTrigger] = useState(0);

  // Modals State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isVolunteerScannerOpen, setIsVolunteerScannerOpen] = useState(false);
  const [volunteerGatePin, setVolunteerGatePin] = useState<string>('');
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [newlyPurchasedTicket, setNewlyPurchasedTicket] = useState<Ticket | null>(null);
  const [prefilledScanTicket, setPrefilledScanTicket] = useState<Ticket | null>(null);

  // App Data
  const [events, setEvents] = useState<CollegeEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Landing Page & Auth Flow State
  const [landingView, setLandingView] = useState<'landing' | 'login'>(
    initialParsed.kind === 'login' ? 'login' : 'landing'
  );
  const [targetLoginRole, setTargetLoginRole] = useState<UserRole>(
    initialParsed.landingRole || 'user'
  );

  // Check URL parameters for direct volunteer gate scanner link (?gatePin=482910)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const pin = params.get('gatePin') || params.get('volunteerGatePin');
      if (pin && pin.trim().length === 6) {
        setVolunteerGatePin(pin.trim());
        setIsVolunteerScannerOpen(true);
      }
    }
  }, []);

  // Load strictly user/role-scoped events & tickets from StorageService
  const refreshData = useCallback(() => {
    const evts = StorageService.getEvents();
    setEvents(evts);

    if (currentUser) {
      if (role === 'host') {
        setTickets(StorageService.getHostAttendees(currentUser.uid, currentUser.email));
      } else {
        setTickets(StorageService.getUserTickets(currentUser.uid, currentUser.email));
      }
    } else {
      setTickets([]);
    }
  }, [currentUser, role]);

  // Synchronize URL & view state from current window.location
  const syncStateFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    const resolved = resolveRoute(
      window.location.pathname,
      window.location.search,
      Boolean(currentUser),
      role
    );

    if (!currentUser) {
      setSelectedEvent(null);
      setPendingEventId(null);
      setSelectedAttendeeEvent(null);
      setPendingAttendeeEventId(null);

      if (resolved.kind === 'login') {
        setLandingView('login');
        if (resolved.landingRole) setTargetLoginRole(resolved.landingRole);
      } else {
        setLandingView('landing');
        if (resolved.isUnauthorizedOrUnknown) {
          const search = window.location.search;
          const keepPin =
            search && (search.includes('gatePin=') || search.includes('volunteerGatePin='))
              ? search
              : '';
          window.history.replaceState({ view: 'landing' }, '', `/${keepPin}`);
        }
      }
      return;
    }

    if (resolved.kind === 'event' && resolved.eventId) {
      setPendingEventId(resolved.eventId);
      const match = StorageService.getEventById(resolved.eventId) || null;
      setSelectedEvent(match);
      setSelectedAttendeeEvent(null);
      return;
    }

    const nextTab = resolved.tab || getDefaultTabForRole(role);
    setPendingEventId(null);
    setSelectedEvent(null);
    setActiveTab(nextTab);
    setPendingAttendeeEventId(resolved.attendeeEventId || null);

    if (resolved.attendeeEventId) {
      const evt = StorageService.getEventById(resolved.attendeeEventId) || null;
      setSelectedAttendeeEvent(evt);
    } else {
      setSelectedAttendeeEvent(null);
    }

    if (resolved.isUnauthorizedOrUnknown || window.location.pathname === '/') {
      window.history.replaceState(
        { tab: nextTab },
        '',
        getPathForTab(nextTab, resolved.attendeeEventId)
      );
    }
  }, [currentUser, role]);

  // Resolve pending deep-linked /events/:eventId or ?eventId= once cloud events finish loading
  useEffect(() => {
    if (!currentUser) return;
    if (pendingEventId) {
      const matched = events.find((e) => e.eventId === pendingEventId);
      if (matched) {
        // Prevent non-owner from opening draft event via URL
        const isOwnerHost =
          role === 'host' &&
          (matched.hostId === currentUser.uid ||
            (matched.hostEmail &&
              matched.hostEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim()));
        if (matched.status !== 'draft' || isOwnerHost) {
          setSelectedEvent(matched);
        } else {
          const defTab = getDefaultTabForRole(role);
          setPendingEventId(null);
          setSelectedEvent(null);
          setActiveTab(defTab);
          window.history.replaceState({ tab: defTab }, '', getPathForTab(defTab));
        }
      }
    }
    if (pendingAttendeeEventId && role === 'host') {
      const matchedAttendeeEvt = events.find((e) => e.eventId === pendingAttendeeEventId);
      if (matchedAttendeeEvt) {
        setSelectedAttendeeEvent(matchedAttendeeEvt);
      }
    }
  }, [events, pendingEventId, pendingAttendeeEventId, currentUser, role]);

  // Keep selectedEvent synced with latest capacity/ticketsSold updates in real time
  useEffect(() => {
    if (!selectedEvent) return;
    const latest = events.find((e) => e.eventId === selectedEvent.eventId);
    if (latest && (latest.updatedAt !== selectedEvent.updatedAt || latest.availableTickets !== selectedEvent.availableTickets || latest.status !== selectedEvent.status)) {
      setSelectedEvent(latest);
    }
  }, [events, selectedEvent]);

  // Browser Back / Forward navigation handler (works both logged-out and logged-in)
  useEffect(() => {
    const handlePopState = () => {
      syncStateFromUrl();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncStateFromUrl]);

  // Enforce route guard & clear sensitive state whenever currentUser or role changes
  useEffect(() => {
    if (!currentUser) {
      setTickets([]);
      setSelectedEvent(null);
      setPendingEventId(null);
      setSelectedAttendeeEvent(null);
      setPendingAttendeeEventId(null);
      setIsScannerOpen(false);
      setIsCreateEventOpen(false);
      setNewlyPurchasedTicket(null);
      setPrefilledScanTicket(null);
      syncStateFromUrl();
      return;
    }

    syncStateFromUrl();
  }, [currentUser?.uid, role, syncStateFromUrl]);

  // Real-time multi-device & cross-tab sync (SSE + BroadcastChannel + Firestore onSnapshot + window focus + fallback poll)
  useEffect(() => {
    const session = currentUser
      ? { uid: currentUser.uid, email: currentUser.email, role: currentUser.role }
      : null;

    StorageService.syncFromCloud(session).then(() => {
      refreshData();
    });

    const stopRealtime = StorageService.startRealtimeSync(session, () => {
      refreshData();
    });

    const handleLocalUpdate = () => refreshData();
    window.addEventListener('campuspass_data_updated', handleLocalUpdate);

    const handleFocus = () => {
      StorageService.syncFromCloud(session).then(() => {
        refreshData();
      });
    };
    window.addEventListener('focus', handleFocus);

    // Fallback safety sync every 15s (SSE + onSnapshot + BroadcastChannel handle sub-second updates)
    const interval = setInterval(() => {
      StorageService.syncFromCloud(session).then(() => {
        refreshData();
      });
    }, 5000);

    return () => {
      stopRealtime();
      window.removeEventListener('campuspass_data_updated', handleLocalUpdate);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [currentUser?.uid, role, refreshData]);

  // Helper navigation functions that strictly respect role + update browser URL cleanly
  const navigateToTab = useCallback(
    (requestedTab: string, attendeeEvent?: CollegeEvent | null) => {
      const normalized = requestedTab === 'explore' ? 'home' : requestedTab;
      const safeTab: AppTab = isValidTabForRole(normalized, role)
        ? normalized
        : getDefaultTabForRole(role);

      setPendingEventId(null);
      setSelectedEvent(null);
      setSelectedAttendeeEvent(safeTab === 'host-attendees' ? attendeeEvent || null : null);
      setPendingAttendeeEventId(
        safeTab === 'host-attendees' && attendeeEvent ? attendeeEvent.eventId : null
      );
      setActiveTab(safeTab);

      try {
        const nextUrl = getPathForTab(safeTab, attendeeEvent?.eventId);
        if (window.location.pathname + window.location.search !== nextUrl) {
          window.history.pushState({ tab: safeTab, attendeeEventId: attendeeEvent?.eventId }, '', nextUrl);
        }
      } catch {}
    },
    [role]
  );

  const navigateToEvent = useCallback((evt: CollegeEvent) => {
    setSelectedEvent(evt);
    setPendingEventId(evt.eventId);
    try {
      const nextUrl = getPathForEvent(evt.eventId);
      if (window.location.pathname !== nextUrl) {
        window.history.pushState({ eventId: evt.eventId }, '', nextUrl);
      }
    } catch {}
  }, []);

  const handleBackFromEvent = useCallback(() => {
    setSelectedEvent(null);
    setPendingEventId(null);
    const fallbackTab = isValidTabForRole(activeTab, role)
      ? activeTab
      : getDefaultTabForRole(role);
    setActiveTab(fallbackTab);
    try {
      window.history.pushState({ tab: fallbackTab }, '', getPathForTab(fallbackTab));
    } catch {}
  }, [activeTab, role]);

  const handleNavigateToLogin = (chosenRole: UserRole) => {
    setTargetLoginRole(chosenRole);
    setLandingView('login');
    try {
      window.history.pushState(
        { view: 'login', role: chosenRole },
        '',
        getPathForLogin(chosenRole)
      );
    } catch {}
  };

  const handleBackToLanding = () => {
    setLandingView('landing');
    try {
      window.history.pushState({ view: 'landing' }, '', '/');
    } catch {}
  };

  const handleClosePassAndGoToExplore = () => {
    setNewlyPurchasedTicket(null);
    navigateToTab(role === 'host' ? 'host-dashboard' : 'home');
  };

  // ==================== UNAUTHENTICATED GUARD ====================
  // Strictly blocks ALL dashboard routes, Navbar, Footer, tickets & profile until user logs in
  if (!currentUser) {
    return (
      <>
        {landingView === 'landing' ? (
          <LandingPage
            onLogin={(chosenRole) => {
              handleNavigateToLogin(chosenRole);
            }}
            onExploreEvents={() => {
              handleNavigateToLogin('user');
            }}
            onOpenVolunteerScanner={() => {
              setVolunteerGatePin('');
              setIsVolunteerScannerOpen(true);
            }}
          />
        ) : (
          <AuthPage
            onSuccess={() => {
              const session = StorageService.syncFromCloud().then(() => refreshData());
              void session;
            }}
            initialRole={targetLoginRole}
            onBackToLanding={handleBackToLanding}
            onSwitchRole={(newRole) => {
              setTargetLoginRole(newRole);
              try {
                window.history.replaceState(
                  { view: 'login', role: newRole },
                  '',
                  getPathForLogin(newRole)
                );
              } catch {}
            }}
            onOpenVolunteerScanner={() => {
              setVolunteerGatePin('');
              setIsVolunteerScannerOpen(true);
            }}
          />
        )}

        {/* Volunteer Gate Scanner Modal for Door Staff (zero login required) */}
        <VolunteerGateScannerModal
          isOpen={isVolunteerScannerOpen}
          onClose={() => {
            setIsVolunteerScannerOpen(false);
            setVolunteerGatePin('');
          }}
          initialGatePin={volunteerGatePin}
          onScanSuccess={refreshData}
        />
      </>
    );
  }

  // ==================== AUTHENTICATED PORTAL ====================
  const safeActiveTab: AppTab = isValidTabForRole(activeTab, role)
    ? activeTab
    : getDefaultTabForRole(role);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        onOpenSearch={() => {
          navigateToTab(role === 'host' ? 'host-events' : 'home');
          setFocusSearchTrigger((prev) => prev + 1);
        }}
        activeTab={safeActiveTab}
        onNavigate={(tab) => navigateToTab(tab)}
        onOpenScanner={() => {
          setPrefilledScanTicket(null);
          setIsScannerOpen(true);
        }}
        onOpenVolunteerScanner={() => {
          setVolunteerGatePin('');
          setIsVolunteerScannerOpen(true);
        }}
        onOpenCreateEvent={() => setIsCreateEventOpen(true)}
        ticketCount={tickets.filter((t) => t.entryStatus !== 'entered' && t.status !== 'cancelled').length}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {selectedEvent ? (
          <EventDetailPage
            event={selectedEvent}
            onBack={handleBackFromEvent}
            onTicketPurchased={(ticket) => {
              refreshData();
              setNewlyPurchasedTicket(ticket);
            }}
          />
        ) : (
          <>
            {/* Student Screens */}
            {role === 'user' && (
              <>
                {safeActiveTab === 'home' && (
                  <HomePage
                    events={events}
                    onSelectEvent={navigateToEvent}
                    onTicketPurchased={(ticket) => {
                      refreshData();
                      setNewlyPurchasedTicket(ticket);
                    }}
                    focusSearchTrigger={focusSearchTrigger}
                  />
                )}

                {safeActiveTab === 'my-tickets' && (
                  <MyTicketsPage
                    tickets={tickets}
                    onExplore={() => navigateToTab('home')}
                    onTicketsUpdated={refreshData}
                  />
                )}
              </>
            )}

            {/* Host Screens */}
            {role === 'host' && (
              <>
                {(safeActiveTab === 'host-dashboard' ||
                  safeActiveTab === 'host-events' ||
                  safeActiveTab === 'host-analytics') && (
                  <HostDashboardPage
                    events={events}
                    currentTab={safeActiveTab}
                    onChangeTab={(newTab) => navigateToTab(newTab)}
                    onOpenCreateEvent={() => setIsCreateEventOpen(true)}
                    onOpenScanner={() => {
                      setPrefilledScanTicket(null);
                      setIsScannerOpen(true);
                    }}
                    onOpenVolunteerScanner={(pin) => {
                      setVolunteerGatePin(pin || '');
                      setIsVolunteerScannerOpen(true);
                    }}
                    onViewAttendees={(evt) => {
                      navigateToTab('host-attendees', evt || null);
                    }}
                    onSelectEvent={navigateToEvent}
                    onEventsUpdated={refreshData}
                  />
                )}

                {safeActiveTab === 'host-attendees' && (
                  <HostAttendeesPage
                    selectedEvent={selectedAttendeeEvent}
                    onBack={
                      selectedAttendeeEvent
                        ? () => navigateToTab('host-attendees', null)
                        : undefined
                    }
                  />
                )}
              </>
            )}

            {/* Shared Profile Screen */}
            {safeActiveTab === 'profile' && <ProfilePage />}
          </>
        )}
      </main>

      {/* Responsive Website Footer (Role-scoped) */}
      <Footer
        onNavigate={(tab) => navigateToTab(tab)}
        role={role}
      />

      {/* Floating Bottom Navigation Bar (Hidden on desktop md+) */}
      <BottomNav
        currentTab={safeActiveTab}
        onSelectTab={(tab) => navigateToTab(tab)}
        ticketCount={tickets.filter((t) => t.entryStatus !== 'entered' && t.status !== 'cancelled').length}
        onOpenScanner={() => {
          setPrefilledScanTicket(null);
          setIsScannerOpen(true);
        }}
      />

      {/* Host QR Gate Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setPrefilledScanTicket(null);
        }}
        onScanSuccess={refreshData}
        prefilledTicket={prefilledScanTicket}
      />

      {/* Volunteer Gate Staff Scanner Modal (Zero Organizer Login Required) */}
      <VolunteerGateScannerModal
        isOpen={isVolunteerScannerOpen}
        onClose={() => {
          setIsVolunteerScannerOpen(false);
          setVolunteerGatePin('');
        }}
        initialGatePin={volunteerGatePin}
        onScanSuccess={refreshData}
      />

      {/* Create Event Modal for Host */}
      <CreateEventModal
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        onEventCreated={(newEvt) => {
          refreshData();
          navigateToEvent(newEvt);
        }}
      />

      {/* Newly Purchased Digital Ticket Modal */}
      {newlyPurchasedTicket && (
        <div
          onClick={handleClosePassAndGoToExplore}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm my-auto cursor-default"
          >
            <DigitalTicket
              ticket={newlyPurchasedTicket}
              onClose={handleClosePassAndGoToExplore}
            />
          </div>
        </div>
      )}
    </div>
  );
};
