import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Users, Home, Calendar, CreditCard, MessageSquare, Car,
  Shield, ClipboardList, Bell, CheckCircle, AlertTriangle, ArrowRight, TrendingUp
} from 'lucide-react';

export const AdminDashboard = ({ setActiveView }) => {
  const { currentUser, homeowners, reservations, dues, payments, concerns, users, vehicles, stickerRenewals } = useApp();

  const displayName = currentUser?.fullName || 'Administrator';

  const pendingUsers = users.filter(u => u.status === 'pending').length;
  const pendingReservations = reservations.filter(r => r.status === 'pending').length;
  const unpaidDues = dues.filter(d => d.status === 'unpaid').length;
  const pendingPayments = payments.filter(p => p.validationStatus === 'pending').length;
  const openConcerns = concerns.filter(c => c.status === 'pending').length;
  const pendingStickers = stickerRenewals.filter(s => s.status === 'pending').length;

  
  const adminModules = [
    {
      id: 'announcements',
      title: 'Events & Announcements',
      desc: 'Publish community events, meeting notices, and urgent board bulletins',
      icon: Bell,
      bg: 'bg-emerald-100 text-emerald-600',
      badge: null
    },
    {
      id: 'reservations',
      title: 'Facility Reservation',
      desc: 'Review and approve facility bookings for residents and guest visitors',
      icon: Calendar,
      bg: 'bg-purple-100 text-purple-600',
      badge: pendingReservations > 0 ? `${pendingReservations} pending` : null
    },
    {
      id: 'dues',
      title: 'Dues & Payments',
      desc: 'Validate submitted payment proofs, monitor dues, and update balances',
      icon: CreditCard,
      bg: 'bg-emerald-100 text-emerald-600',
      badge: pendingPayments > 0 ? `${pendingPayments} for validation` : null
    },
    {
      id: 'vehicles',
      title: 'Vehicle Registration',
      desc: 'Review resident vehicle submissions for inclusion in master registry',
      icon: Car,
      bg: 'bg-orange-100 text-orange-600',
      badge: null
    },
    {
      id: 'stickers',
      title: 'HOA Sticker Renewal',
      desc: 'Process vehicle sticker renewal requests and issue official sticker numbers',
      icon: ClipboardList,
      bg: 'bg-indigo-100 text-indigo-600',
      badge: pendingStickers > 0 ? `${pendingStickers} pending` : null
    },
    {
      id: 'concerns',
      title: 'Resident Concerns',
      desc: 'Review submitted resident tickets and send official administrative responses',
      icon: MessageSquare,
      bg: 'bg-blue-100 text-blue-600',
      badge: openConcerns > 0 ? `${openConcerns} open` : null
    },
    {
      id: 'homeowners',
      title: 'Homeowners Master Records',
      desc: 'Manage resident profiles, household occupants, and restriction statuses',
      icon: Home,
      bg: 'bg-sky-100 text-sky-600',
      badge: `${homeowners.length} registered`
    },
    {
      id: 'user-management',
      title: 'User Account Management',
      desc: 'Approve or reject pending account registrations for residents and guards',
      icon: Users,
      bg: 'bg-amber-100 text-amber-600',
      badge: pendingUsers > 0 ? `${pendingUsers} pending` : null
    },
    {
      id: 'visitor-management',
      title: 'Security Visitor Logs',
      desc: 'View all entry and exit logs recorded at the security gate',
      icon: Shield,
      bg: 'bg-slate-100 text-slate-700',
      badge: null
    },
    {
      id: 'dues-charts',
      title: 'Dues & Collection Summary',
      desc: 'View charts on paid accounts, overdue balances, and monthly collection totals',
      icon: TrendingUp,
      bg: 'bg-teal-100 text-teal-600',
      badge: null
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
          Good morning, {displayName}! 👋
        </h1>
        <p className="text-sm text-slate-400 mt-1">Welcome to your NHAI administration portal</p>
      </div>

      {}
      {(pendingPayments > 0 || pendingUsers > 0 || pendingReservations > 0) && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-700/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-300">Action Required</div>
              <div className="text-xs text-amber-400/80 mt-0.5">
                {pendingPayments > 0 && `${pendingPayments} payment proof(s) `}
                {pendingUsers > 0 && `${pendingUsers} user account(s) `}
                {pendingReservations > 0 && `${pendingReservations} facility reservation(s) `}
                awaiting your review.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {pendingPayments > 0 && (
              <button onClick={() => setActiveView('dues')} className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition">
                Review Payments
              </button>
            )}
            {pendingUsers > 0 && (
              <button onClick={() => setActiveView('user-management')} className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-amber-700/50 transition">
                Approve Users
              </button>
            )}
          </div>
        </div>
      )}

      {}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Management Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {adminModules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                onClick={() => setActiveView(m.id)}
                className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-850 p-6 rounded-2xl transition duration-200 cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${m.bg} shadow-sm`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    {m.badge && (
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-amber-950/80 border border-amber-700/50 text-amber-400">
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-blue-400 transition">{m.title}</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{m.desc}</p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-500 group-hover:text-blue-400 transition">
                  <span>Open Module</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
