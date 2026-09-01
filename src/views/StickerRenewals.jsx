import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ClipboardList, CheckCircle, XCircle, Plus } from 'lucide-react';
import { ConfirmDialog, EmptyState, PageHeader } from '../components/ui/Primitives';

const statusBadge = (s) => {
  const m = { pending: 'bg-amber-900/60 text-amber-400', approved: 'bg-emerald-900/60 text-emerald-400', rejected: 'bg-red-900/60 text-red-400' };
  return <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${m[s] || 'bg-slate-700 text-slate-400'}`}>{s}</span>;
};

export const StickerRenewals = () => {
  const { currentUser, currentHomeowner, vehicles, stickerRenewals, homeowners, stickerRenewalPeriod, submitStickerRenewal, reviewStickerRenewal, setStickerRenewalPeriod, showToast } = useApp();
  const isAdmin = currentUser?.role === 'admin';
  const [periodInput, setPeriodInput] = useState(stickerRenewalPeriod || '');
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);

  const myVehicles = vehicles.filter(v => v.homeownerId === currentHomeowner?.id && v.approvalStatus === 'approved');
  const myRenewals = isAdmin ? stickerRenewals : stickerRenewals.filter(r => r.homeownerId === currentHomeowner?.id);

  const handleRequest = async (vehicleId) => {
    const existing = stickerRenewals.find(r => r.vehicleId === vehicleId && r.renewalPeriod === stickerRenewalPeriod && r.status === 'pending');
    if (existing) { showToast('A renewal request is already pending for this vehicle.', 'warning'); return; }
    await submitStickerRenewal(vehicleId);
  };

  const confirmReview = async () => {
    if (!confirmation) return;
    setBusy(true);
    await reviewStickerRenewal(confirmation.renewal.id, confirmation.status);
    setBusy(false);
    setConfirmation(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader eyebrow="Vehicle access" title="HOA Vehicle Sticker Renewals" description={isAdmin ? 'Review and process vehicle-sticker renewal requests.' : 'Request sticker renewals for your approved registered vehicles.'} />

      {isAdmin && (
        <form onSubmit={async event => { event.preventDefault(); await setStickerRenewalPeriod(periodInput || stickerRenewalPeriod); }} className="flex items-end gap-3 bg-slate-800 border border-slate-700 rounded-2xl p-4">
          <label className="flex-1 max-w-xs">
            <span className="block text-xs font-medium text-slate-400 mb-1">Active Renewal Period</span>
            <input type="text" required pattern="\d{4}-\d{4}" placeholder="2026-2027" value={periodInput || stickerRenewalPeriod}
              onChange={event => setPeriodInput(event.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200" />
          </label>
          <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">Update Period</button>
        </form>
      )}

      {}
      {!isAdmin && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Your Eligible Vehicles</h3>
          {myVehicles.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-slate-400">
              No approved vehicles on record. Submit vehicle information first.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myVehicles.map(v => {
                const hasPendingRenewal = stickerRenewals.some(r => r.vehicleId === v.id && r.renewalPeriod === stickerRenewalPeriod && r.status === 'pending');
                const hasApproved = stickerRenewals.some(r => r.vehicleId === v.id && r.renewalPeriod === stickerRenewalPeriod && r.status === 'approved');
                return (
                  <div key={v.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-200">{v.makeModel}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{v.plateNumber} · {v.color} · {v.vehicleType}</div>
                      {hasApproved && <div className="text-[10px] text-emerald-400 mt-0.5">✓ Active sticker for {stickerRenewalPeriod}</div>}
                      {hasPendingRenewal && <div className="text-[10px] text-amber-400 mt-0.5">Renewal request pending...</div>}
                    </div>
                    {!hasPendingRenewal && !hasApproved && (
                      <button onClick={() => handleRequest(v.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold transition shrink-0">
                        <Plus className="w-3 h-3" /> Renew
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700">
          <h3 className="text-sm font-bold text-slate-200">{isAdmin ? 'All Renewal Requests' : 'My Renewal Requests'}</h3>
        </div>
        <table data-responsive-table="true" className="w-full min-w-[950px] text-xs">
          <thead>
            <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
              {isAdmin && <th className="px-5 py-3">Homeowner</th>}
              <th className="px-5 py-3">Vehicle</th>
              <th className="px-5 py-3">Plate</th>
              <th className="px-5 py-3">Period</th>
              <th className="px-5 py-3">Sticker No.</th>
              <th className="px-5 py-3">Requested</th>
              <th className="px-5 py-3">Status</th>
              {isAdmin && <th className="px-5 py-3">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {myRenewals.map(r => {
              const vehicle = vehicles.find(v => v.id === r.vehicleId);
              const homeowner = isAdmin ? homeowners.find(h => h.id === r.homeownerId) : null;
              return (
                <tr key={r.id} className="hover:bg-slate-700/30 transition">
                  {isAdmin && <td data-label="Homeowner" className="px-5 py-3 text-slate-300 font-medium">{homeowner?.ownerName}</td>}
                  <td data-label="Vehicle" className="px-5 py-3 text-slate-300">{vehicle?.makeModel}</td>
                  <td data-label="Plate" className="px-5 py-3 text-slate-200 font-mono">{vehicle?.plateNumber}</td>
                  <td data-label="Period" className="px-5 py-3 text-slate-400">{r.renewalPeriod}</td>
                  <td data-label="Sticker number" className="px-5 py-3 text-slate-400 font-mono text-[10px]">{r.stickerNumber || '—'}</td>
                  <td data-label="Requested" className="px-5 py-3 text-slate-400">{r.requestedAt}</td>
                  <td data-label="Status" className="px-5 py-3">{statusBadge(r.status)}</td>
                  {isAdmin && (
                    <td data-label="Action" className="px-5 py-3">
                      {r.status === 'pending' && (
                        <div className="flex justify-end gap-2 md:justify-start">
                          <button type="button" onClick={() => setConfirmation({ renewal: r, vehicle, status: 'approved' })} className="ui-button min-h-9 bg-emerald-600 px-3 text-white hover:bg-emerald-500">
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button type="button" onClick={() => setConfirmation({ renewal: r, vehicle, status: 'rejected' })} className="ui-button min-h-9 bg-red-600 px-3 text-white hover:bg-red-500">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {myRenewals.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 6}><EmptyState icon={ClipboardList} title="No sticker renewal requests" description="New requests for the active renewal period will appear here." /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={`${confirmation?.status === 'approved' ? 'Approve' : 'Reject'} this sticker request?`}
        description={confirmation ? `${confirmation.vehicle?.makeModel || 'Vehicle'} · ${confirmation.vehicle?.plateNumber || 'No plate'}` : ''}
        impact={confirmation?.status === 'approved' ? 'The renewal will be marked approved and become part of the resident record.' : 'The resident will need to submit another renewal request.'}
        confirmLabel={confirmation?.status === 'approved' ? 'Approve Renewal' : 'Reject Renewal'}
        tone={confirmation?.status === 'approved' ? 'warning' : 'danger'}
        busy={busy}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmReview}
      />
    </div>
  );
};
