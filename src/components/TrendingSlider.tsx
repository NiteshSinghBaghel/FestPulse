import React, { useState, useEffect, useRef } from 'react';
import { CollegeEvent } from '../types';
import { 
  Flame, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Clock, 
  MapPin, 
  Ticket as TicketIcon, 
  Sparkles,
  Users
} from 'lucide-react';

interface TrendingSliderProps {
  events: CollegeEvent[];
  onSelectEvent: (event: CollegeEvent) => void;
  onBookDirectly?: (event: CollegeEvent) => void;
}

export const TrendingSlider: React.FC<TrendingSliderProps> = ({
  events,
  onSelectEvent,
  onBookDirectly,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Take top trending events (up to 5)
  const trendingList = events.slice(0, 5);

  const total = trendingList.length;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  useEffect(() => {
    if (total <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % total);
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, isPaused]);

  if (total === 0) return null;

  const currentEvent = trendingList[currentIndex];
  const percentBooked = Math.round((currentEvent.ticketsSold / currentEvent.capacity) * 100);

  return (
    <div className="mb-8">
      {/* Section Header with Carousel Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-base font-black text-slate-900">Trending Headliners</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {currentIndex + 1} / {total}
          </span>
        </div>

        {/* Next & Previous Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrev}
            aria-label="Previous trending event"
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-xs transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            aria-label="Next trending event"
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-xs transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Slide Card with smooth transition */}
      <div 
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        className="relative rounded-3xl overflow-hidden bg-white border border-slate-200/90 shadow-md transition-all duration-300 group"
      >
        {/* Banner Cover Image */}
        <div className="relative h-56 sm:h-72 w-full overflow-hidden bg-slate-900">
          <img
            key={currentEvent.eventId}
            src={currentEvent.imageUrl}
            alt={currentEvent.title}
            className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Floating Category & Date badges */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-600 text-white shadow-md">
              {currentEvent.category} Fest
            </span>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-md text-amber-700 border border-amber-300 shadow-sm flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Trending Now
            </span>
          </div>

          {/* Slider Prev / Next floating overlay arrows on image */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 backdrop-blur-md border border-slate-200 text-slate-800 flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-105 shadow-md transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 backdrop-blur-md border border-slate-200 text-slate-800 flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-105 shadow-md transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Slide Content Body */}
        <div className="p-5 bg-white">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
            <span className="text-amber-500">★</span>
            <span className="truncate">{currentEvent.hostName}</span>
          </div>

          <h3 
            onClick={() => onSelectEvent(currentEvent)}
            className="text-lg sm:text-xl font-black text-slate-900 hover:text-indigo-600 cursor-pointer transition line-clamp-1"
          >
            {currentEvent.title}
          </h3>

          <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
            {currentEvent.description}
          </p>

          {/* Meta Logistics */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80 truncate">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate font-semibold">{currentEvent.date}</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80 truncate">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate font-semibold">{currentEvent.venue}</span>
            </div>
          </div>

          {/* Capacity Progress Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1 font-semibold">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-indigo-600" />
                {currentEvent.availableTickets} tickets left
              </span>
              <span className="text-amber-600">{percentBooked}% booked</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, percentBooked)}%` }}
              />
            </div>
          </div>

          {/* Bottom Action Row */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Ticket Price</span>
              <span className="text-xl font-black text-slate-900">
                {currentEvent.price === 0 ? 'FREE' : `₹${currentEvent.price}`}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onSelectEvent(currentEvent)}
                className="py-2.5 px-4.5 rounded-xl bg-[#545df7] hover:bg-[#434de6] text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition active:scale-98"
              >
                <span>→</span>
                <span>Book Now</span>
              </button>
            </div>
          </div>
        </div>

        {/* Slide Indicator Dots */}
        <div className="pb-3 flex items-center justify-center gap-1.5 bg-white">
          {trendingList.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentIndex === idx 
                  ? 'w-6 bg-indigo-600 shadow-sm' 
                  : 'w-1.5 bg-slate-200 hover:bg-slate-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
