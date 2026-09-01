import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, X, MessageSquare, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui/Primitives';

const statusConfig = {
  pending: { label: 'Pending', badge: 'bg-amber-900/60 text-amber-400', icon: Clock },
  'in-progress': { label: 'In Progress', badge: 'bg-blue-900/60 text-blue-400', icon: AlertTriangle },
  resolved: { label: 'Resolved', badge: 'bg-emerald-900/60 text-emerald-400', icon: CheckCircle },
};

export const ResidentConcerns = () => {
  const { currentUser, currentHomeowner, concerns, homeowners, submitConcern, respondToConcern } = useApp();
  const isAdmin = currentUser?.role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ concernType: 'Maintenance', subject: '', description: '' });
  const [selectedConcern, setSelectedConcern] = useState(null);
  const [responseForm, setResponseForm] = useState({ response: '', status: 'in-progress' });

  const myConcerns = isAdmin ? concerns : concerns.filter(c => c.homeownerId === currentHomeowner?.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await submitConcern(form);
    if (result.success) {
      setForm({ concernType: 'Maintenance', subject: '', description: '' });
      setShowForm(false);
    }
  };

  const handleRespond = async (e) => {
    e.preventDefault();
    const result = await respondToConcern(selectedConcern.id, responseForm.response, responseForm.status);
    if (result.success) {
      setSelectedConcern(null);
      setResponseForm({ response: '', status: 'in-progress' });
    }
  };

  const concernTypes = ['Maintenance', 'Security', 'Noise Complaint', 'Sanitation', 'Billing Inquiry', 'Request', 'Other'];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <PageHeader eyebrow="Community support" title={isAdmin ? 'Concern Management' : 'My Concerns'} description={isAdmin ? 'Review, respond to, and manage resident concerns.' : 'Submit and track concerns, complaints, or requests.'} actions={!isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
            <Plus className="w-4 h-4" /> Submit Concern
          </button>
        )} />

      {}
      {!isAdmin && showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200">Submit a Concern</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
              <select value={form.concernType} onChange={e => setForm({ ...form, concernType: e.target.value })}
                className="px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
                {concernTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
              <input type="text" required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief description of the concern..." className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Details</label>
              <textarea required rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Provide full details of your concern..." className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">Submit Concern</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-medium transition">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {}
      {isAdmin && selectedConcern && (
        <div className="ui-modal-backdrop" role="presentation">
          <div className="ui-modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="concern-response-title">
            <div className="flex items-center justify-between mb-4">
              <h3 id="concern-response-title" className="text-sm font-bold text-slate-100">Respond to Concern</h3>
              <button onClick={() => setSelectedConcern(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 mb-4 text-xs">
              <div className="font-semibold text-slate-200">{selectedConcern.subject}</div>
              <div className="text-slate-400 mt-1">{selectedConcern.description}</div>
            </div>
            <form onSubmit={handleRespond} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Response</label>
                <textarea required rows={4} value={responseForm.response} onChange={e => setResponseForm({ ...responseForm, response: e.target.value })}
                  placeholder="Write your official response..." className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Update Status</label>
                <select value={responseForm.status} onChange={e => setResponseForm({ ...responseForm, status: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">Send Response & Update</button>
                <button type="button" onClick={() => setSelectedConcern(null)} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-medium transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      <div className="space-y-4">
        {myConcerns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700"><EmptyState icon={MessageSquare} title="No concerns submitted" description={isAdmin ? 'New resident concerns will appear here.' : 'Your submitted concerns and official responses will appear here.'} /></div>
        ) : (
          myConcerns.map(c => {
            const config = statusConfig[c.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            const homeowner = isAdmin ? homeowners.find(h => h.id === c.homeownerId) : null;
            return (
              <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-700 text-slate-400">{c.concernType}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${config.badge}`}>
                        <StatusIcon className="w-2.5 h-2.5" />{config.label}
                      </span>
                    </div>
                    {isAdmin && homeowner && <div className="text-[11px] text-blue-400 mt-1">From: {homeowner.ownerName} · {homeowner.blockLot}</div>}
                    <h3 className="text-sm font-bold text-slate-100 mt-1.5">{c.subject}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{c.description}</p>
                    {c.adminResponse && (
                      <div className="mt-3 p-3 rounded-xl bg-blue-950/40 border border-blue-800/50">
                        <div className="text-[10px] font-semibold text-blue-400 mb-1">Official Response · {c.respondedAt}</div>
                        <div className="text-xs text-slate-300">{c.adminResponse}</div>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-600 mt-2">Submitted: {c.submittedAt}</div>
                  </div>
                  {isAdmin && c.status !== 'resolved' && (
                    <button onClick={() => setSelectedConcern(c)} className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold transition">
                      Respond
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
