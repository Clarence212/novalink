import React, { useMemo, useState } from 'react';
import { Clock3, MailCheck, MailWarning, RefreshCw, Search, ShieldOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState, PageHeader, StatCard } from '../components/ui/Primitives';

const formatDate = (value) => {
  if (!value) return 'Not attempted';
  const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const statusStyle = {
  sent: 'bg-emerald-950 text-emerald-300',
  failed: 'bg-red-950 text-red-300',
  queued: 'bg-amber-950 text-amber-300',
  suppressed: 'bg-slate-700 text-slate-300',
};

export const EmailDeliveryDashboard = () => {
  const { emailLog = [], notificationPreferencesReady, retryEmailDelivery } = useApp();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const counts = useMemo(() => ({
    sent: emailLog.filter((item) => item.status === 'sent').length,
    failed: emailLog.filter((item) => item.status === 'failed').length,
    queued: emailLog.filter((item) => item.status === 'queued').length,
    suppressed: emailLog.filter((item) => item.status === 'suppressed').length,
  }), [emailLog]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return emailLog.filter((item) => (status === 'all' || item.status === status) && (!needle
      || String(item.to || '').toLowerCase().includes(needle)
      || String(item.subject || '').toLowerCase().includes(needle)
      || String(item.category || '').toLowerCase().includes(needle)));
  }, [emailLog, search, status]);

  const retry = async (id) => {
    setBusyId(id);
    await retryEmailDelivery(id);
    setBusyId('');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <PageHeader eyebrow="Communication operations" title="Email delivery" description="Review outgoing messages, investigate failures, and retry failed deliveries without accessing server logs." />

      {!notificationPreferencesReady && <div className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-200">Detailed categories, suppressed-message tracking, and retries require database migration 005. Existing delivery records are still shown.</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Delivered" value={counts.sent} detail="Accepted by the email provider" icon={MailCheck} tone="emerald" />
        <StatCard label="Failed" value={counts.failed} detail="Needs review or retry" icon={MailWarning} tone="red" />
        <StatCard label="Queued" value={counts.queued} detail="Waiting for a delivery result" icon={Clock3} tone="amber" />
        <StatCard label="Suppressed" value={counts.suppressed} detail="Disabled by recipient preference" icon={ShieldOff} tone="slate" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4"><Search className="h-4 w-4 text-slate-500" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recipient, subject, or category" className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600" /></div>
        <div className="flex flex-wrap gap-2">{['all', 'sent', 'failed', 'queued', 'suppressed'].map((value) => <button type="button" key={value} onClick={() => setStatus(value)} className={`rounded-xl px-3 py-2 text-sm font-semibold capitalize ${status === value ? 'bg-blue-600 text-white' : 'border border-slate-700 bg-slate-900 text-slate-400 hover:text-white'}`}>{value}</button>)}</div>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
        <table data-responsive-table="true" className="w-full min-w-[980px] text-sm">
          <thead><tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Message</th><th className="px-5 py-3">Recipient</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Last attempt</th><th className="px-5 py-3">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-800">{filtered.map((item) => <tr key={item.id} className="align-top hover:bg-slate-800/40"><td data-label="Message" className="max-w-lg px-5 py-4"><p className="font-bold text-slate-100">{item.subject}</p><p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{item.body}</p><p className="mt-2 text-xs capitalize text-blue-400">{item.category || item.type || 'general'}</p></td><td data-label="Recipient" className="px-5 py-4"><p className="font-semibold text-slate-300">{item.recipientName || 'Recipient'}</p><p className="mt-1 text-xs text-slate-500">{item.to}</p></td><td data-label="Status" className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusStyle[item.status] || statusStyle.queued}`}>{item.status}</span>{item.failureReason && <p className="mt-2 max-w-xs text-xs leading-4 text-red-300">{item.failureReason}</p>}</td><td data-label="Last attempt" className="px-5 py-4 text-slate-400"><p>{formatDate(item.lastAttemptAt || item.sentAt || item.createdAt)}</p><p className="mt-1 text-xs text-slate-600">{Number(item.retryCount || 0)} manual retries</p></td><td data-label="Action" className="px-5 py-4">{item.status === 'failed' && item.type !== 'otp_verification' ? <button type="button" onClick={() => retry(item.id)} disabled={!notificationPreferencesReady || busyId === item.id || Number(item.retryCount || 0) >= 5} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"><RefreshCw className={`h-4 w-4 ${busyId === item.id ? 'animate-spin' : ''}`} /> Retry</button> : <span className="text-xs text-slate-600">{item.type === 'otp_verification' && item.status === 'failed' ? 'Send a new code' : 'No action needed'}</span>}</td></tr>)}</tbody>
        </table>
        {filtered.length === 0 && <EmptyState title="No delivery records match" description="Try another status or clear the search field." />}
      </section>
    </div>
  );
};
