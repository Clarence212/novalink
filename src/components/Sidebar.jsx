import React from 'react';
import {
  LayoutDashboard, Users, FileText, Calendar, Bell, CreditCard,
  MessageSquare, Car, Shield, ClipboardList,
  BarChart3, Home, Lock, Eye
} from 'lucide-react';
import { useApp } from '../context/AppContext';


const adminNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'homeowners', label: "Homeowners' Records", icon: Home },
  { id: 'user-management', label: 'User Management', icon: Users },
  { id: 'visitor-management', label: 'Visitor Logs', icon: Eye },
  { id: 'announcements', label: 'Announcements', icon: Bell },
  { id: 'reservations', label: 'Facility Reservations', icon: Calendar },
  { id: 'dues', label: 'Dues Management', icon: CreditCard },
  { id: 'concerns', label: 'Concern Management', icon: MessageSquare },
  { id: 'vehicles', label: 'Vehicle Records', icon: Car },
  { id: 'stickers', label: 'Sticker Renewals', icon: ClipboardList },
  { id: 'email-log', label: 'Email Notifications', icon: Bell },
];

const guardNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'visitor-management', label: 'Visitor Logging', icon: Shield },
  { id: 'announcements', label: 'Announcements', icon: Bell },
];


const restrictedModules = ['reservations', 'stickers', 'concerns'];

const residentNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'announcements', label: 'Announcements', icon: Bell },
  { id: 'dues', label: 'Dues & Payments', icon: CreditCard },
  { id: 'reservations', label: 'Facility Reservations', icon: Calendar },
  { id: 'concerns', label: 'My Concerns', icon: MessageSquare },
  { id: 'vehicles', label: 'My Vehicles', icon: Car },
  { id: 'stickers', label: 'Sticker Renewals', icon: ClipboardList },
];

export const Sidebar = ({ activeView, setActiveView }) => {
  const { currentUser, isGuestMode, isRestricted } = useApp();

  let navItems = [];
  if (isGuestMode) {
    navItems = [{ id: 'guest', label: 'Facility Reservation', icon: Calendar }];
  } else if (currentUser?.role === 'admin') {
    navItems = adminNav;
  } else if (currentUser?.role === 'security') {
    navItems = guardNav;
  } else if (currentUser?.role === 'resident') {
    navItems = residentNav;
  }

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-full overflow-y-auto">
      {}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          {isGuestMode ? 'Guest Access' : currentUser?.role === 'admin' ? 'Administrator' : currentUser?.role === 'security' ? 'Security Personnel' : 'Resident Portal'}
        </div>
        <div className="text-xs font-bold text-slate-200 mt-0.5 truncate">
          {isGuestMode ? 'Guest Visitor' : currentUser?.fullName}
        </div>
      </div>

      {}
      {isRestricted && currentUser?.role === 'resident' && (
        <div className="mx-3 mt-3 p-2.5 rounded-xl bg-amber-950/60 border border-amber-700/50 text-xs text-amber-300 flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>Some services locked. Settle dues to unlock.</span>
        </div>
      )}

      {}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const locked = isRestricted && restrictedModules.includes(item.id);
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => !locked && setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-medium transition-all
                ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : locked
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              {locked ? (
                <Lock className="w-4 h-4 shrink-0 text-slate-600" />
              ) : (
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              )}
              <span className="truncate">{item.label}</span>
              {locked && (
                <span className="ml-auto text-[9px] bg-amber-900/60 text-amber-400 px-1.5 py-0.5 rounded-md font-semibold">
                  LOCKED
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
