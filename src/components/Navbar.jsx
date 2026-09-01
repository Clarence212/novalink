import React, { useEffect, useRef, useState } from 'react';
import { Bell, EllipsisVertical, LogOut, Menu, RefreshCw, User } from 'lucide-react';
import { useApp } from '../context/AppContext';

const formatUpdated = (date) => date ? new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
}).format(date) : 'Not refreshed yet';

export const Navbar = ({ onSignOut, onOpenEmailLog, toggleSidebar }) => {
  const { currentUser, isGuestMode, refreshState, isRefreshing, lastUpdatedAt } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const roleLabel = isGuestMode ? 'Guest' : currentUser?.role === 'admin'
    ? 'Administrator' : currentUser?.role === 'security'
      ? 'Security Guard' : 'Resident';

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  const refresh = async () => {
    await refreshState();
    setMenuOpen(false);
  };

  return (
    <header className="relative sticky top-0 z-40 flex min-h-[60px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2 shadow-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button onClick={toggleSidebar} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden" aria-label="Toggle navigation menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/NHAI_Insignia.png" alt="NHAI Insignia" className="h-10 w-10 shrink-0 object-contain drop-shadow-sm sm:h-11 sm:w-11" />
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold leading-none tracking-tight text-slate-800">NovaLink Portal</div>
            <div className="mt-1 hidden text-[11px] font-medium text-slate-400 sm:block">HOA Management System</div>
          </div>
        </div>
      </div>

      <div className="hidden items-center gap-1.5 md:flex">
        {!isGuestMode && <div className="mr-2 text-right"><p className="text-[10px] font-semibold text-slate-400">Updated {formatUpdated(lastUpdatedAt)}</p></div>}
        {!isGuestMode && <button onClick={refresh} disabled={isRefreshing} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50" aria-label="Refresh system data" title="Refresh system data"><RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /></button>}
        {currentUser?.role === 'admin' && <button onClick={onOpenEmailLog} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Open system email delivery log"><Bell className="h-5 w-5" /></button>}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 sm:flex">
          <div className="hidden text-right lg:block"><div className="max-w-44 truncate text-xs font-bold leading-tight text-slate-800">{isGuestMode ? 'Guest Visitor' : currentUser?.fullName}</div><div className="mt-0.5 text-[10px] font-medium text-slate-400">{roleLabel}</div></div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">{isGuestMode ? 'G' : currentUser?.fullName ? currentUser.fullName.charAt(0) : <User className="h-4 w-4" />}</div>
        </div>
        <button onClick={onSignOut} className="hidden rounded-xl p-2.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 md:block" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>

        <div className="relative md:hidden" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Open account and system menu" aria-expanded={menuOpen}><EllipsisVertical className="h-5 w-5" /></button>
          {menuOpen && <div className="absolute right-0 top-12 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
            <div className="border-b border-slate-100 px-3 py-2.5"><p className="truncate text-xs font-bold text-slate-800">{isGuestMode ? 'Guest Visitor' : currentUser?.fullName}</p><p className="mt-0.5 text-[10px] text-slate-400">{roleLabel}{!isGuestMode && ` · Updated ${formatUpdated(lastUpdatedAt)}`}</p></div>
            {!isGuestMode && <button type="button" onClick={refresh} disabled={isRefreshing} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100"><RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh data</button>}
            {currentUser?.role === 'admin' && <button type="button" onClick={() => { onOpenEmailLog(); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100"><Bell className="h-4 w-4" /> Email delivery log</button>}
            <button type="button" onClick={onSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> Sign out</button>
          </div>}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-blue-600" />
    </header>
  );
};
