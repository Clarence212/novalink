import React from 'react';
import { X, Mail, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const EmailLogModal = ({ onClose }) => {
  const { emailLog } = useApp();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col max-h-[80vh]">
        {}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-slate-100">System Email Log & Notifications</h2>
            <span className="text-[10px] bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full font-semibold">{emailLog.length} sent</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {emailLog.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No emails dispatched yet.</div>
          ) : (
            emailLog.map((email) => (
              <div key={email.id} className="p-4 rounded-2xl bg-slate-800 border border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">{email.subject}</div>
                    <div className="text-[11px] text-blue-400 mt-0.5">To: {email.to}</div>
                    <div className="text-[11px] text-slate-400 mt-2 leading-relaxed">{email.body}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
                    <Clock className="w-3 h-3" />
                    {email.sentAt}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
