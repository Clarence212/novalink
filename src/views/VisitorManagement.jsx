import React, { useMemo, useState } from 'react';
import {
  CalendarDays, Clipboard, Download, LogIn, LogOut, Plus,
  Search, ShieldCheck, UserRoundCheck, UsersRound, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConfirmDialog, EmptyState, PageHeader, StatCard } from '../components/ui/Primitives';

const localDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

const inputClass = 'w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-500';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-700 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50';
const statusClass = {
  active: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
  used: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  cancelled: 'border-slate-500/40 bg-slate-500/15 text-slate-400',
  expired: 'border-red-500/40 bg-red-500/15 text-red-300',
};
const PassStatus = ({ value }) => <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusClass[value] || statusClass.cancelled}`}>{value}</span>;
const Field = ({ label, children }) => <label className="block space-y-1"><span className="text-xs font-medium text-slate-400">{label}</span>{children}</label>;

const ResidentPasses = () => {
  const {
    visitorPasses, visitorPassesReady, createVisitorPass, cancelVisitorPass, showToast,
  } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState('');
  const [cancellingPass, setCancellingPass] = useState(null);
  const [form, setForm] = useState({ visitorName: '', contactNumber: '', purpose: '', vehiclePlate: '', visitDate: localDate() });

  const submit = async (event) => {
    event.preventDefault();
    setBusy('create');
    const result = await createVisitorPass(form);
    setBusy('');
    if (result.success) {
      setForm({ visitorName: '', contactNumber: '', purpose: '', vehiclePlate: '', visitDate: localDate() });
      setShowForm(false);
    }
  };
  const cancel = async (id) => {
    setBusy(id);
    await cancelVisitorPass(id);
    setBusy('');
    setCancellingPass(null);
  };
  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast('Visitor pass code copied.', 'success');
    } catch {
      showToast(`Pass code: ${code}`, 'info');
    }
  };

  return <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
    <PageHeader eyebrow="Visitor access" title="Visitor Passes" description="Create a one-time code for your visitor to present to security." actions={<button type="button" disabled={!visitorPassesReady} onClick={() => setShowForm((value) => !value)} className={primaryButton}><Plus className="h-4 w-4" /> Create Pass</button>} />

    {!visitorPassesReady && <div className="rounded-2xl border border-amber-700/50 bg-amber-950/30 p-4 text-xs text-amber-200">Visitor passes are prepared in the application, but database migration <strong>003_visitor_passes</strong> must be applied before this feature can be used.</div>}

    {showForm && visitorPassesReady && <form onSubmit={submit} className="rounded-2xl border border-blue-700/50 bg-blue-950/20 p-5">
      <div className="mb-4"><h3 className="text-sm font-bold text-blue-200">New visitor pass</h3><p className="mt-1 text-[11px] text-slate-400">The code works once and only on the selected date. Security must type the exact code before entry.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Visitor name"><input required maxLength="120" className={inputClass} value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} /></Field>
        <Field label="Contact number"><input required maxLength="30" className={inputClass} value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} /></Field>
        <Field label="Purpose"><input required maxLength="120" className={inputClass} placeholder="Personal visit, delivery, service…" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>
        <Field label="Vehicle plate (optional)"><input maxLength="30" className={inputClass} value={form.vehiclePlate} onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value.toUpperCase() })} /></Field>
        <Field label="Visit date"><input required type="date" min={localDate()} className={inputClass} value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} /></Field>
      </div>
      <div className="mt-4 flex gap-2"><button disabled={busy === 'create'} className={primaryButton}>Generate Pass</button><button type="button" onClick={() => setShowForm(false)} className={secondaryButton}>Cancel</button></div>
    </form>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visitorPasses.map((pass) => <article key={pass.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
        <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold text-slate-100">{pass.visitorName}</div><div className="mt-1 text-xs text-slate-500">{pass.contactNumber}</div></div><PassStatus value={pass.status} /></div>
        <button type="button" onClick={() => copyCode(pass.passCode)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-blue-700/50 bg-slate-900 px-4 py-3 text-left">
          <span><span className="block text-[9px] uppercase tracking-widest text-slate-500">Pass code</span><span className="font-mono text-lg font-black tracking-wider text-blue-300">{pass.passCode}</span></span><Clipboard className="h-4 w-4 text-slate-500" />
        </button>
        <dl className="mt-4 space-y-2 text-xs"><div className="flex justify-between gap-4"><dt className="text-slate-500">Visit date</dt><dd className="font-medium text-slate-300">{pass.visitDate}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Purpose</dt><dd className="text-right text-slate-300">{pass.purpose}</dd></div>{pass.vehiclePlate && <div className="flex justify-between gap-4"><dt className="text-slate-500">Vehicle</dt><dd className="font-mono text-slate-300">{pass.vehiclePlate}</dd></div>}</dl>
        {pass.status === 'active' && <button type="button" disabled={busy === pass.id} onClick={() => setCancellingPass(pass)} className="mt-4 inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-red-300 hover:text-red-200"><X className="h-3 w-3" /> Cancel pass</button>}
      </article>)}
    </div>
    {visitorPasses.length === 0 && visitorPassesReady && <div className="rounded-2xl border border-dashed border-slate-700"><EmptyState icon={UsersRound} title="No visitor passes yet" description="Create a pass when a visitor needs one-time access to the community." /></div>}
    <ConfirmDialog open={Boolean(cancellingPass)} title="Cancel this visitor pass?" description={cancellingPass ? `${cancellingPass.visitorName} will no longer be able to use ${cancellingPass.passCode}.` : ''} impact="Cancellation takes effect immediately and the same code cannot be reactivated." confirmLabel="Cancel Pass" busy={Boolean(cancellingPass && busy === cancellingPass.id)} onCancel={() => setCancellingPass(null)} onConfirm={() => cancel(cancellingPass.id)} />
  </div>;
};

const GateVisitorManagement = () => {
  const {
    visitorLogs, visitorPassesReady, currentUser, addVisitorLog, updateVisitorExit,
    lookupVisitorPass, admitVisitorPass,
  } = useApp();
  const [reportDate, setReportDate] = useState(localDate());
  const [search, setSearch] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [busy, setBusy] = useState('');
  const [passCode, setPassCode] = useState('');
  const [matchedPass, setMatchedPass] = useState(null);
  const [checkingOut, setCheckingOut] = useState(null);
  const [manualForm, setManualForm] = useState({ visitorName: '', contactNumber: '', purpose: '', destinationAddress: '', vehiclePlate: '' });
  const canOperate = ['admin', 'security'].includes(currentUser?.role);

  const dayLogs = useMemo(() => visitorLogs.filter((log) => log.entryDate === reportDate), [reportDate, visitorLogs]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dayLogs.filter((log) => !term || [log.visitorName, log.destinationAddress, log.vehiclePlate, log.hostName].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [dayLogs, search]);
  const onSite = dayLogs.filter((log) => !log.exitTime).length;
  const residentPassEntries = dayLogs.filter((log) => log.entrySource === 'resident_pass').length;

  const lookup = async (event) => {
    event.preventDefault(); setBusy('lookup'); setMatchedPass(null);
    const result = await lookupVisitorPass(passCode); setBusy('');
    if (result.success) setMatchedPass(result.pass);
  };
  const admit = async () => {
    if (!matchedPass) return;
    setBusy('admit'); const result = await admitVisitorPass(matchedPass.passCode); setBusy('');
    if (result.success) { setMatchedPass(null); setPassCode(''); }
  };
  const submitManual = async (event) => {
    event.preventDefault(); setBusy('manual'); const result = await addVisitorLog(manualForm); setBusy('');
    if (result.success) { setManualForm({ visitorName: '', contactNumber: '', purpose: '', destinationAddress: '', vehiclePlate: '' }); setShowManual(false); }
  };
  const checkout = async (id) => { setBusy(id); await updateVisitorExit(id); setBusy(''); setCheckingOut(null); };

  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
    <PageHeader eyebrow="Gate operations" title="Visitor Management" description="Validate pass codes, record gate entries, check visitors out, and export a daily report." actions={<><button type="button" onClick={() => setShowManual((value) => !value)} className={secondaryButton}><Plus className="h-4 w-4" /> Manual Entry</button><a href={`/backend/api/visitor_report.php?date=${encodeURIComponent(reportDate)}`} className={primaryButton}><Download className="h-4 w-4" /> Daily CSV</a></>} />

    {canOperate && <div className="rounded-2xl border border-blue-700/50 bg-blue-950/20 p-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <form onSubmit={lookup}><h3 className="flex items-center gap-2 text-sm font-bold text-blue-200"><ShieldCheck className="h-4 w-4" /> Validate visitor pass</h3><p className="mt-1 text-[11px] text-slate-400">Type the code presented by the visitor. Passes are one-time and date-limited.</p><div className="mt-4 flex gap-2"><input disabled={!visitorPassesReady} required maxLength="20" className={`${inputClass} font-mono uppercase tracking-wider`} placeholder="NVL-XXXXXXXX" value={passCode} onChange={(e) => { setPassCode(e.target.value.toUpperCase()); setMatchedPass(null); }} /><button disabled={!visitorPassesReady || busy === 'lookup'} className={primaryButton}>Check Code</button></div>{!visitorPassesReady && <div className="mt-2 text-[11px] text-amber-300">Migration 003_visitor_passes must be applied before pass validation is available.</div>}</form>
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">{matchedPass ? <><div className="flex items-center gap-2 text-sm font-bold text-emerald-300"><UserRoundCheck className="h-4 w-4" /> Valid for entry today</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><span className="text-slate-500">Visitor</span><div className="font-semibold text-slate-200">{matchedPass.visitorName}</div></div><div><span className="text-slate-500">Host</span><div className="font-semibold text-slate-200">{matchedPass.hostName}</div></div><div><span className="text-slate-500">Destination</span><div className="text-slate-300">{matchedPass.hostBlockLot}, {matchedPass.hostStreet}</div></div><div><span className="text-slate-500">Purpose</span><div className="text-slate-300">{matchedPass.purpose}</div></div>{matchedPass.vehiclePlate && <div><span className="text-slate-500">Vehicle</span><div className="font-mono text-slate-300">{matchedPass.vehiclePlate}</div></div>}</div><button type="button" disabled={busy === 'admit'} onClick={admit} className={`${primaryButton} mt-4`}><LogIn className="h-4 w-4" /> Admit & Record Entry</button></> : <div className="flex min-h-28 items-center justify-center text-center text-xs text-slate-500">Validated pass details appear here. No visitor-pass list is exposed to security.</div>}</div>
      </div>
    </div>}

    {showManual && <form onSubmit={submitManual} className="rounded-2xl border border-slate-700 bg-slate-800 p-5"><h3 className="mb-4 text-sm font-bold text-slate-200">Manual gate entry</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Visitor name"><input required maxLength="120" className={inputClass} value={manualForm.visitorName} onChange={(e) => setManualForm({ ...manualForm, visitorName: e.target.value })} /></Field><Field label="Contact number"><input required maxLength="30" className={inputClass} value={manualForm.contactNumber} onChange={(e) => setManualForm({ ...manualForm, contactNumber: e.target.value })} /></Field><Field label="Purpose"><input required maxLength="120" className={inputClass} value={manualForm.purpose} onChange={(e) => setManualForm({ ...manualForm, purpose: e.target.value })} /></Field><Field label="Vehicle plate (optional)"><input maxLength="30" className={inputClass} value={manualForm.vehiclePlate} onChange={(e) => setManualForm({ ...manualForm, vehiclePlate: e.target.value.toUpperCase() })} /></Field><div className="sm:col-span-2"><Field label="Destination address or homeowner"><input required maxLength="190" className={inputClass} value={manualForm.destinationAddress} onChange={(e) => setManualForm({ ...manualForm, destinationAddress: e.target.value })} /></Field></div></div><div className="mt-4 flex gap-2"><button disabled={busy === 'manual'} className={primaryButton}>Save Entry</button><button type="button" onClick={() => setShowManual(false)} className={secondaryButton}>Cancel</button></div></form>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Entries" value={dayLogs.length} detail="Recorded today" icon={UsersRound} tone="blue" /><StatCard label="On-site" value={onSite} detail="Awaiting checkout" icon={LogIn} tone="emerald" /><StatCard label="Checked out" value={dayLogs.length - onSite} detail="Completed visits" icon={LogOut} tone="amber" /><StatCard label="Resident-pass entries" value={residentPassEntries} detail="Validated codes" icon={ShieldCheck} tone="violet" /></div>

    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
      <div className="flex flex-col gap-3 border-b border-slate-700 p-4 md:flex-row md:items-center"><label className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-xs text-slate-400"><CalendarDays className="h-4 w-4" /><input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="bg-transparent text-slate-200 outline-none" /></label><label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-600 bg-slate-700 px-3 py-2"><Search className="h-4 w-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search visitor, destination, host, or vehicle…" className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500" /></label></div>
      <div className="overflow-x-auto"><table data-responsive-table="true" className="w-full min-w-[1000px] text-xs"><thead><tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Visitor</th><th className="px-5 py-3">Purpose</th><th className="px-5 py-3">Destination</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Entry</th><th className="px-5 py-3">Exit</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-700/50">{filtered.map((log) => <tr key={log.id} className="hover:bg-slate-700/30"><td data-label="Visitor" className="px-5 py-3"><div className="font-medium text-slate-200">{log.visitorName}</div><div className="text-slate-500">{log.contactNumber}{log.vehiclePlate ? ` · ${log.vehiclePlate}` : ''}</div></td><td data-label="Purpose" className="px-5 py-3 text-slate-400">{log.purpose}</td><td data-label="Destination" className="px-5 py-3 text-slate-400">{log.destinationAddress}</td><td data-label="Source" className="px-5 py-3"><span className="rounded-full bg-slate-700 px-2 py-1 text-[10px] text-slate-300">{log.entrySource === 'resident_pass' ? 'Resident pass' : 'Gate entry'}</span></td><td data-label="Entry" className="px-5 py-3 text-slate-400">{log.entryTimeDisplay || log.entryTime}</td><td data-label="Exit" className="px-5 py-3 text-slate-500">{log.exitTimeDisplay || '—'}</td><td data-label="Status" className="px-5 py-3">{log.exitTime ? <span className="text-slate-400">Exited</span> : <span className="font-semibold text-emerald-300">On-site</span>}</td><td data-label="Action" className="px-5 py-3">{!log.exitTime && <button type="button" disabled={busy === log.id} onClick={() => setCheckingOut(log)} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"><LogOut className="h-3 w-3" /> Quick Checkout</button>}</td></tr>)}{filtered.length === 0 && <tr><td colSpan="8"><EmptyState icon={UsersRound} title="No visitor entries" description="No visitor activity matches this date and search." /></td></tr>}</tbody></table></div>
    </div>
    <ConfirmDialog open={Boolean(checkingOut)} title="Check this visitor out?" description={checkingOut ? `${checkingOut.visitorName} will be marked as having left the community.` : ''} impact="The checkout time is recorded immediately in the daily visitor report." confirmLabel="Record Checkout" tone="warning" busy={Boolean(checkingOut && busy === checkingOut.id)} onCancel={() => setCheckingOut(null)} onConfirm={() => checkout(checkingOut.id)} />
  </div>;
};

export const VisitorManagement = () => {
  const { currentUser } = useApp();
  return currentUser?.role === 'resident' ? <ResidentPasses /> : <GateVisitorManagement />;
};
