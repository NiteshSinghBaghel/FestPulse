import React from 'react';
import { X, SlidersHorizontal, RotateCcw, Check } from 'lucide-react';

export interface FilterState {
  searchQuery: string;
  category: string;
  priceRange: string; // 'all' | 'free' | 'under100' | '100to300' | '300to500' | '500plus'
  sortBy: string; // 'newest' | 'date' | 'priceLow' | 'priceHigh'
}

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onReset: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onReset,
}) => {
  if (!isOpen) return null;

  const categories = ['All', 'Tech', 'Cultural', 'Sports', 'Gaming', 'Workshop', 'Music'];
  const priceOptions = [
    { id: 'all', label: 'All Prices' },
    { id: 'free', label: 'Free Passes' },
    { id: 'under100', label: 'Under ₹100' },
    { id: '100to300', label: '₹100 – ₹300' },
    { id: '300to500', label: '₹300 – ₹500' },
    { id: '500plus', label: '₹500+' },
  ];

  const sortOptions = [
    { id: 'newest', label: 'Latest Added' },
    { id: 'date', label: 'Event Date' },
    { id: 'priceLow', label: 'Price: Low → High' },
    { id: 'priceHigh', label: 'Price: High → Low' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Handle bar on mobile */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-4 sm:hidden" />

        {/* Title */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <h3 className="text-base font-black text-slate-900">Filter & Sort Events</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories */}
        <div className="mt-4">
          <label className="text-xs font-bold text-slate-700 block mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onFilterChange({ ...filters, category: cat })}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  filters.category === cat
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 shadow-2xs'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="mt-5">
          <label className="text-xs font-bold text-slate-700 block mb-2">Ticket Price Range</label>
          <div className="grid grid-cols-2 gap-2">
            {priceOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFilterChange({ ...filters, priceRange: opt.id })}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left flex items-center justify-between transition ${
                  filters.priceRange === opt.id
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 shadow-2xs'
                }`}
              >
                <span>{opt.label}</span>
                {filters.priceRange === opt.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* Sorting */}
        <div className="mt-5">
          <label className="text-xs font-bold text-slate-700 block mb-2">Sort By</label>
          <div className="grid grid-cols-2 gap-2">
            {sortOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFilterChange({ ...filters, sortBy: opt.id })}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left flex items-center justify-between transition ${
                  filters.sortBy === opt.id
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 shadow-2xs'
                }`}
              >
                <span>{opt.label}</span>
                {filters.sortBy === opt.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-xs"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};
