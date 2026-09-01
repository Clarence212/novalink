import React, { useEffect, useState } from 'react';
import {
  BarChart3, Bell, Calendar, Car, ChevronDown, ClipboardList, CreditCard,
  Eye, Home, LayoutDashboard, Lock, MessageSquare, Search, Shield, Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const adminGroups = [
  { id: 'overview', label: 'Overview', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ] },
  { id: 'community', label: 'Community', items: [
    { id: 'homeowners', label: "Homeowners' Records", icon: Home },
    { id: 'user-management', label: 'User Management', icon: Users },
    { id: 'account-reconciliation', label: 'Account Matching', icon: Search },
  ] },
  { id: 'finance', label: 'Finance', items: [
    { id: 'dues', label: 'Dues & Payments', icon: CreditCard },
  ] },
  { id: 'operations', label: 'Operations', items: [
    { id: 'reservations', label: 'Reservations', icon: Calendar },
    { id: 'visitor-management', label: 'Visitor Management', icon: Eye },
    { id: 'vehicles', label: 'Vehicle Records', icon: Car },
    { id: 'stickers', label: 'Sticker Renewals', icon: ClipboardList },
  ] },
  { id: 'communication', label: 'Communication', items: [
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'concerns', label: 'Concern Management', icon: MessageSquare },
    { id: 'email-log', label: 'Email Delivery Log', icon: Bell },
  ] },
];

const guardNav = [
  { id: 'dashboard', label: 'Security Overview', icon: LayoutDashboard },
  { id: 'visitor-management', label: 'Visitor Gate', icon: Shield },
  { id: 'announcements', label: 'Announcements', icon: Bell },
];

const restrictedModules = ['reservations', 'stickers', 'concerns'];
const residentNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'announcements', label: 'Announcements', icon: Bell },
  { id: 'visitor-management', label: 'Visitor Passes', icon: Eye },
  { id: 'dues', label: 'Dues & Payments', icon: CreditCard },
  { id: 'reservations', label: 'Reservations', icon: Calendar },
  { id: 'concerns', label: 'My Concerns', icon: MessageSquare },
  { id: 'vehicles', label: 'My Vehicles', icon: Car },
  { id: 'stickers', label: 'Sticker Renewals', icon: ClipboardList },
];

const NavButton = ({ item, activeView, setActiveView, locked }) => {
  const Icon = item.icon;
  const active = activeView === item.id;
  return (
    <button
      type="button"
      onClick={() => !locked && setActiveView(item.id)}
      aria-current={active ? 'page' : undefined}
      aria-disabled={locked}
      className={`group flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition
        ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40' : locked ? 'cursor-not-allowed text-slate-600' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
    >
      {locked ? <Lock className="h-4 w-4 shrink-0" /> : <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />}
      <span className="truncate">{item.label}</span>
      {locked && <span className="ml-auto rounded-md bg-amber-950 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">LOCKED</span>}
    </button>
  );
};

export const Sidebar = ({ activeView, setActiveView, isOpen = false }) => {
  const { currentUser, isGuestMode, isRestricted } = useApp();
  const [expanded, setExpanded] = useState(() => Object.fromEntries(adminGroups.map((group) => [group.id, true])));

  useEffect(() => {
    const group = adminGroups.find((candidate) => candidate.items.some((item) => item.id === activeView));
    if (group) setExpanded((current) => ({ ...current, [group.id]: true }));
  }, [activeView]);

  const simpleNav = isGuestMode
    ? [{ id: 'guest', label: 'Facility Reservation', icon: Calendar }]
    : currentUser?.role === 'security' ? guardNav : residentNav;

  return (
    <aside aria-label="Primary navigation" className={`scrollbar-thin fixed inset-y-0 left-0 z-50 flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-900 transition-transform duration-200 lg:static lg:w-64 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="border-b border-slate-800 px-5 py-5">
        <p className="ui-eyebrow">{isGuestMode ? 'Guest access' : currentUser?.role === 'admin' ? 'Administrator' : currentUser?.role === 'security' ? 'Security personnel' : 'Resident portal'}</p>
        <p className="mt-1.5 truncate text-sm font-bold text-slate-200">{isGuestMode ? 'Guest Visitor' : currentUser?.fullName}</p>
      </div>

      {isRestricted && currentUser?.role === 'resident' && <div className="mx-3 mt-3 flex items-start gap-2 rounded-xl border border-amber-700/50 bg-amber-950/60 p-3 text-xs leading-4 text-amber-300"><Lock className="mt-0.5 h-4 w-4 shrink-0" /><span>Some services are locked until overdue dues are settled.</span></div>}

      <nav className="flex-1 px-3 py-3">
        {currentUser?.role === 'admin' && !isGuestMode ? adminGroups.map((group) => (
          <section key={group.id} className="mb-2">
            <button type="button" onClick={() => setExpanded((current) => ({ ...current, [group.id]: !current[group.id] }))} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 hover:bg-slate-800/60 hover:text-slate-400" aria-expanded={expanded[group.id]}>
              {group.label}<ChevronDown className={`h-3.5 w-3.5 transition ${expanded[group.id] ? '' : '-rotate-90'}`} />
            </button>
            {expanded[group.id] && <div className="space-y-0.5">{group.items.map((item) => <NavButton key={item.id} item={item} activeView={activeView} setActiveView={setActiveView} />)}</div>}
          </section>
        )) : <div className="space-y-1">{simpleNav.map((item) => <NavButton key={item.id} item={item} activeView={activeView} setActiveView={setActiveView} locked={isRestricted && restrictedModules.includes(item.id)} />)}</div>}
      </nav>
      <div className="border-t border-slate-800 px-5 py-4 text-[10px] leading-4 text-slate-600">NovaLink · Secure community operations</div>
    </aside>
  );
};
