import React, { useState } from 'react';
import { CollegeEvent } from '../types';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Tag, 
  Heart, 
  Share2, 
  Ticket as TicketIcon,
  CheckCircle2,
  Users
} from 'lucide-react';

interface EventCardProps {
  event: CollegeEvent;
  onSelect: (event: CollegeEvent) => void;
  onQuickBook?: (event: CollegeEvent) => void;
  featured?: boolean;
  layout?: 'grid' | 'list';
  isBookmarked?: boolean;
  onToggleBookmark?: (eventId: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ 
  event, 
  onSelect, 
  onQuickBook,
  featured = false,
  layout = 'grid',
  isBookmarked = false,
  onToggleBookmark
}) => {
  const percentBooked = Math.round((event.ticketsSold / event.capacity) * 100);
  const isSoldOut = event.status === 'sold_out' || event.availableTickets <= 0;
  const [copied, setCopied] = useState(false);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: event.title,
        text: `Check out ${event.title} happening on ${event.date} at ${event.venue}!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${window.location.origin}#event-${event.eventId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleBookmark) {
      onToggleBookmark(event.eventId);
    }
  };

  // Compact List View Layout
  if (layout === 'list') {
    return (
      <div
        onClick={() => onSelect(event)}
        className="group relative rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-md p-3.5 cursor-pointer transition-all flex flex-col sm:flex-row gap-3.5 items-start sm:items-center justify-between"
      >
        <div className="flex gap-3.5 items-center min-w-0 w-full sm:w-auto">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              loading="lazy"
            />
            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-900/80 text-white border border-slate-700/50">
              {event.category}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="truncate">By {event.hostName}</span>
              <span>•</span>
              <span className="text-amber-600 font-semibold">{event.date}</span>
            </div>

            <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mt-0.5">
              {event.title}
            </h3>

            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {event.venue}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {event.startTime}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-black text-emerald-600">
                {event.price === 0 ? 'FREE PASS' : `₹${event.price}`}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                ({event.availableTickets} tickets left)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button
            onClick={handleBookmark}
            aria-label="Bookmark event"
            className={`p-2 rounded-xl border transition ${
              isBookmarked
                ? 'bg-rose-50 text-rose-500 border-rose-200'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Heart className={`w-4 h-4 ${isBookmarked ? 'fill-rose-500' : ''}`} />
          </button>

          <button
            onClick={handleShare}
            aria-label="Share event"
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onQuickBook) onQuickBook(event);
              else onSelect(event);
            }}
            disabled={isSoldOut}
            className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <TicketIcon className="w-3.5 h-3.5" />
            <span>{isSoldOut ? 'Sold Out' : 'Book'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Standard Grid Layout (Light Theme, high contrast, clean modern aesthetics)
  return (
    <div
      onClick={() => onSelect(event)}
      className={`group relative rounded-3xl bg-white border border-slate-200/90 overflow-hidden cursor-pointer transition-all duration-300 hover:border-indigo-400 hover:shadow-xl active:scale-[0.99] ${
        featured ? 'ring-2 ring-indigo-500/30' : ''
      }`}
    >
      {/* Cover Image / Gradient Artwork Container */}
      <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-slate-900">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-95"
            loading="lazy"
          />
        ) : null}

        {/* Soft Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        {/* Top Badges & Action Icons */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-md">
              {event.category}
            </span>
            <span className="text-[10px] font-bold text-white uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-md">
              LIVE
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleBookmark}
              aria-label="Bookmark event"
              className={`p-2 rounded-full backdrop-blur-md transition ${
                isBookmarked 
                  ? 'bg-rose-500 text-white shadow-md' 
                  : 'bg-white/90 text-slate-700 hover:text-slate-950 hover:bg-white shadow-sm'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-white' : ''}`} />
            </button>

            <button
              onClick={handleShare}
              aria-label="Share event"
              className="p-2 rounded-full bg-white/90 backdrop-blur-md text-slate-700 hover:text-slate-950 hover:bg-white shadow-sm transition"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Category Watermark on Artwork */}
        <div className="absolute bottom-3 left-4 pointer-events-none z-10">
          <span className="text-sm font-black uppercase tracking-wider text-white/70 drop-shadow">
            {event.category}
          </span>
        </div>
      </div>

      {/* Content Details */}
      <div className="p-4 sm:p-5 bg-white">
        {/* Date & Time + Price Row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">
            {event.date} • {event.startTime}
          </span>
          <span className="text-base sm:text-lg font-black text-amber-600">
            {event.price === 0 ? 'FREE' : `₹${event.price}`}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mt-1.5">
          {event.title}
        </h3>

        {/* Host Subtitle */}
        <p className="text-xs text-slate-500 font-medium mt-1 truncate">
          {event.hostName}
        </p>

        {/* Venue & Location */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{event.venue} • {event.location}</span>
        </div>

        {/* Capacity Progress Bar & X left */}
        <div className="flex items-center gap-3 mt-3.5">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, percentBooked)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-600 shrink-0">
            {event.availableTickets} left
          </span>
        </div>

        {/* Full-width Book Now Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onQuickBook) onQuickBook(event);
            else onSelect(event);
          }}
          disabled={isSoldOut}
          className="mt-4 w-full py-3.5 px-4 rounded-2xl bg-[#545df7] hover:bg-[#434de6] disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98]"
        >
          <span>→</span>
          <span>{isSoldOut ? 'Sold Out' : 'Book now'}</span>
        </button>
      </div>
    </div>
  );
};
