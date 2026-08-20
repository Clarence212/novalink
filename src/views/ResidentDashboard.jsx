// hey reader! resident dashboard featuring the modern card grid UI design concept
import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar, CreditCard, MessageSquare, Bell, Car, ClipboardList,
  AlertTriangle, CheckCircle, ArrowRight, Lock
} from 'lucide-react';

export const ResidentDashboard = ({ setActiveView }) => {
  const { currentUser, currentHomeowner, dues, reservations, concerns, announcements, isRestricted, stickerRenewals } = useApp();

  const displayName = currentUser?.fullName || 'Resident';

  const myDues = dues.filter(d => d.homeownerId === currentHomeowner?.id);
  const unpaidDues = myDues.filter(d => d.status === 'unpaid');
  const myReservations = reservations.filter(r => r.homeownerId === currentHomeowner?.id);
  const myConcerns = concerns.filter(c => c.homeownerId === currentHomeowner?.id);
  const myStickers = stickerRenewals.filter(s => s.homeownerId === currentHomeowner?.id);

  // Exact 6 Modules matching screenshot concept
  const residentModules = [
    {
      id: 'announcements',
      title: 'Events & Announcements',
      desc: 'Stay updated with community events, meetings, and important announcements',
      icon: Bell,
      bg: 'bg-emerald-100 text-emerald-600',
      locked: false,
      badge: `${announcements.length} bulletins`
    },
    {
      id: 'reservations',
      title: 'Facility Reservation',
      desc: 'Book and manage community facilities like pool, BBQ area, and recreation center',
      icon: Calendar,
      bg: 'bg-purple-100 text-purple-600',
      locked: isRestricted,
      badge: myReservations.length > 0 ? `${myReservations.length} booked` : null
    },
    {
      id: 'dues',
      title: 'Dues & Payments',
      desc: 'Manage monthly HOA dues, payment history, and financial records',
      icon: CreditCard,
      bg: 'bg-emerald-100 text-emerald-600',
      locked: false,
      badge: unpaidDues.length > 0 ? `${unpaidDues.length} month(s) unpaid` : 'All Paid ✓'
    },
    {
      id: 'vehicles',
      title: 'Vehicle Registration',
      desc: 'Submit your vehicle information to NHAI for approval and inclusion in the master record',
      icon: Car,
      bg: 'bg-orange-100 text-orange-600',
      locked: false,
      badge: null
    },
    {
      id: 'stickers',
      title: 'HOA Sticker Renewal',
      desc: 'Request renewal of your HOA vehicle sticker for registered and approved vehicles',
      icon: ClipboardList,
      bg: 'bg-indigo-100 text-indigo-600',
      locked: isRestricted,
      badge: myStickers.length > 0 ? `${myStickers.length} renewal(s)` : null
    },
    {
      id: 'concerns',
      title: 'Submit a Concern',
      desc: 'Report issues and submit concerns to the administration team',
      icon: MessageSquare,
      bg: 'bg-blue-100 text-blue-600',
      locked: isRestricted,
      badge: myConcerns.length > 0 ? `${myConcerns.length} ticket(s)` : null
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Greeting Header matching screenshot concept */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
          Good morning, {displayName}! 👋
        </h1>
        <p className="text-sm text-slate-400 mt-1">Welcome to your community dashboard</p>
      </div>

      {/* Dues Alert Banner if unpaid */}
      {unpaidDues.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/30 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-red-300">You have {unpaidDues.length} unpaid billing month(s)</div>
              <div className="text-xs text-red-400/80 mt-0.5">
                {unpaidDues.map(d => d.billingMonth).join(', ')}
                {isRestricted && ' — Certain services are locked until dues are settled.'}
              </div>
            </div>
          </div>
          <button onClick={() => setActiveView('dues')} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition">
            Pay Dues Now
          </button>
        </div>
      )}

      {/* Main 6 Cards Grid (2 rows x 3 cols layout from UI Concept) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {residentModules.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.id}
              onClick={() => !m.locked && setActiveView(m.id)}
              className={`p-6 rounded-2xl border transition duration-200 flex flex-col justify-between group shadow-sm ${
                m.locked
                  ? 'bg-slate-900/50 border-slate-800/60 opacity-60 cursor-not-allowed'
                  : 'bg-slate-900 border-slate-800 hover:border-blue-500/50 hover:bg-slate-850 cursor-pointer hover:shadow-lg'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${m.bg} shadow-sm`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  {m.locked ? (
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-slate-800 text-slate-400 flex items-center gap-1 border border-slate-700">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  ) : m.badge ? (
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${unpaidDues.length > 0 && m.id === 'dues' ? 'bg-red-950/80 border border-red-700/50 text-red-400' : 'bg-slate-800 border border-slate-700 text-slate-300'}`}>
                      {m.badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-blue-400 transition">{m.title}</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{m.desc}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-500 group-hover:text-blue-400 transition">
                <span>{m.locked ? 'Service Restricted' : 'Access Module'}</span>
                {!m.locked && <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
