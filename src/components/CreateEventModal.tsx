import React, { useState, useRef } from 'react';
import { CollegeEvent } from '../types';
import { StorageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import { X, Calendar, Clock, MapPin, IndianRupee, Users, Sparkles, Image, Check, Upload } from 'lucide-react';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: (event: CollegeEvent) => void;
}

const PRESET_IMAGES = [
  { label: 'Tech & AI', url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&auto=format&fit=crop&q=80' },
  { label: 'Concert & Music', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1000&auto=format&fit=crop&q=80' },
  { label: 'Gaming & Esports', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1000&auto=format&fit=crop&q=80' },
  { label: 'Hackathon', url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1000&auto=format&fit=crop&q=80' },
  { label: 'Sports Match', url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1000&auto=format&fit=crop&q=80' },
];

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, onEventCreated }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CollegeEvent['category']>('Tech');
  const [date, setDate] = useState('2026-10-15');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [endTime, setEndTime] = useState('05:00 PM');
  const [location, setLocation] = useState('Main Campus, Block C');
  const [venue, setVenue] = useState('Seminar Hall 1');
  const [price, setPrice] = useState<number>(149);
  const [capacity, setCapacity] = useState<number>(200);
  const [imageUrl, setImageUrl] = useState(PRESET_IMAGES[0].url);
  const [rules, setRules] = useState('College ID required\nNo late entries past 11:30 AM');
  const [amenities, setAmenities] = useState('Free Refreshments, Wi-Fi Access, Digital Certificate');
  const [hostPhone, setHostPhone] = useState(currentUser?.phone || '+91 98112 34567');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      setIsUploading(false);
      alert('Failed to read the selected file.');
    };
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    const errs: { [key: string]: string } = {};
    if (!title.trim()) errs.title = 'Event name is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (!date) errs.date = 'Valid date is required';
    if (!startTime.trim()) errs.startTime = 'Start time is required';
    if (!endTime.trim()) errs.endTime = 'End time is required';
    if (!location.trim()) errs.location = 'Location is required';
    if (price < 0) errs.price = 'Price cannot be negative';
    if (!capacity || capacity <= 0) errs.capacity = 'Capacity must be greater than 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = (publishStatus: 'published' | 'draft') => {
    if (!validateForm()) return;

    const newEvt = StorageService.createEvent({
      hostId: currentUser?.uid || 'host-council-101',
      hostName: currentUser?.name || 'Campus Organizing Committee',
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl || PRESET_IMAGES[0].url,
      date,
      startTime,
      endTime,
      location: location.trim(),
      venue: venue.trim(),
      price: Number(price),
      currency: 'INR',
      capacity: Number(capacity),
      status: publishStatus,
      category,
      hostPhone: hostPhone.trim() || '+91 98112 34567',
      rules: rules.split('\n').filter(r => r.trim().length > 0),
      amenities: amenities.split(',').map(a => a.trim()).filter(a => a.length > 0)
    });

    onEventCreated(newEvt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Create College Event</h3>
              <p className="text-[11px] text-slate-500">Host and publish ticketing for students</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="mt-4 overflow-y-auto pr-1 flex-1 space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Event Name *</label>
            <input
              type="text"
              placeholder="e.g. RoboWars 2026 or Acoustic Night"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {errors.title && <p className="text-rose-500 text-[10px] mt-1">{errors.title}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Category</label>
            <div className="flex flex-wrap gap-2">
              {(['Tech', 'Cultural', 'Sports', 'Gaming', 'Workshop', 'Music'] as const).map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                    category === cat
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 shadow-2xs'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Image Presets & URL + Custom Upload Banner */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 block">Event Cover Banner</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Banner</span>
              </button>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="flex gap-2 overflow-x-auto pb-2 items-center">
              {PRESET_IMAGES.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setImageUrl(img.url)}
                  className={`relative w-20 h-14 rounded-xl overflow-hidden cursor-pointer border-2 shrink-0 transition ${
                    imageUrl === img.url ? 'border-indigo-600 ring-2 ring-indigo-500/30' : 'border-slate-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-900/40 flex items-end p-1">
                    <span className="text-[9px] font-bold text-white truncate">{img.label}</span>
                  </div>
                </div>
              ))}

              {/* Upload Banner Option Card */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-24 h-14 rounded-xl overflow-hidden cursor-pointer border-2 border-dashed shrink-0 flex flex-col items-center justify-center p-1.5 transition text-center ${
                  imageUrl.startsWith('data:image')
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-300 hover:border-indigo-500 bg-slate-50'
                }`}
              >
                <Upload className="w-4 h-4 text-indigo-600 mb-0.5" />
                <span className="text-[9px] font-black text-indigo-700 leading-tight">
                  {isUploading ? 'Uploading...' : 'Upload Banner'}
                </span>
                <span className="text-[8px] text-slate-400">Custom</span>
              </div>
            </div>

            {/* Image Preview / URL input */}
            {imageUrl.startsWith('data:image') ? (
              <div className="mt-2 p-2 rounded-xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between text-xs">
                <span className="text-indigo-800 font-semibold flex items-center gap-1.5 text-[11px]">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Custom banner uploaded successfully
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-bold text-indigo-700 underline hover:text-indigo-900"
                >
                  Change file
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder="Or enter custom image URL"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>

          {/* Description */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Description *</label>
            <textarea
              rows={3}
              placeholder="Describe the fest activity, speakers, schedule and exciting perks..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {errors.description && <p className="text-rose-500 text-[10px] mt-1">{errors.description}</p>}
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Start Time *</label>
              <input
                type="text"
                value={startTime}
                placeholder="10:00 AM"
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">End Time *</label>
              <input
                type="text"
                value={endTime}
                placeholder="05:00 PM"
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Location & Venue */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Location / Campus *</label>
              <input
                type="text"
                value={location}
                placeholder="North Campus"
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Venue / Hall *</label>
              <input
                type="text"
                value={venue}
                placeholder="Auditorium"
                onChange={(e) => setVenue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Price & Capacity */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Ticket Price (₹) *</label>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                placeholder="0 for Free Pass"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Enter 0 for free student pass</span>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Capacity (Max Seats) *</label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
              />
              {errors.capacity && <p className="text-rose-500 text-[10px] mt-1">{errors.capacity}</p>}
            </div>
          </div>

          {/* Organizer Contact Number / Helpline */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Organizer Helpline / Contact Number * (Shown on Student Tickets)
            </label>
            <input
              type="tel"
              value={hostPhone}
              placeholder="+91 98765 43210"
              onChange={(e) => setHostPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Students can directly call or WhatsApp this helpline from their digital ticket for directions or inquiries.
            </p>
          </div>

          {/* Rules & Amenities */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Event Rules (one per line)</label>
            <textarea
              rows={2}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Perks & Amenities (comma separated)</label>
            <input
              type="text"
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition border border-slate-200"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave('published')}
            className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
          >
            Publish Event 🎉
          </button>
        </div>
      </div>
    </div>
  );
};
