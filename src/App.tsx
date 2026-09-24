import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { CollegeEvent, Ticket } from './types';
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
import { QrScannerModal } from './components/QrScannerModal';
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
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [newlyPurchasedTicket, setNewlyPurchasedTicket] = useState<Ticket | null>(null);
  const [prefilledScanTicket, setPrefilledScanTicket] = useState<Ticket | null>(null);

  // App Data
  const [events, setEvents] = useState<CollegeEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Load events & tickets on mount & updates
  const refreshData = () => {
    const evts = StorageService.getEvents();
    setEvents(evts);
    if (currentUser) {
      if (role === 'host') {
        setTickets(StorageService.getHostAttendees(currentUser.uid));
      } else {
        setTickets(StorageService.getUserTickets(currentUser.uid));
      }
    }
  };

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

  if (!currentUser) {
    return <AuthPage onSuccess={refreshData} />;
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
          onClick={() => setNewlyPurchasedTicket(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm my-auto cursor-default"
          >
            <button
              type="button"
              onClick={() => setNewlyPurchasedTicket(null)}
              className="absolute -top-11 right-0 py-1.5 px-3 rounded-full bg-white/95 hover:bg-white border border-slate-200 text-slate-800 font-bold text-xs shadow-md flex items-center gap-1.5 transition z-10 active:scale-95"
            >
              <X className="w-4 h-4 text-slate-600" />
              <span>Cut / Close</span>
            </button>
            <DigitalTicket
              ticket={newlyPurchasedTicket}
              onClose={() => setNewlyPurchasedTicket(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
