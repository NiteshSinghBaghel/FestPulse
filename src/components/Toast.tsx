import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastData {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'warning';
}

interface ToastProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xl text-slate-800 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            ) : toast.type === 'info' ? (
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span className="truncate">{toast.message}</span>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
