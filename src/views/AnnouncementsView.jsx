import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Bell, X, AlertTriangle } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui/Primitives';

const priorityConfig = {
  urgent: { label: 'Urgent', border: 'border-red-700/50', bg: 'bg-red-950/30', badge: 'bg-red-900/60 text-red-400', dot: 'bg-red-500' },
  important: { label: 'Important', border: 'border-amber-700/50', bg: 'bg-amber-950/20', badge: 'bg-amber-900/60 text-amber-400', dot: 'bg-amber-500' },
  normal: { label: 'Normal', border: 'border-slate-700', bg: 'bg-slate-800', badge: 'bg-slate-700 text-slate-400', dot: 'bg-slate-500' },
};

export const AnnouncementsView = () => {
  const { announcements, addAnnouncement, currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin';
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', priority: 'normal' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    const result = await addAnnouncement(form);
    if (result.success) {
      setForm({ title: '', content: '', priority: 'normal' });
      setShowForm(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <PageHeader eyebrow="Communication" title="Announcements & Notices" description="Community updates from Novaville HOA Administration." actions={isAdmin && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="ui-button bg-blue-600 text-white hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" /> Post Announcement
          </button>
        )} />

      {}
      {isAdmin && showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200">New Announcement</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white transition"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Announcement title..."
                className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Content</label>
              <textarea
                required
                rows={4}
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="Write the full announcement here..."
                className="w-full px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                className="px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
                Post & Notify Residents
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700"><EmptyState icon={Bell} title="No announcements yet" description="Published community updates will appear here." /></div>
        ) : (
          announcements.map(a => {
            const config = priorityConfig[a.priority] || priorityConfig.normal;
            return (
              <div key={a.id} className={`rounded-2xl border p-5 ${config.bg} ${config.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-2 h-2 rounded-full ${config.dot} mt-1.5 shrink-0`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-100">{a.title}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${config.badge}`}>{config.label}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{a.content}</p>
                      <div className="text-[10px] text-slate-600 mt-2">Posted by NHAI Administration · {a.datePosted}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
