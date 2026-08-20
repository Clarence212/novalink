// hey reader! homeowners master records — admin manages all resident records
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Home, ChevronDown, ChevronUp, Search } from 'lucide-react';

export const HomeownersRecords = () => {
  const { homeowners, vehicles, dues, stickerRenewals } = useApp();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const filtered = homeowners.filter(h =>
    h.ownerName.toLowerCase().includes(search.toLowerCase()) ||
    h.blockLot.toLowerCase().includes(search.toLowerCase()) ||
    h.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Homeowners' Master Records</h2>
        <p className="text-xs text-slate-500 mt-0.5">Centralized registry of all NHAI residents and their related records</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{homeowners.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total Homeowners</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{homeowners.filter(h => !h.restricted).length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Good Standing</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{homeowners.filter(h => h.restricted).length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Restricted Accounts</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700">
        <Search className="w-4 h-4 text-slate-500" />
        <input type="text" placeholder="Search by owner name, block/lot, or email..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none" />
      </div>

      {/* Records */}
      <div className="space-y-3">
        {filtered.map(h => {
          const isExpanded = expanded === h.id;
          const myVehicles = vehicles.filter(v => v.homeownerId === h.id);
          const myDues = dues.filter(d => d.homeownerId === h.id);
          const myRenewals = stickerRenewals.filter(r => r.homeownerId === h.id);
          const unpaidDues = myDues.filter(d => d.status === 'unpaid');
          const balance = unpaidDues.reduce((sum, d) => sum + d.amountDue + d.penaltyAmount, 0);

          return (
            <div key={h.id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
              <button
                className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-700/30 transition text-left"
                onClick={() => setExpanded(isExpanded ? null : h.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-900/60 flex items-center justify-center shrink-0">
                    <Home className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-100">{h.ownerName}</span>
                      {h.restricted && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-400 font-semibold">RESTRICTED</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{h.blockLot} · {h.street}</div>
                    <div className="text-[11px] text-slate-500">{h.email} · {h.contactNumber}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold ${balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {balance > 0 ? `₱${balance.toLocaleString()} owed` : 'Dues settled'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{myVehicles.length} vehicle(s) · {h.occupants.length} occupant(s)</div>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-700 px-5 py-4 space-y-4">
                  {/* Occupants */}
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Household Occupants</div>
                    {h.occupants.length === 0 ? (
                      <div className="text-xs text-slate-600">No occupants recorded.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {h.occupants.map(o => (
                          <div key={o.id} className="px-3 py-1.5 rounded-xl bg-slate-700 text-xs">
                            <span className="text-slate-200 font-medium">{o.name}</span>
                            <span className="text-slate-500 ml-1.5">({o.relationship})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vehicles */}
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Registered Vehicles</div>
                    {myVehicles.length === 0 ? (
                      <div className="text-xs text-slate-600">No vehicles recorded.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {myVehicles.map(v => (
                          <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-700/60 text-xs">
                            <span className="text-slate-200">{v.makeModel} · {v.plateNumber} · {v.color}</span>
                            <span className={`text-[10px] font-semibold ${v.approvalStatus === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`}>{v.approvalStatus}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dues Summary */}
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Dues Summary</div>
                    <div className="flex gap-3 flex-wrap">
                      <span className="text-xs px-2 py-1 rounded-lg bg-emerald-900/40 text-emerald-400">{myDues.filter(d => d.status === 'paid').length} paid months</span>
                      <span className="text-xs px-2 py-1 rounded-lg bg-red-900/40 text-red-400">{unpaidDues.length} unpaid months</span>
                      <span className="text-xs px-2 py-1 rounded-lg bg-slate-700 text-slate-400">{myRenewals.length} sticker renewal(s)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-12 text-slate-500 text-sm">No homeowner records found.</div>}
      </div>
    </div>
  );
};
