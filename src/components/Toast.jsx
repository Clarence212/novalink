import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const Toast = () => {
  const { toast } = useApp();
  if (!toast) return null;

  const bgColors = {
    success: 'bg-emerald-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-blue-600 text-white'
  };

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 shrink-0" />,
    warning: <AlertCircle className="w-4 h-4 shrink-0" />,
    info: <Info className="w-4 h-4 shrink-0" />
  };

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex justify-center sm:inset-x-auto sm:right-5 sm:justify-end" role="status" aria-live="polite" aria-atomic="true">
      <div className={`flex max-w-lg items-start gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl motion-safe:animate-[fadeIn_.18s_ease-out] ${bgColors[toast.type] || bgColors.info}`}>
        {icons[toast.type]}
        <span>{toast.message}</span>
      </div>
    </div>
  );
};
