import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Home, ChevronDown, ChevronUp, Search, Plus, Edit2, X } from 'lucide-react';
import { EmptyState, PageHeader, StatCard } from '../components/ui/Primitives';

const EMPTY_RECORD = {
  ownerName: '', blockLot: '', street: '', contactNumber: '', email: '', occupantsText: '',
};

export const HomeownersRecords = () => {
  const { homeowners, vehicles, dues, stickerRenewals, addHomeownerRecord, updateHomeownerRecord } = useApp();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [recordForm, setRecordForm] = useState(EMPTY_RECORD);

  const openCreate = () => {
    setEditingRecord('new');
    setRecordForm(EMPTY_RECORD);
  };

  const openEdit = (homeowner) => {
    setEditingRecord(homeowner.id);
    setRecordForm({
      ownerName: homeowner.ownerName,
      blockLot: homeowner.blockLot,
      street: homeowner.street,
      contactNumber: homeowner.contactNumber,
      email: homeowner.email,
      occupantsText: (homeowner.occupants || [])
        .map(occupant => `${occupant.fullName} | ${occupant.relationship}`)
        .join('\n'),
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const occupants = recordForm.occupantsText.split('\n').map(line => line.trim()).filter(Boolean).map((line) => {
      const [fullName, ...relationshipParts] = line.split('|');
      return { fullName: fullName.trim(), relationship: relationshipParts.join('|').trim() };
    });
    if (occupants.some(occupant => !occupant.fullName || !occupant.relationship)) return;
    const payload = { ...recordForm, occupants };
    delete payload.occupantsText;
    const result = editingRecord === 'new'
      ? await addHomeownerRecord(payload)
      : await updateHomeownerRecord(editingRecord, payload);
    if (result.success) setEditingRecord(null);
  };

  const filtered = homeowners.filter(h =>
    h.ownerName.toLowerCase().includes(search.toLowerCase()) ||
    h.blockLot.toLowerCase().includes(search.toLowerCase()) ||
    h.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader eyebrow="Community records" title="Homeowners' Master Records" description="The authoritative registry for resident services and association records." actions={<button type="button" onClick={openCreate} className="ui-button bg-blue-600 text-white hover:bg-blue-500">
          <Plus className="w-4 h-4" /> Add Homeowner
        </button>} />

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3"><StatCard label="Total homeowners" value={homeowners.length} icon={Home} tone="blue" /><StatCard label="Good standing" value={homeowners.filter(h => !h.restricted).length} detail="No service restrictions" icon={Home} tone="emerald" /><StatCard label="Restricted" value={homeowners.filter(h => h.restricted).length} detail="Outstanding attention" icon={Home} tone="amber" /></div>

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
          const balance = unpaidDues.reduce((sum, d) => sum + (d.balanceDue ?? d.amountDue + d.penaltyAmount), 0);

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
                  <div className="text-[10px] text-slate-500 mt-0.5">{myVehicles.length} vehicle(s) · {(h.occupants || []).length} occupant(s)</div>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-700 px-5 py-4 space-y-4">
                  <div className="flex justify-end">
                    <button onClick={() => openEdit(h)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/70 hover:bg-blue-600 text-white text-[10px] font-bold transition">
                      <Edit2 className="w-3 h-3" /> Edit Record
                    </button>
                  </div>
                  {/* Occupants */}
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Household Occupants</div>
                    {(h.occupants || []).length === 0 ? (
                      <div className="text-xs text-slate-600">No occupants recorded.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {h.occupants.map(o => (
                          <div key={o.id} className="px-3 py-1.5 rounded-xl bg-slate-700 text-xs">
                            <span className="text-slate-200 font-medium">{o.fullName}</span>
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
        {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-slate-700"><EmptyState icon={Home} title="No homeowner records found" description="Try another name, block and lot, or email address." /></div>}
      </div>

      {editingRecord && (
        <div className="ui-modal-backdrop" role="presentation">
          <form onSubmit={handleSave} className="ui-modal relative max-w-lg space-y-4" role="dialog" aria-modal="true" aria-labelledby="homeowner-form-title">
            <button type="button" onClick={() => setEditingRecord(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            <div>
              <h3 id="homeowner-form-title" className="text-lg font-bold text-slate-100">{editingRecord === 'new' ? 'Add Homeowner Record' : 'Edit Homeowner Record'}</h3>
              <p className="text-xs text-slate-400 mt-1">Use the exact registered email and block/lot so resident self-registration can be matched securely.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['ownerName', 'Owner Name'], ['blockLot', 'Block & Lot'], ['street', 'Street'],
                ['contactNumber', 'Contact Number'], ['email', 'Email Address'],
              ].map(([key, label]) => (
                <label key={key} className={key === 'email' ? 'sm:col-span-2' : ''}>
                  <span className="block text-xs font-semibold text-slate-300 mb-1">{label}</span>
                  <input type={key === 'email' ? 'email' : 'text'} required value={recordForm[key]}
                    onChange={event => setRecordForm({ ...recordForm, [key]: event.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                </label>
              ))}
            </div>
            <label>
              <span className="block text-xs font-semibold text-slate-300 mb-1">Household Occupants</span>
              <textarea rows={4} value={recordForm.occupantsText}
                onChange={event => setRecordForm({ ...recordForm, occupantsText: event.target.value })}
                placeholder={'One per line: Full Name | Relationship\nExample: Maria Dela Cruz | Spouse'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
              <span className="text-[10px] text-slate-500">Every non-empty line must contain a name, a vertical bar, and a relationship.</span>
            </label>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">Save Record</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
