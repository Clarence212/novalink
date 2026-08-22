import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, X, Calendar, CheckCircle, XCircle, Edit2 } from 'lucide-react';

const statusBadge = (s) => {
  const m = { pending: 'bg-amber-900/60 text-amber-400', approved: 'bg-emerald-900/60 text-emerald-400', rejected: 'bg-red-900/60 text-red-400' };
  return <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${m[s] || 'bg-slate-700 text-slate-400'}`}>{s}</span>;
};

export const FacilityReservations = () => {
  const { currentUser, currentHomeowner, reservations, facilities, addReservation, updateReservationStatus, isRestricted, saveFacility } = useApp();
  const isAdmin = currentUser?.role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ facilityId: 'f1', date: '', timeSlot: '', purpose: '' });
  const [facilityForm, setFacilityForm] = useState(null);

  const myReservations = isAdmin ? reservations : reservations.filter(r => r.homeownerId === currentHomeowner?.id);

  useEffect(() => {
    const activeFacilities = facilities.filter(facility => facility.isActive);
    if (!isAdmin && activeFacilities.length > 0 && !activeFacilities.some(facility => facility.id === form.facilityId)) {
      setForm(previous => ({ ...previous, facilityId: activeFacilities[0].id }));
    }
  }, [facilities, form.facilityId, isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await addReservation(form);
    if (result.success) {
      setForm({ facilityId: facilities.find(f => f.isActive)?.id || '', date: '', timeSlot: '', purpose: '' });
      setShowForm(false);
    }
  };

  const timeSlots = ['8:00 AM - 12:00 PM', '12:00 PM - 4:00 PM', '4:00 PM - 8:00 PM', '9:00 AM - 1:00 PM', '1:00 PM - 5:00 PM'];

  const editFacility = (facility = null) => setFacilityForm(facility ? {
    id: facility.id, name: facility.name, description: facility.description || '', capacity: String(facility.capacity),
    rate: facility.rate, guestBookable: facility.guestBookable, isActive: facility.isActive,
  } : { name: '', description: '', capacity: '', rate: '', guestBookable: true, isActive: true });

  const handleFacilitySave = async (event) => {
    event.preventDefault();
    const result = await saveFacility({ ...facilityForm, capacity: Number(facilityForm.capacity) });
    if (result.success) setFacilityForm(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Facility Reservations</h2>
          <p className="text-xs text-slate-500 mt-0.5">{isAdmin ? 'Review and manage facility reservation requests' : 'Reserve community facilities for your events'}</p>
        </div>
        {!isAdmin && !isRestricted && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
            <Plus className="w-4 h-4" /> New Reservation
          </button>
        )}
        {isAdmin && (
          <button onClick={() => editFacility()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
            <Plus className="w-4 h-4" /> Add Facility
          </button>
        )}
      </div>

      {}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Available Facilities</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {facilities.filter(f => isAdmin || f.isActive).map(f => (
            <div key={f.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              {isAdmin && <button onClick={() => editFacility(f)} className="float-right p-1.5 rounded-lg bg-slate-700 hover:bg-blue-600 text-slate-300" title="Edit facility"><Edit2 className="w-3 h-3" /></button>}
              <Calendar className="w-5 h-5 text-blue-400 mb-2" />
              <div className="text-xs font-bold text-slate-200">{f.name}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Capacity: {f.capacity} pax</div>
              <div className="text-[10px] text-blue-400 mt-0.5">{f.rate}</div>
              {f.guestBookable && <div className="text-[9px] text-emerald-400 mt-1">✓ Guest bookable</div>}
              {!f.isActive && <div className="text-[9px] text-amber-400 mt-1">Inactive</div>}
            </div>
          ))}
        </div>
      </div>

      {isAdmin && facilityForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleFacilitySave} className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-3 shadow-2xl">
            <button type="button" onClick={() => setFacilityForm(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold text-slate-100">{facilityForm.id ? 'Edit Facility' : 'Add Facility'}</h3>
            {[
              ['name', 'Facility Name', 'text'], ['capacity', 'Capacity', 'number'], ['rate', 'Rate Label', 'text'],
            ].map(([key, label, type]) => (
              <label key={key}>
                <span className="block text-xs font-medium text-slate-400 mb-1">{label}</span>
                <input type={type} required min={type === 'number' ? 1 : undefined} value={facilityForm[key]}
                  onChange={event => setFacilityForm({ ...facilityForm, [key]: event.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200" />
              </label>
            ))}
            <label>
              <span className="block text-xs font-medium text-slate-400 mb-1">Description</span>
              <textarea rows={3} value={facilityForm.description} onChange={event => setFacilityForm({ ...facilityForm, description: event.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200" />
            </label>
            <div className="flex gap-5 text-xs text-slate-300">
              <label className="flex items-center gap-2"><input type="checkbox" checked={facilityForm.guestBookable} onChange={event => setFacilityForm({ ...facilityForm, guestBookable: event.target.checked })} /> Guest bookable</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={facilityForm.isActive} onChange={event => setFacilityForm({ ...facilityForm, isActive: event.target.checked })} /> Active</label>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">Save Facility</button>
              <button type="button" onClick={() => setFacilityForm(null)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {}
      {!isAdmin && showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200">New Reservation Request</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Facility</label>
              <select required value={form.facilityId} onChange={e => setForm({ ...form, facilityId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
                {facilities.filter(f => f.isActive).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Date</label>
              <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Time Slot</label>
              <select required value={form.timeSlot} onChange={e => setForm({ ...form, timeSlot: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
                <option value="">Select time slot</option>
                {timeSlots.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Purpose</label>
              <input type="text" required value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}
                placeholder="e.g. Birthday Party, Meeting" className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="sm:col-span-2 flex gap-2 pt-1">
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">Submit Request</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-medium transition">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700">
          <h3 className="text-sm font-bold text-slate-200">{isAdmin ? 'All Reservation Requests' : 'My Reservations'}</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
              <th className="px-5 py-3">Requester</th>
              <th className="px-5 py-3">Facility</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Time Slot</th>
              <th className="px-5 py-3">Purpose</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Status</th>
              {isAdmin && <th className="px-5 py-3">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {myReservations.map(r => {
              const facility = facilities.find(f => f.id === r.facilityId);
              return (
                <tr key={r.id} className="hover:bg-slate-700/30 transition">
                  <td className="px-5 py-3 text-slate-200 font-medium">{r.requesterName}</td>
                  <td className="px-5 py-3 text-slate-400">{facility?.name}</td>
                  <td className="px-5 py-3 text-slate-400">{r.date}</td>
                  <td className="px-5 py-3 text-slate-400">{r.timeSlot}</td>
                  <td className="px-5 py-3 text-slate-400">{r.purpose}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${r.requesterType === 'guest' ? 'bg-violet-900/60 text-violet-400' : 'bg-blue-900/60 text-blue-400'}`}>
                      {r.requesterType}
                    </span>
                  </td>
                  <td className="px-5 py-3">{statusBadge(r.status)}</td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      {r.status === 'pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => updateReservationStatus(r.id, 'approved')} className="p-1 rounded-lg bg-emerald-600/70 hover:bg-emerald-600 text-white transition" title="Approve">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => updateReservationStatus(r.id, 'rejected')} className="p-1 rounded-lg bg-red-600/70 hover:bg-red-600 text-white transition" title="Reject">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {myReservations.length === 0 && (
              <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-slate-500">No reservations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
