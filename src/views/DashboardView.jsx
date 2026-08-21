import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Lock, CheckCircle, Calendar, AlertTriangle, FileText, CreditCard } from 'lucide-react';

export const DashboardView = () => {
  const { currentUser, isGuestMode } = useApp();

  if (isGuestMode) {
    return (
      <div class="p-6 max-w-4xl mx-auto space-y-6">
        <div class="p-6 rounded-3xl bg-blue-900/40 border border-blue-700/50 text-white flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold">Guest Portal Mode</h2>
            <p class="text-xs text-blue-200 mt-1">Facility Availability Lookup & Booking Requests</p>
          </div>
          <span class="px-3 py-1 rounded-full bg-blue-600/80 text-xs font-semibold">Guest Mode</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2">
            <Calendar class="w-6 h-6 text-blue-400" />
            <h3 class="font-bold text-sm text-slate-100">Clubhouse Main Hall</h3>
            <p class="text-xs text-slate-400">Capacity: 150 Persons • ₱2,500 / 4 Hours</p>
            <span class="inline-block px-2.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 text-[11px] font-semibold">Available</span>
          </div>

          <div class="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2">
            <Calendar class="w-6 h-6 text-blue-400" />
            <h3 class="font-bold text-sm text-slate-100">Covered Basketball Court</h3>
            <p class="text-xs text-slate-400">Capacity: 50 Persons • ₱500 / Hour</p>
            <span class="inline-block px-2.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 text-[11px] font-semibold">Available</span>
          </div>
        </div>
      </div>
    );
  }

  const isRestricted = currentUser?.role === 'resident' && currentUser?.unpaidMonths >= 2;

  return (
    <div class="p-6 max-w-6xl mx-auto space-y-6">
      {}
      <div class="p-6 rounded-3xl bg-slate-800 border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-white">Welcome back, {currentUser?.fullName}!</h2>
          <p class="text-xs text-slate-400 mt-1">Logged in as <strong class="text-blue-400 capitalize">{currentUser?.role}</strong></p>
        </div>

        {isRestricted && (
          <div class="px-4 py-2 rounded-xl bg-amber-950/80 border border-amber-600/60 text-amber-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle class="w-4 h-4 text-amber-400 shrink-0" />
            <span>2+ Months Dues Overdue: Non-essential services locked 🔒</span>
          </div>
        )}
      </div>

      {}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-5 rounded-2xl bg-slate-800/60 border border-slate-700">
          <div class="text-slate-400 text-xs font-medium">Account Status</div>
          <div class="text-lg font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <CheckCircle class="w-4 h-4" /> Active
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-slate-800/60 border border-slate-700">
          <div class="text-slate-400 text-xs font-medium">Dues Payment Status</div>
          <div class={`text-lg font-bold mt-1 ${isRestricted ? 'text-amber-400' : 'text-blue-400'}`}>
            {isRestricted ? '2 Months Overdue' : 'Up to Date'}
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-slate-800/60 border border-slate-700">
          <div class="text-slate-400 text-xs font-medium">Facility Bookings</div>
          <div class="text-lg font-bold text-slate-200 mt-1">
            {isRestricted ? 'Locked 🔒' : '0 Active'}
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-slate-800/60 border border-slate-700">
          <div class="text-slate-400 text-xs font-medium">Sticker Renewals</div>
          <div class="text-lg font-bold text-slate-200 mt-1">
            {isRestricted ? 'Locked 🔒' : '1 Valid'}
          </div>
        </div>
      </div>
    </div>
  );
};
