// hey reader! guard dashboard and visitor logging module — all in one view
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Search, LogOut, Clock, Shield } from 'lucide-react';

const statusBadge = (exitTime) => exitTime
  ? <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-700 text-slate-400 font-semibold">Exited</span>
  : <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-900/60 text-emerald-400 font-semibold">On-Site</span>;

export const GuardDashboard = () => {
  const { currentUser, visitorLogs, addVisitorLog, updateVisitorExit, announcements } = useApp();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ visitorName: '', contactNumber: '', purpose: '', destinationAddress: '', vehiclePlate: '' });

  const displayName = currentUser?.fullName || 'Security Officer';

  const filtered = visitorLogs.filter(l =>
    l.visitorName.toLowerCase().includes(search.toLowerCase()) ||
    l.destinationAddress.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    addVisitorLog(form);
    setForm({ visitorName: '', contactNumber: '', purpose: '', destinationAddress: '', vehiclePlate: '' });
    setShowForm(false);
  };

  const onSite = visitorLogs.filter(l => !l.exitTime).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Security — Visitor Logging</h2>
          <p className="text-xs text-slate-500 mt-0.5">Welcome, {displayName} · Record and monitor visitor entry at the gate</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
        >
          <Plus className="w-4 h-4" /> Log Visitor Entry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{visitorLogs.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total Logs Today</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{onSite}</div>
          <div className="text-xs text-slate-500 mt-0.5">Currently On-Site</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-400">{visitorLogs.length - onSite}</div>
          <div className="text-xs text-slate-500 mt-0.5">Already Exited</div>
        </div>
      </div>

      {/* Log Entry Form */}
      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4">New Visitor Entry</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'visitorName', label: 'Visitor Name', placeholder: 'Full name', required: true },
              { key: 'contactNumber', label: 'Contact Number', placeholder: '09XXXXXXXXX', required: true },
              { key: 'purpose', label: 'Purpose of Visit', placeholder: 'e.g. Personal Visit, Delivery', required: true },
              { key: 'destinationAddress', label: 'Destination Address', placeholder: 'Block & Lot / Homeowner Name', required: true },
              { key: 'vehiclePlate', label: 'Vehicle Plate (Optional)', placeholder: 'e.g. ABC 1234', required: false },
            ].map(f => (
              <div key={f.key} className={f.key === 'destinationAddress' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}</label>
                <input
                  type="text"
                  required={f.required}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex gap-2 pt-1">
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
                Save Entry
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + Visitor Log Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by visitor name or destination..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
                <th className="px-5 py-3">Visitor</th>
                <th className="px-5 py-3">Purpose</th>
                <th className="px-5 py-3">Destination</th>
                <th className="px-5 py-3">Entry Time</th>
                <th className="px-5 py-3">Exit Time</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-700/30 transition">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-200">{log.visitorName}</div>
                    <div className="text-slate-500">{log.contactNumber}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-400">{log.purpose}</td>
                  <td className="px-5 py-3 text-slate-400">{log.destinationAddress}</td>
                  <td className="px-5 py-3 text-slate-400">{log.entryTime}</td>
                  <td className="px-5 py-3 text-slate-500">{log.exitTime || '—'}</td>
                  <td className="px-5 py-3">{statusBadge(log.exitTime)}</td>
                  <td className="px-5 py-3">
                    {!log.exitTime && (
                      <button
                        onClick={() => updateVisitorExit(log.id)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-slate-700 hover:bg-amber-600/70 text-slate-300 hover:text-white transition"
                      >
                        <LogOut className="w-3 h-3" /> Log Exit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">No visitor logs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Announcements for guard */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-3">Community Announcements</h3>
        <div className="space-y-2">
          {announcements.slice(0, 3).map(a => (
            <div key={a.id} className="text-xs text-slate-400 px-3 py-2 rounded-xl bg-slate-700/50 border border-slate-700">
              <span className="font-medium text-slate-300">{a.title}</span> · <span>{a.datePosted}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
