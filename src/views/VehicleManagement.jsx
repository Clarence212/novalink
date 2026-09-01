import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, X, Car, CheckCircle, XCircle } from 'lucide-react';
import { ConfirmDialog, EmptyState, PageHeader } from '../components/ui/Primitives';

const statusBadge = (s) => {
  const m = { pending: 'bg-amber-900/60 text-amber-400', approved: 'bg-emerald-900/60 text-emerald-400', rejected: 'bg-red-900/60 text-red-400' };
  return <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${m[s] || 'bg-slate-700 text-slate-400'}`}>{s}</span>;
};

export const VehicleManagement = () => {
  const { currentUser, currentHomeowner, vehicles, homeowners, submitVehicle, reviewVehicle } = useApp();
  const isAdmin = currentUser?.role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleType: 'Sedan', makeModel: '', plateNumber: '', color: '' });
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);

  const myVehicles = isAdmin
    ? vehicles
    : vehicles.filter(v => v.homeownerId === currentHomeowner?.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await submitVehicle(form);
    if (result.success) {
      setForm({ vehicleType: 'Sedan', makeModel: '', plateNumber: '', color: '' });
      setShowForm(false);
    }
  };

  const vehicleTypes = ['Sedan', 'SUV', 'Pickup Truck', 'Van', 'Motorcycle', 'Other'];

  const confirmReview = async () => {
    if (!confirmation) return;
    setBusy(true);
    await reviewVehicle(confirmation.vehicle.id, confirmation.status);
    setBusy(false);
    setConfirmation(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Community records"
        title={isAdmin ? 'Vehicle Records' : 'My Vehicles'}
        description={isAdmin ? 'Review submitted vehicle information and approve it for master-record inclusion.' : 'Submit vehicle information for NHAI approval.'}
        actions={!isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        )}
      />

      {}
      {!isAdmin && showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200">Submit Vehicle Information</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Vehicle Type</label>
              <select value={form.vehicleType} onChange={e => setForm({ ...form, vehicleType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
                {vehicleTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Make / Model</label>
              <input type="text" required value={form.makeModel} onChange={e => setForm({ ...form, makeModel: e.target.value })}
                placeholder="e.g. Toyota Vios 2022" className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Plate Number</label>
              <input type="text" required value={form.plateNumber} onChange={e => setForm({ ...form, plateNumber: e.target.value })}
                placeholder="e.g. ABC 1234" className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Color</label>
              <input type="text" required value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                placeholder="e.g. White" className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="sm:col-span-2 flex gap-2 pt-1">
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">Submit for Review</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-medium transition">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700">
          <h3 className="text-sm font-bold text-slate-200">Vehicle Records</h3>
        </div>
        <table data-responsive-table="true" className="w-full min-w-[850px] text-xs">
          <thead>
            <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
              {isAdmin && <th className="px-5 py-3">Homeowner</th>}
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Make / Model</th>
              <th className="px-5 py-3">Plate Number</th>
              <th className="px-5 py-3">Color</th>
              <th className="px-5 py-3">Status</th>
              {isAdmin && <th className="px-5 py-3">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {myVehicles.map(v => {
              const homeowner = isAdmin ? homeowners.find(h => h.id === v.homeownerId) : null;
              return (
                <tr key={v.id} className="hover:bg-slate-700/30 transition">
                  {isAdmin && <td data-label="Homeowner" className="px-5 py-3 text-slate-300 font-medium">{homeowner?.ownerName}</td>}
                  <td data-label="Type" className="px-5 py-3 text-slate-400">{v.vehicleType}</td>
                  <td data-label="Make / model" className="px-5 py-3 text-slate-300 font-medium">{v.makeModel}</td>
                  <td data-label="Plate number" className="px-5 py-3 text-slate-200 font-mono">{v.plateNumber}</td>
                  <td data-label="Color" className="px-5 py-3 text-slate-400">{v.color}</td>
                  <td data-label="Status" className="px-5 py-3">{statusBadge(v.approvalStatus)}</td>
                  {isAdmin && (
                    <td data-label="Action" className="px-5 py-3">
                      {v.approvalStatus === 'pending' && (
                        <div className="flex justify-end gap-2 md:justify-start">
                          <button type="button" onClick={() => setConfirmation({ vehicle: v, status: 'approved' })} className="ui-button min-h-9 bg-emerald-600 px-3 text-white hover:bg-emerald-500" aria-label={`Approve ${v.makeModel} ${v.plateNumber}`}>
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button type="button" onClick={() => setConfirmation({ vehicle: v, status: 'rejected' })} className="ui-button min-h-9 bg-red-600 px-3 text-white hover:bg-red-500" aria-label={`Reject ${v.makeModel} ${v.plateNumber}`}>
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {myVehicles.length === 0 && (
              <tr><td colSpan={isAdmin ? 7 : 5}><EmptyState icon={Car} title="No vehicles on record" description={isAdmin ? 'New resident submissions will appear here for review.' : 'Add your first vehicle to begin the approval process.'} /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={`${confirmation?.status === 'approved' ? 'Approve' : 'Reject'} this vehicle?`}
        description={confirmation ? `${confirmation.vehicle.makeModel} · ${confirmation.vehicle.plateNumber}` : ''}
        impact={confirmation?.status === 'approved' ? 'The vehicle becomes eligible for sticker-renewal processing.' : 'The resident must correct and resubmit the vehicle information.'}
        confirmLabel={confirmation?.status === 'approved' ? 'Approve Vehicle' : 'Reject Vehicle'}
        tone={confirmation?.status === 'approved' ? 'warning' : 'danger'}
        busy={busy}
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmReview}
      />
    </div>
  );
};
