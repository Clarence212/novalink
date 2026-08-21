import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, X, Car, CheckCircle, XCircle } from 'lucide-react';

const statusBadge = (s) => {
  const m = { pending: 'bg-amber-900/60 text-amber-400', approved: 'bg-emerald-900/60 text-emerald-400', rejected: 'bg-red-900/60 text-red-400' };
  return <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${m[s] || 'bg-slate-700 text-slate-400'}`}>{s}</span>;
};

export const VehicleManagement = () => {
  const { currentUser, currentHomeowner, vehicles, homeowners, submitVehicle, reviewVehicle } = useApp();
  const isAdmin = currentUser?.role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleType: 'Sedan', makeModel: '', plateNumber: '', color: '' });

  const myVehicles = isAdmin
    ? vehicles
    : vehicles.filter(v => v.homeownerId === currentHomeowner?.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    submitVehicle(form);
    setForm({ vehicleType: 'Sedan', makeModel: '', plateNumber: '', color: '' });
    setShowForm(false);
  };

  const vehicleTypes = ['Sedan', 'SUV', 'Pickup Truck', 'Van', 'Motorcycle', 'Other'];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{isAdmin ? 'Vehicle Records' : 'My Vehicles'}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{isAdmin ? 'Review submitted vehicle information and approve for master record inclusion' : 'Submit vehicle information for NHAI approval'}</p>
        </div>
        {!isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
            <Plus className="w-4 h-4" /> Add Vehicle
          </button>
        )}
      </div>

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
        <table className="w-full text-xs">
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
                  {isAdmin && <td className="px-5 py-3 text-slate-300 font-medium">{homeowner?.ownerName}</td>}
                  <td className="px-5 py-3 text-slate-400">{v.type}</td>
                  <td className="px-5 py-3 text-slate-300 font-medium">{v.makeModel}</td>
                  <td className="px-5 py-3 text-slate-200 font-mono">{v.plateNumber}</td>
                  <td className="px-5 py-3 text-slate-400">{v.color}</td>
                  <td className="px-5 py-3">{statusBadge(v.approvalStatus)}</td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      {v.approvalStatus === 'pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => reviewVehicle(v.id, 'approved')} className="p-1 rounded-lg bg-emerald-600/70 hover:bg-emerald-600 text-white transition" title="Approve">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => reviewVehicle(v.id, 'rejected')} className="p-1 rounded-lg bg-red-600/70 hover:bg-red-600 text-white transition" title="Reject">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {myVehicles.length === 0 && (
              <tr><td colSpan={isAdmin ? 7 : 5} className="text-center py-10 text-slate-500">No vehicles on record.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
