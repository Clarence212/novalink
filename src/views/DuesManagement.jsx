import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Bell, CalendarPlus, CheckCircle, CircleDollarSign, Download,
  FileText, QrCode, RefreshCw, Settings, Upload, WalletCards, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/ui/Primitives';

const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const badgeStyles = {
  paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  validated: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  unpaid: 'bg-red-500/15 text-red-300 border-red-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  partial: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  waived: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};
const StatusBadge = ({ value }) => <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${badgeStyles[value] || badgeStyles.waived}`}>{value}</span>;
const Field = ({ label, children }) => <label className="block space-y-1"><span className="text-xs font-medium text-slate-400">{label}</span>{children}</label>;
const inputClass = 'w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-700 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50';

export const DuesManagement = () => {
  const {
    currentUser, currentHomeowner, dues, payments, homeowners, paymentQRCode, duesSettings,
    validatePayment, rejectPayment, reconcilePaymentCredits, submitPaymentProof,
    sendDuesReminder, generateDues, configureDues, updatePaymentQr,
  } = useApp();
  const isAdmin = currentUser?.role === 'admin';
  const [showPayForm, setShowPayForm] = useState(false);
  const [resubmitting, setResubmitting] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', reference: '', proofFile: null });
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showManualDues, setShowManualDues] = useState(false);
  const [showQrSettings, setShowQrSettings] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const [duesForm, setDuesForm] = useState({ month, dueDate: `${month}-15`, amount: 1500, homeownerId: '' });
  const [settingsForm, setSettingsForm] = useState({ monthlyDueAmount: 1500, monthlyDueDay: 15, monthlyPenaltyAmount: 200, restrictAfterUnpaidMonths: 2 });
  const [qrForm, setQrForm] = useState({ provider: '', accountName: '', accountNumber: '', image: null });

  useEffect(() => {
    setSettingsForm({
      monthlyDueAmount: duesSettings?.monthlyDueAmount ?? 1500,
      monthlyDueDay: duesSettings?.monthlyDueDay ?? 15,
      monthlyPenaltyAmount: duesSettings?.monthlyPenaltyAmount ?? 200,
      restrictAfterUnpaidMonths: duesSettings?.restrictAfterUnpaidMonths ?? 2,
    });
    setDuesForm((previous) => ({ ...previous, amount: duesSettings?.monthlyDueAmount ?? previous.amount }));
  }, [duesSettings]);

  useEffect(() => {
    setQrForm({ provider: paymentQRCode?.provider || 'GCash', accountName: paymentQRCode?.gcashName || '', accountNumber: paymentQRCode?.gcashNumber || '', image: null });
  }, [paymentQRCode]);

  const myDues = isAdmin ? dues : dues.filter((due) => due.homeownerId === currentHomeowner?.id);
  const myPayments = isAdmin ? payments : payments.filter((payment) => payment.homeownerId === currentHomeowner?.id);
  const pendingPayments = payments.filter((payment) => payment.validationStatus === 'pending');
  const dashboard = useMemo(() => {
    const outstanding = myDues.reduce((sum, due) => sum + Number(due.balanceDue || 0), 0);
    const pendingAmount = pendingPayments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0);
    const unallocated = myPayments.filter((payment) => payment.validationStatus === 'validated').reduce((sum, payment) => sum + Number(payment.unallocatedAmount || 0), 0);
    const rejected = myPayments.filter((payment) => payment.validationStatus === 'rejected').length;
    const aging = ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'].reduce((result, bucket) => ({ ...result, [bucket]: myDues.filter((due) => due.balanceDue > 0 && due.agingBucket === bucket).reduce((sum, due) => sum + Number(due.balanceDue || 0), 0) }), {});
    return { outstanding, pendingAmount, unallocated, rejected, aging };
  }, [myDues, myPayments, pendingPayments]);

  const projectedAllocation = (payment) => {
    let remaining = Number(payment.amountPaid || 0);
    const allocations = dues
      .filter((due) => due.homeownerId === payment.homeownerId && Number(due.balanceDue) > 0)
      .sort((left, right) => String(left.billingMonthDate).localeCompare(String(right.billingMonthDate)))
      .map((due) => {
        const applied = Math.min(remaining, Number(due.balanceDue || 0));
        remaining = Math.max(0, remaining - applied);
        return applied > 0 ? { month: due.billingMonth, amount: applied } : null;
      }).filter(Boolean);
    return { allocations, remaining };
  };

  const openPaymentForm = (payment = null) => {
    setResubmitting(payment);
    setPayForm({ amount: payment?.amountPaid || '', reference: payment?.paymentReference || '', proofFile: null });
    setShowPayForm(true);
  };
  const handlePaymentSubmit = async (event) => {
    event.preventDefault();
    setBusyId('payment-form');
    const result = await submitPaymentProof(currentHomeowner?.id, { ...payForm, amount: Number(payForm.amount), paymentId: resubmitting?.id || null });
    setBusyId('');
    if (result.success) {
      setShowPayForm(false);
      setResubmitting(null);
      setPayForm({ amount: '', reference: '', proofFile: null });
    }
  };
  const handleValidate = async (paymentId) => { setBusyId(paymentId); await validatePayment(paymentId); setBusyId(''); };
  const handleReject = async (event) => {
    event.preventDefault();
    if (!rejecting) return;
    setBusyId(rejecting.id);
    const result = await rejectPayment(rejecting.id, rejectReason);
    setBusyId('');
    if (result.success) { setRejecting(null); setRejectReason(''); }
  };
  const handleGenerateDues = async (event) => {
    event.preventDefault();
    setBusyId('manual-dues');
    const result = await generateDues({ ...duesForm, amount: Number(duesForm.amount), homeownerId: duesForm.homeownerId || null });
    setBusyId('');
    if (result.success) setShowManualDues(false);
  };
  const handleConfigureDues = async (event) => {
    event.preventDefault();
    setBusyId('dues-settings');
    const result = await configureDues({
      monthlyDueAmount: Number(settingsForm.monthlyDueAmount), monthlyDueDay: Number(settingsForm.monthlyDueDay),
      monthlyPenaltyAmount: Number(settingsForm.monthlyPenaltyAmount), restrictAfterUnpaidMonths: Number(settingsForm.restrictAfterUnpaidMonths),
    });
    setBusyId('');
    if (result.success) setShowSettings(false);
  };
  const handleQrUpdate = async (event) => {
    event.preventDefault(); setBusyId('qr-settings');
    const result = await updatePaymentQr(qrForm); setBusyId('');
    if (result.success) setShowQrSettings(false);
  };
  const handleReconcile = async () => { setBusyId('reconcile'); await reconcilePaymentCredits(); setBusyId(''); };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader eyebrow="Finance" title={isAdmin ? 'Dues & Payment Reconciliation' : 'Dues & Payments'} description={isAdmin ? 'Generate monthly dues, validate proofs, allocate partial payments, and reconcile credits.' : 'Review balances, submit proofs, and download validated receipts.'} actions={<div className="flex flex-wrap gap-2">
          <a href="/backend/api/payments_export.php" className={secondaryButton}><Download className="h-4 w-4" /> Export CSV</a>
          {isAdmin ? <><button type="button" onClick={() => setShowSettings((value) => !value)} className={secondaryButton}><Settings className="h-4 w-4" /> Automation</button><button type="button" onClick={() => setShowManualDues((value) => !value)} className={secondaryButton}><CalendarPlus className="h-4 w-4" /> Generate</button><button type="button" onClick={() => setShowQrSettings((value) => !value)} className={secondaryButton}><QrCode className="h-4 w-4" /> Payment QR</button></> : <button type="button" onClick={() => openPaymentForm()} className={primaryButton}><Upload className="h-4 w-4" /> Upload Payment</button>}
        </div>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Outstanding balance', value: money(dashboard.outstanding), icon: CircleDollarSign, color: 'text-red-300' },
          { label: isAdmin ? 'Pending validation' : 'My pending payments', value: isAdmin ? money(dashboard.pendingAmount) : myPayments.filter((p) => p.validationStatus === 'pending').length, icon: AlertTriangle, color: 'text-amber-300' },
          { label: 'Unallocated credit', value: money(dashboard.unallocated), icon: WalletCards, color: 'text-blue-300' },
          { label: 'Rejected submissions', value: dashboard.rejected, icon: X, color: 'text-slate-300' },
        ].map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-slate-700 bg-slate-800 p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><Icon className={`h-4 w-4 ${color}`} />{label}</div><div className={`mt-2 text-xl font-bold ${color}`}>{value}</div></div>)}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-200">Outstanding balance aging</h3><p className="mt-1 text-[11px] text-slate-500">Balances include dues, penalties, and validated partial allocations.</p></div>{isAdmin && dashboard.unallocated > 0 && <button type="button" disabled={busyId === 'reconcile'} onClick={handleReconcile} className={primaryButton}><RefreshCw className={`h-4 w-4 ${busyId === 'reconcile' ? 'animate-spin' : ''}`} /> Apply Credits</button>}</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Object.entries(dashboard.aging).map(([bucket, amount]) => <div key={bucket} className="rounded-xl bg-slate-900/60 p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">{bucket}</div><div className="mt-1 text-sm font-bold text-slate-200">{money(amount)}</div></div>)}</div>
      </div>

      {isAdmin && showSettings && <form onSubmit={handleConfigureDues} className="rounded-2xl border border-blue-700/50 bg-blue-950/20 p-5">
        <div className="mb-4"><h3 className="text-sm font-bold text-blue-200">Automatic monthly dues</h3><p className="mt-1 text-[11px] text-slate-400">NovaLink creates one current-month record per active homeowner. Repeated runs do not duplicate records.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Monthly amount"><input className={inputClass} type="number" min="0.01" step="0.01" required value={settingsForm.monthlyDueAmount} onChange={(e) => setSettingsForm({ ...settingsForm, monthlyDueAmount: e.target.value })} /></Field>
          <Field label="Due day (1-31)"><input className={inputClass} type="number" min="1" max="31" required value={settingsForm.monthlyDueDay} onChange={(e) => setSettingsForm({ ...settingsForm, monthlyDueDay: e.target.value })} /></Field>
          <Field label="Monthly overdue penalty"><input className={inputClass} type="number" min="0" step="0.01" required value={settingsForm.monthlyPenaltyAmount} onChange={(e) => setSettingsForm({ ...settingsForm, monthlyPenaltyAmount: e.target.value })} /></Field>
          <Field label="Restrict after unpaid months"><input className={inputClass} type="number" min="1" max="24" required value={settingsForm.restrictAfterUnpaidMonths} onChange={(e) => setSettingsForm({ ...settingsForm, restrictAfterUnpaidMonths: e.target.value })} /></Field>
        </div><div className="mt-4 flex gap-2"><button disabled={busyId === 'dues-settings'} className={primaryButton}>Save Automation</button><button type="button" onClick={() => setShowSettings(false)} className={secondaryButton}>Cancel</button></div>
      </form>}

      {isAdmin && showManualDues && <form onSubmit={handleGenerateDues} className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
        <h3 className="mb-4 text-sm font-bold text-slate-200">Manual dues generation</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Billing month"><input className={inputClass} type="month" required value={duesForm.month} onChange={(e) => setDuesForm({ ...duesForm, month: e.target.value })} /></Field>
          <Field label="Due date"><input className={inputClass} type="date" required value={duesForm.dueDate} onChange={(e) => setDuesForm({ ...duesForm, dueDate: e.target.value })} /></Field>
          <Field label="Amount"><input className={inputClass} type="number" min="0.01" step="0.01" required value={duesForm.amount} onChange={(e) => setDuesForm({ ...duesForm, amount: e.target.value })} /></Field>
          <Field label="Homeowner (optional)"><select className={inputClass} value={duesForm.homeownerId} onChange={(e) => setDuesForm({ ...duesForm, homeownerId: e.target.value })}><option value="">All active homeowners</option>{homeowners.map((homeowner) => <option key={homeowner.id} value={homeowner.id}>{homeowner.ownerName} — {homeowner.blockLot}</option>)}</select></Field>
        </div><div className="mt-4 flex gap-2"><button disabled={busyId === 'manual-dues'} className={primaryButton}>Generate Dues</button><button type="button" onClick={() => setShowManualDues(false)} className={secondaryButton}>Cancel</button></div>
      </form>}

      {isAdmin && showQrSettings && <form onSubmit={handleQrUpdate} className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
        <h3 className="mb-4 text-sm font-bold text-slate-200">Payment QR settings</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Provider"><input className={inputClass} required value={qrForm.provider} onChange={(e) => setQrForm({ ...qrForm, provider: e.target.value })} /></Field>
          <Field label="Account name"><input className={inputClass} required value={qrForm.accountName} onChange={(e) => setQrForm({ ...qrForm, accountName: e.target.value })} /></Field>
          <Field label="Account number"><input className={inputClass} required value={qrForm.accountNumber} onChange={(e) => setQrForm({ ...qrForm, accountNumber: e.target.value })} /></Field>
          <Field label="New QR image (optional)"><input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setQrForm({ ...qrForm, image: e.target.files?.[0] || null })} /></Field>
        </div><div className="mt-4 flex gap-2"><button disabled={busyId === 'qr-settings'} className={primaryButton}>Save QR</button><button type="button" onClick={() => setShowQrSettings(false)} className={secondaryButton}>Cancel</button></div>
      </form>}

      {!isAdmin && <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 text-center"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">{paymentQRCode?.provider || 'Payment account'}</div>{paymentQRCode?.imagePath ? <img src={paymentQRCode.imagePath} alt="Payment QR code" className="mx-auto mt-3 h-48 w-48 rounded-xl bg-white object-contain p-2" /> : <div className="mx-auto mt-3 flex h-48 w-48 items-center justify-center rounded-xl border border-dashed border-slate-600 text-xs text-slate-500">QR not configured</div>}<div className="mt-3 text-sm font-semibold text-slate-200">{paymentQRCode?.gcashName}</div><div className="text-xs text-slate-400">{paymentQRCode?.gcashNumber}</div></div>
        {showPayForm ? <form onSubmit={handlePaymentSubmit} className="rounded-2xl border border-blue-700/50 bg-blue-950/20 p-5">
          <h3 className="text-sm font-bold text-blue-200">{resubmitting ? 'Correct and resubmit payment' : 'Submit payment proof'}</h3>{resubmitting?.rejectionReason && <div className="mt-3 rounded-xl border border-red-800/60 bg-red-950/30 p-3 text-xs text-red-200"><strong>Previous rejection:</strong> {resubmitting.rejectionReason}</div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Amount paid"><input className={inputClass} type="number" min="0.01" max="1000000" step="0.01" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field><Field label="Payment reference"><input className={inputClass} maxLength="120" required value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></Field><div className="sm:col-span-2"><Field label="Proof image (JPEG, PNG, or WebP; max 5 MB)"><input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => setPayForm({ ...payForm, proofFile: e.target.files?.[0] || null })} /></Field></div></div>
          <div className="mt-4 flex gap-2"><button disabled={busyId === 'payment-form'} className={primaryButton}>{resubmitting ? 'Resubmit for Validation' : 'Submit for Validation'}</button><button type="button" onClick={() => { setShowPayForm(false); setResubmitting(null); }} className={secondaryButton}>Cancel</button></div>
        </form> : <div className="flex flex-col items-start justify-center rounded-2xl border border-slate-700 bg-slate-800 p-6"><h3 className="text-base font-bold text-slate-200">Submit a payment securely</h3><p className="mt-2 max-w-xl text-xs leading-5 text-slate-400">Upload the proof and reference after payment. Validation allocates it to your oldest balance first, and partial payments are supported.</p><button type="button" onClick={() => openPaymentForm()} className={`${primaryButton} mt-4`}><Upload className="h-4 w-4" /> Upload Payment Proof</button></div>}
      </div>}

      {isAdmin && <div className="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-bold text-amber-300"><AlertTriangle className="h-4 w-4" /> Pending validations ({pendingPayments.length})</h3><p className="mt-1 text-[11px] text-slate-500">Validation allocates the payment to the oldest outstanding dues first.</p></div><button type="button" onClick={() => sendDuesReminder()} className={secondaryButton}><Bell className="h-4 w-4" /> Send All Reminders</button></div>
        <div className="space-y-3">{pendingPayments.map((payment) => {
          const homeowner = homeowners.find((item) => item.id === payment.homeownerId);
          const projection = projectedAllocation(payment);
          return <div key={payment.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="text-sm font-semibold text-slate-200">{homeowner?.ownerName || payment.homeownerName}</div><div className="mt-1 text-xs text-slate-400">{money(payment.amountPaid)} · Ref: {payment.paymentReference} · {payment.paymentDate}</div><div className="mt-2 text-[11px] text-slate-500">Projected: {projection.allocations.length ? projection.allocations.map((item) => `${item.month} ${money(item.amount)}`).join(' · ') : 'homeowner credit'}{projection.remaining > 0 ? ` · Credit ${money(projection.remaining)}` : ''}</div></div><div className="flex flex-wrap gap-2"><a href={payment.proofImage} target="_blank" rel="noreferrer" className={secondaryButton}><FileText className="h-4 w-4" /> Proof</a><button type="button" disabled={busyId === payment.id} onClick={() => handleValidate(payment.id)} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle className="h-4 w-4" /> Validate</button><button type="button" disabled={busyId === payment.id} onClick={() => { setRejecting(payment); setRejectReason(''); }} className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"><X className="h-4 w-4" /> Reject</button></div></div></div>;
        })}{pendingPayments.length === 0 && <div className="py-6 text-center text-xs text-slate-500">No payment proofs are awaiting validation.</div>}</div>
      </div>}

      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800"><div className="border-b border-slate-700 px-5 py-3"><h3 className="text-sm font-bold text-slate-200">Billing records</h3></div><div className="overflow-x-auto"><table data-responsive-table="true" className="w-full min-w-[900px] text-xs"><thead><tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wider text-slate-500">{isAdmin && <th className="px-5 py-3">Homeowner</th>}<th className="px-5 py-3">Month</th><th className="px-5 py-3">Assessment</th><th className="px-5 py-3">Applied</th><th className="px-5 py-3">Balance</th><th className="px-5 py-3">Due date</th><th className="px-5 py-3">Aging</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-700/50">{myDues.map((due) => <tr key={due.id} className="hover:bg-slate-700/30">{isAdmin && <td data-label="Homeowner" className="px-5 py-3 font-medium text-slate-300">{homeowners.find((item) => item.id === due.homeownerId)?.ownerName}</td>}<td data-label="Month" className="px-5 py-3 text-slate-300">{due.billingMonth}</td><td data-label="Assessment" className="px-5 py-3 text-slate-300">{money(Number(due.amountDue) + Number(due.penaltyAmount))}</td><td data-label="Applied" className="px-5 py-3 text-blue-300">{money(due.amountApplied)}</td><td data-label="Balance" className="px-5 py-3 font-semibold text-slate-200">{money(due.balanceDue)}</td><td data-label="Due date" className="px-5 py-3 text-slate-400">{due.dueDate}</td><td data-label="Aging" className="px-5 py-3 text-slate-400">{due.balanceDue > 0 ? due.agingBucket : '—'}</td><td data-label="Status" className="px-5 py-3"><StatusBadge value={due.displayStatus || due.status} /></td></tr>)}{myDues.length === 0 && <tr><td colSpan={isAdmin ? 8 : 7} className="py-10 text-center text-slate-500">No dues records found.</td></tr>}</tbody></table></div></div>

      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800"><div className="flex items-center justify-between border-b border-slate-700 px-5 py-3"><h3 className="text-sm font-bold text-slate-200">Payment history</h3><span className="text-[11px] text-slate-500">{myPayments.length} submission(s)</span></div><div className="overflow-x-auto"><table data-responsive-table="true" className="w-full min-w-[950px] text-xs"><thead><tr className="border-b border-slate-700 text-left text-[10px] uppercase tracking-wider text-slate-500">{isAdmin && <th className="px-5 py-3">Homeowner</th>}<th className="px-5 py-3">Amount</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Allocation</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Status / reason</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-700/50">{myPayments.map((payment) => <tr key={payment.id} className="align-top hover:bg-slate-700/30">{isAdmin && <td data-label="Homeowner" className="px-5 py-3 font-medium text-slate-300">{payment.homeownerName || homeowners.find((item) => item.id === payment.homeownerId)?.ownerName}</td>}<td data-label="Amount" className="px-5 py-3 font-mono text-slate-300">{money(payment.amountPaid)}</td><td data-label="Reference" className="px-5 py-3 font-mono text-[10px] text-slate-400">{payment.paymentReference}</td><td data-label="Allocation" className="px-5 py-3 text-[11px] text-slate-400">{payment.allocations?.length ? payment.allocations.map((allocation) => <div key={allocation.duesId}>{allocation.billingMonth}: {money(allocation.amountApplied)}</div>) : 'No allocation'}{payment.unallocatedAmount > 0 && <div className="mt-1 text-blue-300">Credit: {money(payment.unallocatedAmount)}</div>}</td><td data-label="Date" className="px-5 py-3 text-slate-400">{payment.paymentDate}{payment.resubmissionCount > 0 && <div className="mt-1 text-[10px] text-blue-300">Resubmitted {payment.resubmissionCount}×</div>}</td><td data-label="Status / reason" className="px-5 py-3"><StatusBadge value={payment.validationStatus} />{payment.rejectionReason && <div className="mt-2 max-w-xs text-[11px] leading-4 text-red-300">{payment.rejectionReason}</div>}</td><td data-label="Actions" className="px-5 py-3"><div className="flex flex-wrap justify-end gap-2 md:justify-start"><a href={payment.proofImage} target="_blank" rel="noreferrer" className={secondaryButton}>Proof</a>{payment.validationStatus === 'validated' && <a href={payment.receiptUrl} className={secondaryButton}><Download className="h-3 w-3" /> Receipt</a>}{!isAdmin && payment.validationStatus === 'rejected' && <button type="button" onClick={() => openPaymentForm(payment)} className={primaryButton}><RefreshCw className="h-3 w-3" /> Resubmit</button>}</div></td></tr>)}{myPayments.length === 0 && <tr><td colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-slate-500">No payment submissions yet.</td></tr>}</tbody></table></div></div>

      {rejecting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="reject-payment-title"><form onSubmit={handleReject} className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl"><h3 id="reject-payment-title" className="text-base font-bold text-slate-100">Reject payment proof</h3><p className="mt-2 text-xs text-slate-400">Give the resident a clear correction. The reason appears in their history and rejection email.</p><textarea autoFocus required maxLength="500" rows="4" className={`${inputClass} mt-4 resize-none`} placeholder="Example: The reference number is unreadable. Upload a clearer screenshot showing the amount and transaction reference." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setRejecting(null)} className={secondaryButton}>Cancel</button><button disabled={busyId === rejecting.id} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"><X className="h-4 w-4" /> Reject & Notify</button></div></form></div>}
    </div>
  );
};
