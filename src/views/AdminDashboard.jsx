import React, { useMemo } from 'react';
import {
  ArrowRight, BarChart3, Bell, Calendar, Car, ClipboardList, CreditCard,
  Eye, Home, MessageSquare, ShieldCheck, UserCheck, Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, EmptyState, PageHeader, StatCard } from '../components/ui/Primitives';

const parseTime = (value) => {
  if (!value) return 0;
  const date = new Date(String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const formatActivityTime = (value) => {
  const timestamp = parseTime(value);
  if (!timestamp) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
  }).format(new Date(timestamp));
};

export const AdminDashboard = ({ setActiveView }) => {
  const {
    currentUser, homeowners, reservations, dues, payments,
    concerns, users, vehicles, stickerRenewals, visitorLogs,
  } = useApp();

  const pendingUsers = users.filter((user) => user.status === 'pending').length;
  const pendingReservations = reservations.filter((reservation) => reservation.status === 'pending').length;
  const pendingPayments = payments.filter((payment) => payment.validationStatus === 'pending').length;
  const openConcerns = concerns.filter((concern) => concern.status !== 'resolved').length;
  const pendingVehicles = vehicles.filter((vehicle) => vehicle.approvalStatus === 'pending').length;
  const pendingStickers = stickerRenewals.filter((renewal) => renewal.status === 'pending').length;
  const activeResidents = users.filter((user) => user.role === 'resident' && user.status === 'active').length;
  const outstanding = dues.reduce((sum, due) => sum + Number(due.balanceDue || 0), 0);
  const delinquent = new Set(dues.filter((due) => Number(due.daysOverdue) > 0 && Number(due.balanceDue) > 0).map((due) => due.homeownerId)).size;
  const onSite = visitorLogs.filter((log) => !log.exitTime).length;

  const attention = [
    { id: 'payment', label: 'Payment proofs', detail: 'Awaiting validation', count: pendingPayments, view: 'dues', icon: CreditCard, tone: 'emerald' },
    { id: 'accounts', label: 'User approvals', detail: 'Pending account decision', count: pendingUsers, view: 'user-management', icon: UserCheck, tone: 'amber' },
    { id: 'reservation', label: 'Reservations', detail: 'Awaiting review', count: pendingReservations, view: 'reservations', icon: Calendar, tone: 'violet' },
    { id: 'concern', label: 'Resident concerns', detail: 'Still open', count: openConcerns, view: 'concerns', icon: MessageSquare, tone: 'blue' },
    { id: 'vehicle', label: 'Vehicle records', detail: 'Awaiting approval', count: pendingVehicles, view: 'vehicles', icon: Car, tone: 'amber' },
    { id: 'sticker', label: 'Sticker renewals', detail: 'Awaiting processing', count: pendingStickers, view: 'stickers', icon: ClipboardList, tone: 'violet' },
  ].filter((item) => item.count > 0);

  const recentActivity = useMemo(() => [
    ...payments.slice(0, 8).map((payment) => ({
      id: `payment-${payment.id}`, type: 'Payment', title: `${payment.homeownerName || 'Resident'} submitted ${Number(payment.amountPaid || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}`,
      detail: payment.validationStatus, date: payment.createdAt, view: 'dues',
    })),
    ...reservations.slice(0, 8).map((reservation) => ({
      id: `reservation-${reservation.id}`, type: 'Reservation', title: `${reservation.requesterName || 'Requester'} · ${reservation.date}`,
      detail: reservation.status, date: reservation.createdAt || reservation.date, view: 'reservations',
    })),
    ...concerns.slice(0, 8).map((concern) => ({
      id: `concern-${concern.id}`, type: 'Concern', title: concern.subject,
      detail: concern.status, date: concern.submittedAt, view: 'concerns',
    })),
    ...users.slice(0, 8).map((user) => ({
      id: `user-${user.id}`, type: 'Account', title: user.fullName,
      detail: user.status, date: user.createdAt, view: 'user-management',
    })),
  ].sort((left, right) => parseTime(right.date) - parseTime(left.date)).slice(0, 8), [concerns, payments, reservations, users]);

  const modules = [
    { id: 'homeowners', label: 'Homeowners', description: 'Master records and households', icon: Home },
    { id: 'user-management', label: 'Accounts', description: 'Users, roles, and access', icon: Users },
    { id: 'dues', label: 'Dues & Payments', description: 'Billing and reconciliation', icon: CreditCard },
    { id: 'reservations', label: 'Reservations', description: 'Facility schedule and requests', icon: Calendar },
    { id: 'visitor-management', label: 'Visitor Management', description: 'Gate activity and daily logs', icon: Eye },
    { id: 'vehicles', label: 'Vehicles', description: 'Vehicle registry approvals', icon: Car },
    { id: 'stickers', label: 'Sticker Renewals', description: 'Renewal processing', icon: ClipboardList },
    { id: 'concerns', label: 'Concerns', description: 'Resident service tickets', icon: MessageSquare },
    { id: 'announcements', label: 'Announcements', description: 'Community bulletins', icon: Bell },
    { id: 'reports', label: 'Reports', description: 'Operational and financial insights', icon: BarChart3 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-5 sm:p-8">
      <PageHeader eyebrow="Administrator overview" title={`Good morning, ${currentUser?.fullName || 'Administrator'}`} description="Start with the work that needs attention, then move into the relevant management area." actions={<Button onClick={() => setActiveView('reports')}><BarChart3 className="h-4 w-4" /> View reports</Button>} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding dues" value={outstanding.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })} detail={`${delinquent} homeowner(s) overdue`} icon={CreditCard} tone="red" onClick={() => setActiveView('dues')} />
        <StatCard label="Pending decisions" value={attention.reduce((sum, item) => sum + item.count, 0)} detail={`${attention.length} active work queue(s)`} icon={ShieldCheck} tone="amber" />
        <StatCard label="Visitors on site" value={onSite} detail="Current open gate entries" icon={Eye} tone="blue" onClick={() => setActiveView('visitor-management')} />
        <StatCard label="Active homeowners" value={homeowners.length} detail={`${activeResidents} active resident account(s)`} icon={Home} tone="cyan" onClick={() => setActiveView('homeowners')} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <section className="ui-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div><p className="ui-eyebrow">Needs attention</p><h2 className="mt-1 text-base font-bold text-slate-100">Today’s administrative queue</h2></div>
            <span className="rounded-full bg-amber-950 px-2.5 py-1 text-xs font-bold text-amber-300">{attention.reduce((sum, item) => sum + item.count, 0)} total</span>
          </div>
          {attention.length ? <div className="grid gap-2 p-3 sm:grid-cols-2">
            {attention.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => setActiveView(item.view)} className="group flex min-h-20 items-center gap-3 rounded-xl border border-transparent p-3 text-left transition hover:border-slate-700 hover:bg-slate-800">
                <span className={`ui-icon-tile ui-icon-${item.tone}`}><Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-200">{item.label}</span><span className="mt-0.5 block text-xs text-slate-500">{item.detail}</span></span>
                <span className="text-lg font-extrabold text-slate-100">{item.count}</span><ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-blue-400" />
              </button>;
            })}
          </div> : <EmptyState icon={ShieldCheck} title="Nothing needs immediate review" description="All current approval and service queues are clear." />}
        </section>

        <section className="ui-surface overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-4"><p className="ui-eyebrow">Recent activity</p><h2 className="mt-1 text-base font-bold text-slate-100">Latest system records</h2></div>
          {recentActivity.length ? <div className="divide-y divide-slate-800">
            {recentActivity.map((activity) => <button type="button" key={activity.id} onClick={() => setActiveView(activity.view)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-800/60">
              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-300">{activity.title}</span><span className="mt-1 block text-[11px] text-slate-500">{activity.type} · {formatActivityTime(activity.date)}</span></span>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase text-slate-400">{activity.detail}</span>
            </button>)}
          </div> : <EmptyState title="No recent activity" description="New submissions and decisions will appear here." />}
        </section>
      </div>

      <section>
        <div className="mb-3"><p className="ui-eyebrow">Management areas</p><h2 className="mt-1 text-base font-bold text-slate-100">Open a module</h2></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((module) => {
            const Icon = module.icon;
            return <button type="button" key={module.id} onClick={() => setActiveView(module.id)} className="ui-surface ui-interactive group flex min-h-24 items-center gap-3 p-4 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400 group-hover:bg-blue-950 group-hover:text-blue-400"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-200">{module.label}</span><span className="mt-1 block text-xs leading-4 text-slate-500">{module.description}</span></span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-blue-400" />
            </button>;
          })}
        </div>
      </section>
    </div>
  );
};
