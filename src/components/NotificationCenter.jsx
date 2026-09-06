import React from 'react';
import { Bell, CheckCheck, Settings2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EmptyState } from './ui/Primitives';

const parseUtc = (value) => {
  if (!value) return null;
  const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const date = parseUtc(value);
  return date ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
};

export const NotificationCenter = ({ onClose, onOpenPreferences }) => {
  const {
    notifications = [], notificationPreferencesReady,
    markNotificationRead, markAllNotificationsRead,
  } = useApp();
  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <div className="ui-modal-backdrop items-start justify-end p-0 sm:p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="flex h-full w-full flex-col border-l border-slate-800 bg-slate-900 shadow-2xl sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:max-w-md sm:rounded-2xl sm:border" role="dialog" aria-modal="true" aria-labelledby="notification-center-title">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div><h2 id="notification-center-title" className="text-lg font-bold text-slate-100">Notifications</h2><p className="mt-1 text-sm text-slate-400">{unread ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'You are all caught up'}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Close notifications"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <button type="button" onClick={onOpenPreferences} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-950/50"><Settings2 className="h-4 w-4" /> Preferences</button>
          {unread > 0 && <button type="button" onClick={markAllNotificationsRead} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"><CheckCheck className="h-4 w-4" /> Mark all read</button>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!notificationPreferencesReady ? (
            <div className="m-4 rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm leading-5 text-amber-200">In-app notifications will be available after database migration 005 is applied.</div>
          ) : notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications yet" description="Account, payment, reservation, and community updates will appear here." />
          ) : notifications.map((item) => (
            <button key={item.id} type="button" onClick={() => !item.readAt && markNotificationRead(item.id)} className={`block w-full border-b border-slate-800 px-5 py-4 text-left transition hover:bg-slate-800/70 ${item.readAt ? 'bg-slate-900' : 'bg-blue-950/20'}`}>
              <div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? 'bg-slate-700' : 'bg-blue-400'}`} /><div className="min-w-0"><p className="text-sm font-bold text-slate-100">{item.subject}</p><p className="mt-1 text-sm leading-5 text-slate-400">{item.body}</p><p className="mt-2 text-xs text-slate-600">{formatDate(item.createdAt)}</p></div></div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
