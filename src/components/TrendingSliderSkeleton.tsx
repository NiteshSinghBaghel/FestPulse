import React from 'react';

export const TrendingSliderSkeleton: React.FC = () => {
  return (
    <div className="rounded-3xl bg-white border border-slate-200/90 overflow-hidden shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-slate-200 animate-shimmer" />
          <div className="h-5 w-36 bg-slate-200 rounded animate-shimmer" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded-full bg-slate-200 animate-shimmer" />
          <div className="w-8 h-8 rounded-full bg-slate-200 animate-shimmer" />
        </div>
      </div>

      <div className="relative h-52 sm:h-64 rounded-2xl bg-slate-200 animate-shimmer overflow-hidden">
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <div className="h-4 w-24 bg-white/70 rounded" />
          <div className="h-7 w-3/4 bg-white/80 rounded" />
          <div className="flex items-center gap-3">
            <div className="h-4 w-32 bg-white/60 rounded" />
            <div className="h-4 w-20 bg-white/60 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
};
