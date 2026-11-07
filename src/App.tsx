import React, { useState, useEffect } from 'react';
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
import { X } from 'lucide-react';

export const App: React.FC = () => {
  const { currentUser, role } = useAuth();

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedEvent, setSelectedEvent] = useState<CollegeEvent | null>(null);
  const [selectedAttendeeEvent, setSelectedAttendeeEvent] = useState<CollegeEvent | null>(null);
  const [focusSearchTrigger, setFocusSearchTrigger] = useState(0);

  // Modals State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isVolunteerScannerOpen, setIsVolunteerScannerOpen] = useState(false);
  const [volunteerGatePin, setVolunteerGatePin] = useState<string>('');
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [newlyPurchasedTicket, setNewlyPurchasedTicket] = useState<Ticket | null>(null);
  const [prefilledScanTicket, setPrefilledScanTicket] = useState<Ticket | null>(null);

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

  // App Data
  const [events, setEvents] = useState<CollegeEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Landing Page & Auth Flow State
  const [landingView, setLandingView] = useState<'landing' | 'login'>('landing');
  const [targetLoginRole, setTargetLoginRole] = useState<UserRole>('user');

  // Ensure browser back button (arrow) returns to Landing Page (Home) when on Login Page
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (!currentUser) {
        if (event.state?.view === 'landing' || !event.state?.view) {
          setLandingView('landing');
        } else if (event.state?.view === 'login') {
          setLandingView('login');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  // When currentUser logs out, immediately redirect to landing page
  useEffect(() => {
    if (!currentUser) {
      setLandingView('landing');
      try {
        window.history.replaceState({ view: 'landing' }, '');
      } catch {
        // safe fallback
      }
    }
  }, [currentUser]);

  const handleNavigateToLogin = (chosenRole: UserRole) => {
    setTargetLoginRole(chosenRole);
    setLandingView('login');
    try {
      window.history.pushState({ view: 'login' }, '');
    } catch {
      // safe fallback
    }
  };

  const handleBackToLanding = () => {
    setLandingView('landing');
    try {
      window.history.pushState({ view: 'landing' }, '');
    } catch {
      // safe fallback
    }
  };

  // Load events & tickets on mount & updates
  const refreshData = () => {
    const evts = StorageService.getEvents();
    setEvents(evts);
    if (currentUser) {
      if (role === 'host') {
        setTickets(StorageService.getHostAttendees(currentUser.uid, currentUser.email));
      } else {
        setTickets(StorageService.getUserTickets(currentUser.uid, currentUser.email));
      }
    }
  };

  // Multi-device Cloud Database synchronization & live real-time polling
  useEffect(() => {
    // 1. Initial sync
    StorageService.syncFromCloud().then(() => {
      refreshData();
    });

    // 2. Refresh on window focus (e.g. user created event on phone, then looks at laptop browser)
    const handleFocus = () => {
      StorageService.syncFromCloud().then(() => {
        refreshData();
      });
    };
    window.addEventListener('focus', handleFocus);

    // 3. Periodic background sync every 8 seconds
    const interval = setInterval(() => {
      StorageService.syncFromCloud().then(() => {
        refreshData();
      });
    }, 8000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [currentUser, role]);

  useEffect(() => {
    refreshData();
  }, [currentUser, role]);

  // Auto refresh and navigate on role change from ANY page
  useEffect(() => {
    refreshData();
    setSelectedEvent(null);
    setSelectedAttendeeEvent(null);
    if (role === 'host') {
      setActiveTab('host-dashboard');
    } else {
      setActiveTab('home');
    }
  }, [role]);

  const handleClosePassAndGoToExplore = () => {
    setNewlyPurchasedTicket(null);
    setSelectedEvent(null);
    setSelectedAttendeeEvent(null);
    setActiveTab('home');
  };

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
            onSuccess={refreshData} 
            initialRole={targetLoginRole}
            onBackToLanding={handleBackToLanding}
            onSwitchRole={(newRole) => setTargetLoginRole(newRole)}
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        onOpenSearch={() => {
          setSelectedEvent(null);
          setActiveTab('home');
          setFocusSearchTrigger(prev => prev + 1);
        }}
        activeTab={activeTab}
        onNavigate={(tab) => {
          setSelectedEvent(null);
          setActiveTab(tab === 'explore' ? 'home' : tab);
        }}
        onOpenScanner={() => {
          setPrefilledScanTicket(null);
          setIsScannerOpen(true);
        }}
        onOpenVolunteerScanner={() => {
          setVolunteerGatePin('');
          setIsVolunteerScannerOpen(true);
        }}
        onOpenCreateEvent={() => setIsCreateEventOpen(true)}
        ticketCount={tickets.filter(t => t.entryStatus !== 'entered').length}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {selectedEvent ? (
          <EventDetailPage
            event={selectedEvent}
            onBack={() => setSelectedEvent(null)}
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
                {activeTab === 'home' && (
                  <HomePage
                    events={events}
                    onSelectEvent={(evt) => setSelectedEvent(evt)}
                    onTicketPurchased={(ticket) => {
                      refreshData();
                      setNewlyPurchasedTicket(ticket);
                    }}
                    focusSearchTrigger={focusSearchTrigger}
                  />
                )}

                {activeTab === 'my-tickets' && (
                  <MyTicketsPage
                    tickets={tickets}
                    onExplore={() => setActiveTab('home')}
                    onTicketsUpdated={refreshData}
                  />
                )}
              </>
            )}

            {/* Host Screens */}
            {role === 'host' && (
              <>
                {(activeTab === 'host-dashboard' || activeTab === 'host-events' || activeTab === 'host-analytics') && (
                  <HostDashboardPage
                    events={events}
                    currentTab={activeTab}
                    onChangeTab={(newTab) => setActiveTab(newTab)}
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
                      setSelectedAttendeeEvent(evt || null);
                      setActiveTab('host-attendees');
                    }}
                    onSelectEvent={(evt) => setSelectedEvent(evt)}
                    onEventsUpdated={refreshData}
                  />
                )}

                {activeTab === 'host-attendees' && (
                  <HostAttendeesPage
                    selectedEvent={selectedAttendeeEvent}
                    onBack={selectedAttendeeEvent ? () => setSelectedAttendeeEvent(null) : undefined}
                  />
                )}
              </>
            )}

            {/* Shared Profile Screen */}
            {activeTab === 'profile' && (
              <ProfilePage />
            )}
          </>
        )}
      </main>

      {/* Responsive Website Footer (Visible on desktop & full pages) */}
      <Footer 
        onNavigate={(tab) => {
          setSelectedEvent(null);
          setSelectedAttendeeEvent(null);
          setActiveTab(tab);
        }}
        role={role}
      />

      {/* Floating Bottom Navigation Bar (Hidden on desktop md+) */}
      <BottomNav
        currentTab={activeTab}
        onSelectTab={(tab) => {
          setSelectedEvent(null);
          setSelectedAttendeeEvent(null);
          setActiveTab(tab === 'explore' ? 'home' : tab);
        }}
        ticketCount={tickets.filter(t => t.entryStatus !== 'entered').length}
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
          setSelectedEvent(newEvt);
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
