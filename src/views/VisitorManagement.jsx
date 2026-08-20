// hey reader! visitor management admin view — read-only log access for admin role
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, LogOut } from 'lucide-react';

export const VisitorManagement = () => {
  const { visitorLogs, updateVisitorExit, currentUser } = useApp();
  const [search, setSearch] = useState('');
  const isGuard = currentUser?.role === 'security';

  const filtered = visitorLogs.filter(l =>
    l.visitorName.toLowerCase().includes(search.toLowerCase()) ||
    l.destinationAddress.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Visitor Logs</h2>
        <p className="text-xs text-slate-500 mt-0.5">All recorded visitor entry and exit transactions</p>
      </div>

      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700">
        <Search className="w-4 h-4 text-slate-500" />
        <input type="text" placeholder="Search by visitor name or destination..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none" />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
              <th className="px-5 py-3">Visitor</th>
              <th className="px-5 py-3">Purpose</th>
              <th className="px-5 py-3">Destination</th>
              <th className="px-5 py-3">Vehicle Plate</th>
              <th className="px-5 py-3">Entry Time</th>
              <th className="px-5 py-3">Exit Time</th>
              <th className="px-5 py-3">Status</th>
              {isGuard && <th className="px-5 py-3"></th>}
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
                <td className="px-5 py-3 text-slate-400 font-mono">{log.vehiclePlate || '—'}</td>
                <td className="px-5 py-3 text-slate-400">{log.entryTime}</td>
                <td className="px-5 py-3 text-slate-500">{log.exitTime || '—'}</td>
                <td className="px-5 py-3">
                  {log.exitTime
                    ? <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-700 text-slate-400 font-semibold">Exited</span>
                    : <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-900/60 text-emerald-400 font-semibold">On-Site</span>
                  }
                </td>
                {isGuard && (
                  <td className="px-5 py-3">
                    {!log.exitTime && (
                      <button onClick={() => updateVisitorExit(log.id)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-slate-700 hover:bg-amber-600/70 text-slate-300 hover:text-white transition">
                        <LogOut className="w-3 h-3" /> Log Exit
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={isGuard ? 8 : 7} className="text-center py-10 text-slate-500">No visitor logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
