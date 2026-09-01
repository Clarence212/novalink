import React, { useMemo, useState } from 'react';
import { ArrowRight, Bell, Clock3, DoorOpen, LogOut, Search, ShieldCheck, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, EmptyState, PageHeader, StatCard } from '../components/ui/Primitives';

const manilaToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const GuardDashboard = ({ setActiveView }) => {
  const { currentUser, visitorLogs, updateVisitorExit, announcements } = useApp();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const today = manilaToday();
  const todayLogs = visitorLogs.filter((log) => log.entryDate === today);
  const onSite = visitorLogs.filter((log) => !log.exitTime);
  const visibleOnSite = useMemo(() => onSite.filter((log) => (
    log.visitorName.toLowerCase().includes(search.toLowerCase())
    || log.destinationAddress.toLowerCase().includes(search.toLowerCase())
  )), [onSite, search]);

  const checkout = async (id) => {
    setBusy(id);
    await updateVisitorExit(id);
    setBusy('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Security overview"
        title={`Welcome, ${currentUser?.fullName || 'Security Officer'}`}
        description="Keep the gate moving. Validate passes and record entries in Visitor Gate, then check visitors out from this live list."
        actions={<Button onClick={() => setActiveView('visitor-management')} className="min-h-12 px-5 text-sm"><DoorOpen className="h-5 w-5" /> Open Visitor Gate</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Currently on site" value={onSite.length} detail="Open visitor entries" icon={Users} tone="emerald" />
        <StatCard label="Entries today" value={todayLogs.length} detail={today} icon={ShieldCheck} tone="blue" />
        <StatCard label="Checked out today" value={todayLogs.filter((log) => log.exitTime).length} detail="Completed visits" icon={LogOut} tone="violet" />
      </div>

      <section className="ui-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="ui-eyebrow">Live gate status</p><h2 className="mt-1 text-base font-bold text-slate-100">Visitors currently on site</h2></div>
          <label className="relative block sm:w-80"><span className="sr-only">Search on-site visitors</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="ui-input pl-9" placeholder="Search visitor or destination" /></label>
        </div>
        {visibleOnSite.length ? <div className="grid gap-3 p-4 lg:grid-cols-2">
          {visibleOnSite.map((log) => <article key={log.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-base font-bold text-slate-100">{log.visitorName}</h3><p className="mt-1 text-sm text-slate-400">{log.destinationAddress}</p></div><span className="rounded-full bg-emerald-950 px-2.5 py-1 text-xs font-bold text-emerald-300">ON SITE</span></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-slate-500">Purpose</p><p className="mt-1 font-semibold text-slate-300">{log.purpose}</p></div><div><p className="text-slate-500">Entered</p><p className="mt-1 font-semibold text-slate-300">{log.entryTimeDisplay || log.entryTime}</p></div></div>
            <Button variant="warning" disabled={busy === log.id} onClick={() => checkout(log.id)} className="mt-4 min-h-12 w-full text-sm"><LogOut className="h-5 w-5" /> {busy === log.id ? 'Checking out…' : 'Quick check-out'}</Button>
          </article>)}
        </div> : <EmptyState icon={Clock3} title={search ? 'No matching on-site visitors' : 'No visitors are currently on site'} description={search ? 'Try a different visitor name or destination.' : 'Newly admitted visitors will appear here immediately.'} />}
      </section>

      <section className="ui-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><p className="ui-eyebrow">Community updates</p><h2 className="mt-1 text-base font-bold text-slate-100">Latest announcements</h2></div><button type="button" onClick={() => setActiveView('announcements')} className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300">View all <ArrowRight className="h-4 w-4" /></button></div>
        {announcements.length ? <div className="divide-y divide-slate-800">{announcements.slice(0, 3).map((announcement) => <article key={announcement.id} className="flex items-start gap-3 px-5 py-4"><span className="ui-icon-tile ui-icon-blue h-9 w-9 rounded-xl"><Bell className="h-4 w-4" /></span><div><p className="text-sm font-bold text-slate-200">{announcement.title}</p><p className="mt-1 text-xs text-slate-500">{announcement.datePosted}</p></div></article>)}</div> : <EmptyState icon={Bell} title="No current announcements" description="Published community notices will appear here." />}
      </section>
    </div>
  );
};
