import React from 'react';

interface EventCardSkeletonProps {
  layout?: 'grid' | 'list';
}

export const EventCardSkeleton: React.FC<EventCardSkeletonProps> = ({ layout = 'grid' }) => {
  if (layout === 'list') {
    return (
      <div className="rounded-2xl bg-white border border-slate-200/90 p-3.5 shadow-sm flex flex-col sm:flex-row gap-3.5 items-start sm:items-center justify-between">
        <div className="flex gap-3.5 items-center w-full sm:w-auto flex-1">
          {/* Thumbnail Skeleton */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-200/80 shrink-0 animate-shimmer" />

          {/* Details Column */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-20 bg-slate-200 rounded animate-shimmer" />
              <div className="h-3 w-16 bg-slate-200 rounded animate-shimmer" />
            </div>

            {/* Title */}
            <div className="h-4.5 w-3/4 bg-slate-200 rounded animate-shimmer" />

            {/* Logistics */}
            <div className="flex items-center gap-3">
              <div className="h-3 w-28 bg-slate-200 rounded animate-shimmer" />
              <div className="h-3 w-16 bg-slate-200 rounded animate-shimmer" />
            </div>

            {/* Price & availability */}
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 bg-slate-200 rounded animate-shimmer" />
              <div className="h-3 w-20 bg-slate-200 rounded animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Action Button Skeleton */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-slate-200 animate-shimmer" />
          <div className="w-8 h-8 rounded-xl bg-slate-200 animate-shimmer" />
          <div className="h-8 w-20 rounded-xl bg-slate-200 animate-shimmer" />
        </div>
      </div>
    );
  }

  // Standard Grid Skeleton
  return (
    <div className="rounded-3xl bg-white border border-slate-200/90 overflow-hidden shadow-sm flex flex-col">
      {/* Artwork Area Skeleton */}
      <div className="relative h-44 sm:h-48 w-full bg-slate-200 animate-shimmer">
        {/* Top Badges Skeleton */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="h-6 w-18 rounded-md bg-white/70" />
            <div className="h-4 w-10 rounded bg-white/60" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-white/70" />
            <div className="w-7 h-7 rounded-full bg-white/70" />
          </div>
        </div>

        {/* Category Watermark */}
        <div className="absolute bottom-3 left-4">
          <div className="h-4 w-20 rounded bg-white/50" />
        </div>
      </div>

      {/* Content Details Skeleton */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Date & Price Row */}
          <div className="flex items-center justify-between mb-2">
            <div className="h-3.5 w-28 bg-slate-200 rounded animate-shimmer" />
            <div className="h-4.5 w-14 bg-slate-200 rounded animate-shimmer" />
          </div>

          {/* Title Placeholder */}
          <div className="h-6 w-5/6 bg-slate-200 rounded-md animate-shimmer mb-1.5" />
          
          {/* Host Placeholder */}
          <div className="h-3.5 w-36 bg-slate-200 rounded animate-shimmer mb-2.5" />

          {/* Venue & Location Placeholder */}
          <div className="h-3.5 w-48 bg-slate-200 rounded animate-shimmer" />
        </div>

        <div>
          {/* Capacity Progress Bar Placeholder */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-slate-200 rounded-full animate-shimmer" />
            </div>
            <div className="h-3 w-12 bg-slate-200 rounded" />
          </div>

          {/* Book Now Button Placeholder */}
          <div className="mt-2 w-full h-11 rounded-2xl bg-slate-200 animate-shimmer" />
        </div>
      </div>
    </div>
  );
};
