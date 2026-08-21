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
    success: <CheckCircle2 class="w-4 h-4 shrink-0" />,
    warning: <AlertCircle class="w-4 h-4 shrink-0" />,
    info: <Info class="w-4 h-4 shrink-0" />
  };

  return (
    <div class="fixed top-5 right-5 z-50 animate-bounce">
      <div class={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-semibold ${bgColors[toast.type] || bgColors.info}`}>
        {icons[toast.type]}
        <span>{toast.message}</span>
      </div>
    </div>
  );
};
