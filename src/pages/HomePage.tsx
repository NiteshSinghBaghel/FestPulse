import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CollegeEvent, Ticket } from '../types';
import { EventCard } from '../components/EventCard';
import { EventCardSkeleton } from '../components/EventCardSkeleton';
import { TrendingSlider } from '../components/TrendingSlider';
import { TrendingSliderSkeleton } from '../components/TrendingSliderSkeleton';
import { StorageService } from '../services/storageService';
import { 
  Sparkles, 
  Search, 
  X, 
  MapPin, 
  SlidersHorizontal, 
  Grid, 
  List, 
  Heart, 
  Tag, 
  Calendar, 
  ArrowUpDown, 
  RotateCcw,
  CheckCircle2,
  Flame,
  Ticket as TicketIcon,
  RefreshCw,
  Clock
} from 'lucide-react';

interface HomePageProps {
  events: CollegeEvent[];
  onSelectEvent: (event: CollegeEvent) => void;
  onTicketPurchased?: (ticket: Ticket) => void;
  focusSearchTrigger?: number;
}

export const HomePage: React.FC<HomePageProps> = ({
  events,
  onSelectEvent,
  onTicketPurchased,
  focusSearchTrigger = 0
}) => {
  // Loading & Skeleton State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>('Just now');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekend' | 'upcoming'>('all');
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'priceLow' | 'priceHigh' | 'popularity' | 'capacity'>('date');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Bookmarks State
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Search Input ref for auto-focus & Sort Popover ref
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial skeleton load simulation for smooth perception
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 650);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setBookmarks(StorageService.getBookmarks());
  }, []);

  useEffect(() => {
    if (focusSearchTrigger > 0 && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusSearchTrigger]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsRefreshing(false);
      const now = new Date();
      setLastRefreshedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 700);
  };

  const handleToggleBookmark = (eventId: string) => {
    const updated = StorageService.toggleBookmark(eventId);
    setBookmarks(updated);
  };

  const categories = ['All', 'Tech', 'Cultural', 'Sports', 'Hackathon', 'Workshop', 'Music', 'Gaming'];

  // REAL-TIME SEARCH & FILTER COMPUTATION
  const filteredEvents = useMemo(() => {
    return events
      .filter((evt) => {
        // 1. Real-time Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = evt.title.toLowerCase().includes(q);
          const matchLocation = evt.location.toLowerCase().includes(q) || evt.venue.toLowerCase().includes(q);
          const matchHost = evt.hostName.toLowerCase().includes(q);
          const matchCategory = evt.category.toLowerCase().includes(q);
          
          if (!matchTitle && !matchLocation && !matchHost && !matchCategory) {
            return false;
          }
        }

        // 2. Category Filter
        if (selectedCategory !== 'All' && evt.category.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }

        // 3. Date Filter
        if (dateFilter !== 'all') {
          const eventDateStr = evt.date.toLowerCase();
          if (dateFilter === 'today') {
            const isToday = eventDateStr.includes('today') || eventDateStr.includes('19') || eventDateStr.includes('sep');
            if (!isToday && !eventDateStr.includes('today')) return false;
          } else if (dateFilter === 'weekend') {
            const isWeekend = eventDateStr.includes('sat') || eventDateStr.includes('sun') || eventDateStr.includes('weekend') || eventDateStr.includes('20') || eventDateStr.includes('21');
            if (!isWeekend) return false;
          }
        }

        // 4. Hide Sold Out
        if (hideSoldOut && (evt.status === 'sold_out' || evt.availableTickets <= 0)) {
          return false;
        }

        // 5. Bookmarked Only
        if (onlyBookmarked && !bookmarks.includes(evt.eventId)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'priceLow') return a.price - b.price;
        if (sortBy === 'priceHigh') return b.price - a.price;
        if (sortBy === 'popularity') {
          const aRate = a.ticketsSold / a.capacity;
          const bRate = b.ticketsSold / b.capacity;
          return bRate - aRate;
        }
        if (sortBy === 'capacity') return b.capacity - a.capacity;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  }, [events, searchQuery, selectedCategory, dateFilter, hideSoldOut, onlyBookmarked, sortBy, bookmarks]);

  // Count active non-default filters
  const activeFilterCount = 
    (selectedCategory !== 'All' ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0) +
    (hideSoldOut ? 1 : 0) +
    (onlyBookmarked ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (sortBy !== 'date' ? 1 : 0);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setDateFilter('all');
    setHideSoldOut(false);
    setOnlyBookmarked(false);
    setSortBy('date');
  };

  const sortOptions = [
    { id: 'date', label: 'Upcoming Date', short: 'Date' },
    { id: 'priceLow', label: 'Price: Low to High', short: '₹ Low' },
    { id: 'priceHigh', label: 'Price: High to Low', short: '₹ High' },
    { id: 'popularity', label: 'Most Popular', short: 'Popular' },
    { id: 'capacity', label: 'Highest Capacity', short: 'Capacity' },
  ];

  const quickSearchTags = ['AI Summit', 'Football Derby', 'Hackathon', 'Cultural Night', 'Sports Complex', 'Auditorium'];

  return (
    <div className="pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 bg-slate-50 min-h-screen text-slate-900">
      {/* ================= 1. HERO BANNER (FIRST) ================= */}
      {!searchQuery && (
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 p-6 sm:p-8 lg:p-10 mb-6 shadow-md text-white">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-amber-300 text-xs font-bold mb-3 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Campus Fest Season '26
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Discover What's Happening 🎉
            </h1>
            <p className="text-xs sm:text-base text-indigo-100 mt-3 leading-relaxed">
              Book digital passes with 1-click UPI, receive your anti-counterfeit QR entry code instantly, and never miss the hottest campus summits, cultural fests & tournaments.
            </p>
          </div>

          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-10 top-6 hidden lg:block opacity-20 pointer-events-none">
            <TicketIcon className="w-56 h-56 -rotate-12 text-white" />
          </div>
        </div>
      )}

      {/* ================= 2. SEARCH BAR (AFTER BANNER) ================= */}
      <div className="space-y-2 mb-5">
        <div className="relative">
          <Search className="w-4 h-4 text-indigo-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by event title, venue, artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Search Suggestion Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          <span className="text-slate-400 shrink-0 font-medium">Quick search:</span>
          {quickSearchTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSearchQuery(tag)}
              className={`px-2.5 py-1 rounded-xl shrink-0 transition ${
                searchQuery === tag
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* ================= 3. TRENDING EVENTS SLIDER ================= */}
      {!searchQuery && selectedCategory === 'All' && (
        <div className="mb-5">
          {isLoading ? (
            <TrendingSliderSkeleton />
          ) : (
            <TrendingSlider
              events={events}
              onSelectEvent={onSelectEvent}
              onBookDirectly={onSelectEvent}
            />
          )}
        </div>
      )}

      {/* ================= 4. CATEGORY PILLS ================= */}
      <div className="mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const count = cat === 'All' 
              ? events.length 
              : events.filter(e => e.category.toLowerCase() === cat.toLowerCase()).length;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === cat ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= 5. SECONDARY FILTERS & COMPACT SORT CONTROLS ================= */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-xs mb-5">
        <div className="flex items-center justify-between gap-2">
          {/* Date Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-500" />
            </span>
            {[
              { id: 'all', label: 'All Dates' },
              { id: 'today', label: 'Today' },
              { id: 'weekend', label: 'Weekend' },
              { id: 'upcoming', label: 'Upcoming' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDateFilter(d.id as any)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  dateFilter === d.id
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {d.label}
              </button>
            ))}

            {/* Wishlist toggle */}
            <button
              onClick={() => setOnlyBookmarked(!onlyBookmarked)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
                onlyBookmarked
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 font-bold'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
              title="Filter saved events"
            >
              <Heart className={`w-3 h-3 ${onlyBookmarked ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span className="hidden xs:inline">Saved</span> ({bookmarks.length})
            </button>

            {/* Hide Sold Out toggle */}
            <button
              onClick={() => setHideSoldOut(!hideSoldOut)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition shrink-0 ${
                hideSoldOut
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 font-bold'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Available
            </button>
          </div>

          {/* Compact Right Side Controls: Sort Icon Button + View Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Compact Sort Icon Button with Popover */}
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition ${
                  sortBy !== 'date'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs font-bold'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title={`Sort: ${sortOptions.find(o => o.id === sortBy)?.label || 'Date'}`}
                aria-label="Sort events"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                {sortBy !== 'date' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                )}
              </button>

              {isSortOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    Sort Events By
                  </div>
                  {sortOptions.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSortBy(item.id as any);
                        setIsSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition ${
                        sortBy === item.id 
                          ? 'bg-indigo-50 text-indigo-700 font-bold' 
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{item.label}</span>
                      {sortBy === item.id && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Grid vs List Toggle */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                aria-label="Grid View"
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label="List View"
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'list'
                    ? 'bg-white text-indigo-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 7. RESULTS SUMMARY, REFRESH BUTTON & ACTIVE FILTER RESET ================= */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm sm:text-base font-black text-slate-900">
            {filteredEvents.length} {filteredEvents.length === 1 ? 'Event' : 'Events'} Available
          </h2>
          
          {/* Real-time Refresh Action Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 shadow-2xs transition disabled:opacity-60"
            title="Refresh events with skeleton loading"
          >
            <RefreshCw className={`w-3 h-3 text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {searchQuery && (
            <span className="text-xs text-slate-500 truncate max-w-[120px] sm:max-w-xs">
              for "{searchQuery}"
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={handleResetFilters}
            className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-semibold transition"
          >
            <RotateCcw className="w-3 h-3 text-amber-600" />
            <span>Reset Filters ({activeFilterCount})</span>
          </button>
        )}
      </div>

      {/* ================= 8. RESULTS LIST WITH SKELETON ANIMATIONS ================= */}
      {isLoading ? (
        /* Skeleton Cards Loading Grid/List */
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5' : 'space-y-3'}>
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <EventCardSkeleton key={key} layout={viewMode} />
          ))}
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5' : 'space-y-3'}>
          {filteredEvents.map((event) => (
            <EventCard
              key={event.eventId}
              event={event}
              layout={viewMode}
              onSelect={onSelectEvent}
              onQuickBook={onSelectEvent}
              isBookmarked={bookmarks.includes(event.eventId)}
              onToggleBookmark={handleToggleBookmark}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-14 text-center p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mx-auto mb-3">
            <Search className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-900">No Events Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            We couldn't find any campus events matching "{searchQuery || 'your criteria'}". Try searching with a different keyword or resetting filters.
          </p>

          <button
            onClick={handleResetFilters}
            className="mt-4 py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Show All Campus Events</span>
          </button>
        </div>
      )}
    </div>
  );
};
