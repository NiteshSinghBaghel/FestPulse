import React, { useState, useEffect } from 'react';
import { CollegeEvent } from '../types';
import { StorageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  IndianRupee, 
  Users, 
  Sparkles, 
  Check, 
  ShieldAlert, 
  Lock, 
  Phone, 
  FileText, 
  AlertCircle 
} from 'lucide-react';

interface EditEventModalProps {
  isOpen: boolean;
  event: CollegeEvent | null;
  onClose: () => void;
  onEventUpdated: (updatedEvent: CollegeEvent) => void;
}

const PRESET_IMAGES = [
  { label: 'Tech & AI', url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&auto=format&fit=crop&q=80' },
  { label: 'Concert & Music', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1000&auto=format&fit=crop&q=80' },
  { label: 'Gaming & Esports', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1000&auto=format&fit=crop&q=80' },
  { label: 'Hackathon', url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1000&auto=format&fit=crop&q=80' },
  { label: 'Sports Match', url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1000&auto=format&fit=crop&q=80' },
];

export const EditEventModal: React.FC<EditEventModalProps> = ({
  isOpen,
  event,
  onClose,
  onEventUpdated,
}) => {
  const { currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CollegeEvent['category']>('Tech');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [venue, setVenue] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [capacity, setCapacity] = useState<number>(100);
  const [status, setStatus] = useState<CollegeEvent['status']>('published');
  const [imageUrl, setImageUrl] = useState('');
  const [rules, setRules] = useState('');
  const [amenities, setAmenities] = useState('');
  const [hostPhone, setHostPhone] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  // USER MANDATE: "and only wahi host change kar sakte hai event jisne create kiya hai event ko"
  const isCreator = Boolean(
    event && currentUser?.uid === event.hostId
  );

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setCategory(event.category || 'Tech');
      setDate(event.date || '');
      setStartTime(event.startTime || '');
      setEndTime(event.endTime || '');
      setLocation(event.location || '');
      setVenue(event.venue || '');
      setPrice(event.price || 0);
      setCapacity(event.capacity || 100);
      setStatus(event.status || 'published');
      setImageUrl(event.imageUrl || PRESET_IMAGES[0].url);
      setRules((event.rules || []).join('\n'));
      setAmenities((event.amenities || []).join(', '));
      setHostPhone(event.hostPhone || '');
      setErrors({});
    }
  }, [event]);

  if (!isOpen || !event) return null;

  const validateForm = () => {
    const errs: { [key: string]: string } = {};
    if (!title.trim()) errs.title = 'Event name is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (!date.trim()) errs.date = 'Date is required';
    if (!startTime.trim()) errs.startTime = 'Start time is required';
    if (!endTime.trim()) errs.endTime = 'End time is required';
    if (!location.trim()) errs.location = 'Location is required';
    if (price < 0) errs.price = 'Price cannot be negative';
    if (!capacity || capacity <= 0) errs.capacity = 'Capacity must be greater than 0';
    if (capacity < event.ticketsSold) {
      errs.capacity = `Capacity cannot be lower than sold tickets (${event.ticketsSold})`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!isCreator) {
      alert('Unauthorized: Only the host who created this event has permission to modify it.');
      return;
    }

    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const remainingCapacity = Math.max(0, capacity - event.ticketsSold);
      const updated = StorageService.updateEvent(event.eventId, {
        title: title.trim(),
        description: description.trim(),
        category,
        date: date.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        location: location.trim(),
        venue: venue.trim(),
        price: Number(price),
        capacity: Number(capacity),
        availableTickets: remainingCapacity,
        status,
        imageUrl: imageUrl.trim() || event.imageUrl,
        rules: rules.split('\n').map(r => r.trim()).filter(Boolean),
        amenities: amenities.split(',').map(a => a.trim()).filter(Boolean),
        hostPhone: hostPhone.trim() || event.hostPhone,
      });

      onEventUpdated(updated);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to update event.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">Edit College Event</h3>
                {isCreator ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                    Verified Creator
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Read-Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Created by {event.hostName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Warning if NOT Creator */}
        {!isCreator && (
          <div className="mt-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Creator Permission Required</p>
              <p className="text-[11px] text-rose-600 mt-0.5">
                Only the host account that originally created this event ({event.hostName}) is authorized to change its information.
              </p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="mt-4 overflow-y-auto pr-1 flex-1 space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Event Name *</label>
            <input
              type="text"
              disabled={!isCreator}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
            {errors.title && <p className="text-rose-500 text-[10px] mt-1">{errors.title}</p>}
          </div>

          {/* Category & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Category</label>
              <select
                disabled={!isCreator}
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              >
                {(['Tech', 'Cultural', 'Sports', 'Hackathon', 'Workshop', 'Music', 'Gaming'] as const).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Event Status</label>
              <select
                disabled={!isCreator}
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              >
                <option value="published">Published (Active)</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="sold_out">Sold Out</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Date *</label>
              <input
                type="text"
                disabled={!isCreator}
                placeholder="e.g. 2026-10-15 or 18 Oct"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
              {errors.date && <p className="text-rose-500 text-[10px] mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Start Time *</label>
              <input
                type="text"
                disabled={!isCreator}
                placeholder="10:00 AM"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">End Time *</label>
              <input
                type="text"
                disabled={!isCreator}
                placeholder="05:00 PM"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Location & Venue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Campus Location *</label>
              <input
                type="text"
                disabled={!isCreator}
                placeholder="e.g. IIT Delhi - Hauz Khas"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Venue / Auditorium</label>
              <input
                type="text"
                disabled={!isCreator}
                placeholder="e.g. Main Auditorium Hall"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Price & Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Ticket Price (₹) *</label>
              <input
                type="number"
                disabled={!isCreator}
                min={0}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Set 0 for Free student entry pass</p>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Total Capacity *</label>
              <input
                type="number"
                disabled={!isCreator}
                min={event.ticketsSold || 1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                Current Sold: {event.ticketsSold} passes
              </p>
              {errors.capacity && <p className="text-rose-500 text-[10px] mt-1">{errors.capacity}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Description *</label>
            <textarea
              rows={3}
              disabled={!isCreator}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
          </div>

          {/* Preset Images */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Cover Image</label>
            <div className="flex gap-2 overflow-x-auto pb-1 mb-2">
              {PRESET_IMAGES.map((img) => (
                <button
                  type="button"
                  key={img.label}
                  disabled={!isCreator}
                  onClick={() => setImageUrl(img.url)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] shrink-0 font-medium transition ${
                    imageUrl === img.url
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {img.label}
                </button>
              ))}
            </div>
            <input
              type="url"
              disabled={!isCreator}
              placeholder="Or paste custom image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-[11px] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
          </div>

          {/* Helpline Phone */}
          <div>
            <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-indigo-600" />
              <span>Organizer Helpline Phone</span>
            </label>
            <input
              type="text"
              disabled={!isCreator}
              placeholder="+91 98765 43210"
              value={hostPhone}
              onChange={(e) => setHostPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
          </div>

          {/* Rules */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Event Entry Rules (one per line)</label>
            <textarea
              rows={2}
              disabled={!isCreator}
              placeholder="Bring a valid college ID&#10;No late entry past gate closing"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
          >
            Cancel
          </button>

          {isCreator ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="py-2.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition flex items-center gap-2 shadow-md active:scale-95 disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Event Changes'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
              <Lock className="w-3.5 h-3.5 text-rose-500" />
              <span>Locked • Creator Only</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
