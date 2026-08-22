import React from 'react';
import { LogOut, Bell, Menu, User, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Navbar = ({ onSignOut, onOpenEmailLog, toggleSidebar }) => {
  const { currentUser, isGuestMode, refreshState, isRefreshing } = useApp();

  const roleLabel = isGuestMode ? 'Guest' : currentUser?.role === 'admin'
    ? 'Administrator' : currentUser?.role === 'security'
    ? 'Security Guard' : 'Resident';

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

        <div className="flex items-center gap-3">
          <img src="/NHAI_Insignia.png" alt="NHAI Insignia" className="w-11 h-11 object-contain shrink-0 drop-shadow-xs" />
          <div>
            <div className="text-sm font-extrabold text-slate-800 tracking-tight leading-none">NovaLink Portal</div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">HOA Management System</div>
          </div>
        </div>
      </div>

      {}
      <div className="flex-1" />

      {}
      <div className="flex items-center gap-3">
        {}
        {!isGuestMode && <button onClick={() => refreshState()} disabled={isRefreshing}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-50 transition" title="Refresh system data">
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>}

        {currentUser?.role === 'admin' && (
          <button
            onClick={onOpenEmailLog}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            title="System Email Delivery Log"
          >
            <Bell className="w-5 h-5" />
          </button>
        )}

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
