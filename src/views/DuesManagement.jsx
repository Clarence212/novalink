import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CreditCard, Upload, CheckCircle, X, AlertTriangle, QrCode } from 'lucide-react';

const statusBadge = (s) => {
  const m = { paid: 'bg-emerald-900/60 text-emerald-400', unpaid: 'bg-red-900/60 text-red-400', pending: 'bg-amber-900/60 text-amber-400', validated: 'bg-emerald-900/60 text-emerald-400', rejected: 'bg-red-900/60 text-red-400' };
  return <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${m[s] || 'bg-slate-700 text-slate-400'}`}>{s}</span>;
};

export const DuesManagement = () => {
  const { currentUser, currentHomeowner, dues, payments, homeowners, validatePayment, rejectPayment, submitPaymentProof, paymentQRCode, sendDuesReminder, generateDues, updatePaymentQr } = useApp();
  const isAdmin = currentUser?.role === 'admin';

  const [showPayForm, setShowPayForm] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [showQrForm, setShowQrForm] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', reference: '', proofFile: null });
  const [duesForm, setDuesForm] = useState({ month: new Date().toISOString().slice(0, 7), amount: '1500', dueDate: '' });
  const [qrForm, setQrForm] = useState({ provider: 'GCash', accountName: '', accountNumber: '', image: null });
  const [selectedPayment, setSelectedPayment] = useState(null);

  const myDues = isAdmin ? dues : dues.filter(d => d.homeownerId === currentHomeowner?.id);
  const myPayments = isAdmin ? payments : payments.filter(p => p.homeownerId === currentHomeowner?.id);
  const pendingPayments = payments.filter(p => p.validationStatus === 'pending');

  const totalBalance = myDues.filter(d => d.status === 'unpaid').reduce((sum, d) => sum + (d.balanceDue ?? d.amountDue + d.penaltyAmount), 0);

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    const result = await submitPaymentProof(currentHomeowner?.id, {
      amount: Number(payForm.amount),
      reference: payForm.reference,
      proofFile: payForm.proofFile,
    });
    if (result.success) {
      setPayForm({ amount: '', reference: '', proofFile: null });
      setShowPayForm(false);
    }
  };

  const handleValidate = async (paymentId) => {
    const result = await validatePayment(paymentId);
    if (result.success) setSelectedPayment(null);
  };

  const handleGenerateDues = async (event) => {
    event.preventDefault();
    const result = await generateDues({ ...duesForm, amount: Number(duesForm.amount) });
    if (result.success) setShowGenerateForm(false);
  };

  const openQrSettings = () => {
    setQrForm({
      provider: paymentQRCode.provider || 'GCash',
      accountName: paymentQRCode.gcashName === 'Not configured' ? '' : paymentQRCode.gcashName,
      accountNumber: paymentQRCode.gcashNumber || '',
      image: null,
    });
    setShowQrForm(true);
  };

  const handleUpdateQr = async (event) => {
    event.preventDefault();
    const result = await updatePaymentQr(qrForm);
    if (result.success) setShowQrForm(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{isAdmin ? 'Dues Management' : 'Dues & Payments'}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{isAdmin ? 'Validate submitted proofs of payment and monitor dues records' : 'View your dues status and submit payment proof'}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={openQrSettings}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition"
            >
              Payment QR Settings
            </button>
            <button
              onClick={() => setShowGenerateForm(!showGenerateForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
            >
              Generate Monthly Dues
            </button>
            <button
              onClick={() => sendDuesReminder()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition"
            >
              Send Reminders to All Overdue
            </button>
          </div>
        )}
        {!isAdmin && (
          <button
            onClick={() => setShowPayForm(!showPayForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
          >
            <Upload className="w-4 h-4" /> Upload Payment Proof
          </button>
        )}
      </div>

      {isAdmin && showGenerateForm && (
        <form onSubmit={handleGenerateDues} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <label>
            <span className="block text-xs font-medium text-slate-400 mb-1">Billing Month</span>
            <input type="month" required value={duesForm.month} onChange={event => setDuesForm({ ...duesForm, month: event.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200" />
          </label>
          <label>
            <span className="block text-xs font-medium text-slate-400 mb-1">Amount (₱)</span>
            <input type="number" required min="0.01" step="0.01" value={duesForm.amount} onChange={event => setDuesForm({ ...duesForm, amount: event.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200" />
          </label>
          <label>
            <span className="block text-xs font-medium text-slate-400 mb-1">Due Date</span>
            <input type="date" required value={duesForm.dueDate} onChange={event => setDuesForm({ ...duesForm, dueDate: event.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200" />
          </label>
          <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">Create Missing Records</button>
          <p className="sm:col-span-4 text-[10px] text-slate-500">Existing records for that month are left unchanged.</p>
        </form>
      )}

      {isAdmin && showQrForm && (
        <form onSubmit={handleUpdateQr} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label>
            <span className="block text-xs font-medium text-slate-400 mb-1">Provider</span>
            <input type="text" required value={qrForm.provider} onChange={event => setQrForm({ ...qrForm, provider: event.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200" />
          </label>
          <label>
            <span className="block text-xs font-medium text-slate-400 mb-1">Account Name</span>
            <input type="text" required value={qrForm.accountName} onChange={event => setQrForm({ ...qrForm, accountName: event.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200" />
          </label>
          <label>
            <span className="block text-xs font-medium text-slate-400 mb-1">Account Number</span>
            <input type="text" required value={qrForm.accountNumber} onChange={event => setQrForm({ ...qrForm, accountNumber: event.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200" />
          </label>
          <label>
            <span className="block text-xs font-medium text-slate-400 mb-1">QR Image (optional replacement)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setQrForm({ ...qrForm, image: event.target.files?.[0] || null })}
              className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white bg-slate-700 border border-slate-600 rounded-xl p-1" />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">Save Payment Details</button>
            <button type="button" onClick={() => setShowQrForm(false)} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-semibold">Cancel</button>
          </div>
        </form>
      )}

      {}
      {!isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-5 rounded-2xl border ${totalBalance > 0 ? 'bg-red-950/30 border-red-800/50' : 'bg-emerald-950/30 border-emerald-800/50'}`}>
            <div className="text-xs font-medium text-slate-400">Outstanding Balance</div>
            <div className={`text-3xl font-bold mt-1 ${totalBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {totalBalance > 0 ? `₱${totalBalance.toLocaleString()}` : 'All Paid ✓'}
            </div>
            {totalBalance > 0 && <div className="text-[11px] text-red-400/70 mt-1">Includes accumulated penalties</div>}
          </div>
          <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center gap-2">
            {paymentQRCode.imagePath
              ? <img src={paymentQRCode.imagePath} alt={`${paymentQRCode.provider} payment QR code`} className="w-32 h-32 object-contain rounded-lg bg-white p-1" />
              : <QrCode className="w-10 h-10 text-blue-400" />}
            <div className="text-xs font-bold text-slate-200">{paymentQRCode.gcashName}</div>
            <div className="text-xs text-blue-400 font-mono">{paymentQRCode.gcashNumber}</div>
            <div className="text-[10px] text-slate-500">Scan QR Code to pay via GCash</div>
          </div>
        </div>
      )}

      {}
      {!isAdmin && showPayForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200">Submit Payment Proof</h3>
            <button onClick={() => setShowPayForm(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmitProof} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Amount Paid (₱)</label>
              <input type="number" required min="0.01" step="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                placeholder="e.g. 1500" className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">GCash/Payment Reference Number</label>
              <input type="text" required value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })}
                placeholder="e.g. GCash-TXN-20260821-0001" className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Proof of Payment Screenshot / Receipt</label>
              <input
                type="file"
                required
                accept="image/*"
                onChange={e => {
                  setPayForm({ ...payForm, proofFile: e.target.files?.[0] || null });
                }}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer bg-slate-700 p-1 border border-slate-600 rounded-xl"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">Submit for Validation</button>
              <button type="button" onClick={() => setShowPayForm(false)} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-medium transition">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {}
      {isAdmin && pendingPayments.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Pending Payment Validations ({pendingPayments.length})
          </h3>
          <div className="space-y-3">
            {pendingPayments.map(p => {
              const homeowner = homeowners.find(h => h.id === p.homeownerId);
              return (
                <div key={p.id} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-800 border border-slate-700">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{homeowner?.ownerName}</div>
                    <div className="text-[11px] text-slate-400">₱{p.amountPaid?.toLocaleString()} · Ref: {p.paymentReference}</div>
                    <div className="text-[10px] text-slate-500">{p.paymentDate}</div>
                  </div>
                  <div className="flex gap-2">
                    <a href={p.proofImage} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition">
                      View Proof
                    </a>
                    <button onClick={() => handleValidate(p.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Validate
                    </button>
                    <button onClick={() => rejectPayment(p.id)} className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-700 text-white text-xs font-bold transition flex items-center gap-1">
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700">
          <h3 className="text-sm font-bold text-slate-200">Billing Records</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
              {isAdmin && <th className="px-5 py-3">Homeowner</th>}
              <th className="px-5 py-3">Billing Month</th>
              <th className="px-5 py-3">Amount Due</th>
              <th className="px-5 py-3">Penalty</th>
              <th className="px-5 py-3">Due Date</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {myDues.map(d => {
              const homeowner = isAdmin ? homeowners.find(h => h.id === d.homeownerId) : null;
              return (
                <tr key={d.id} className="hover:bg-slate-700/30 transition">
                  {isAdmin && <td className="px-5 py-3 text-slate-300 font-medium">{homeowner?.ownerName}</td>}
                  <td className="px-5 py-3 text-slate-300">{d.billingMonth}</td>
                  <td className="px-5 py-3 text-slate-300">₱{d.amountDue.toLocaleString()}</td>
                  <td className="px-5 py-3 text-red-400">{d.penaltyAmount > 0 ? `₱${d.penaltyAmount}` : '—'}</td>
                  <td className="px-5 py-3 text-slate-400">{d.dueDate}</td>
                  <td className="px-5 py-3">{statusBadge(d.status)}</td>
                </tr>
              );
            })}
            {myDues.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="text-center py-10 text-slate-500">No dues records found.</td></tr>}
          </tbody>
        </table>
      </div>

      {}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700">
          <h3 className="text-sm font-bold text-slate-200">Payment Submission History</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
              {isAdmin && <th className="px-5 py-3">Homeowner</th>}
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {myPayments.map(p => {
              const homeowner = isAdmin ? homeowners.find(h => h.id === p.homeownerId) : null;
              return (
                <tr key={p.id} className="hover:bg-slate-700/30 transition">
                  {isAdmin && <td className="px-5 py-3 text-slate-300 font-medium">{homeowner?.ownerName}</td>}
                  <td className="px-5 py-3 text-slate-300 font-mono">₱{p.amountPaid?.toLocaleString()}</td>
                  <td className="px-5 py-3 text-slate-400 font-mono text-[10px]">{p.paymentReference}</td>
                  <td className="px-5 py-3 text-slate-400">{p.paymentDate}</td>
                  <td className="px-5 py-3">{statusBadge(p.validationStatus)}</td>
                </tr>
              );
            })}
            {myPayments.length === 0 && <tr><td colSpan={isAdmin ? 5 : 4} className="text-center py-10 text-slate-500">No payment submissions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
