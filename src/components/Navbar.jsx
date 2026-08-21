import React, { useState } from 'react';
import { LogOut, Bell, Search, Menu, Home, User } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Navbar = ({ onSignOut, onOpenEmailLog, onSearchModule, toggleSidebar }) => {
  const { currentUser, isGuestMode, emailLog } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const unreadCount = emailLog.length;
  const roleLabel = isGuestMode ? 'Guest' : currentUser?.role === 'admin'
    ? 'Administrator' : currentUser?.role === 'security'
    ? 'Security Guard' : 'Resident';

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (onSearchModule) onSearchModule(e.target.value);
  };

  return (
    <header className="relative bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-40 shrink-0 shadow-xs">
      {}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition lg:hidden"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-slate-800 tracking-tight leading-none">NovaLink Portal</div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">HOA Management System</div>
          </div>
        </div>
      </div>

      {}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search modules..."
            className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-100/80 border border-slate-200 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>
      </div>

      {}
      <div className="flex items-center gap-3">
        {}
        <button
          onClick={onOpenEmailLog}
          className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
          title="System Notifications & Email Log"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
          )}
        </button>

        {}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-800 leading-tight">
              {isGuestMode ? 'Guest Visitor' : currentUser?.fullName}
            </div>
            <div className="text-[10px] text-slate-400 font-medium capitalize">{roleLabel}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {isGuestMode ? 'G' : currentUser?.fullName ? currentUser.fullName.charAt(0) : <User className="w-4 h-4" />}
          </div>
        </div>

        {}
        <button
          onClick={onSignOut}
          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600"></div>
    </header>
  );
};
