import React, { useState } from 'react';
import {
  BellRing, CalendarClock, CircleDollarSign, FileCheck2, LockKeyhole,
  Megaphone, MessageSquareText, SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader } from '../components/ui/Primitives';

const CATEGORIES = [
  { id: 'account', label: 'Security and account', description: 'Verification, password, role, and account-status changes.', icon: LockKeyhole },
  { id: 'announcements', label: 'Community announcements', description: 'Published notices and important association updates.', icon: Megaphone },
  { id: 'payments', label: 'Dues and payments', description: 'Payment decisions, balances, and dues reminders.', icon: CircleDollarSign },
  { id: 'reservations', label: 'Facility reservations', description: 'Reservation submissions and approval decisions.', icon: CalendarClock },
  { id: 'concerns', label: 'Concern updates', description: 'Responses and status changes for submitted concerns.', icon: MessageSquareText },
  { id: 'records', label: 'Vehicle and sticker records', description: 'Vehicle reviews and sticker-renewal decisions.', icon: FileCheck2 },
  { id: 'general', label: 'General messages', description: 'Direct messages sent by an NHAI administrator.', icon: BellRing },
];

const ChannelCheckbox = ({ checked, disabled, label, onChange }) => (
  <label className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${disabled ? 'cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-500' : 'cursor-pointer border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="h-4 w-4 rounded border-slate-600 accent-blue-600" />
    {label}
  </label>
);

export const NotificationPreferences = () => {
  const {
    notificationPreferences = {}, notificationPreferencesReady,
    saveNotificationPreference,
  } = useApp();
  const [busyCategory, setBusyCategory] = useState('');

  const update = async (category, channel, enabled) => {
    const current = notificationPreferences[category] || { emailEnabled: true, inAppEnabled: true };
    setBusyCategory(category);
    await saveNotificationPreference(
      category,
      channel === 'email' ? enabled : Boolean(current.emailEnabled),
      channel === 'inApp' ? enabled : Boolean(current.inAppEnabled),
    );
    setBusyCategory('');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        eyebrow="Personal settings"
        title="Notification preferences"
        description="Choose where NovaLink sends routine updates. Security and account notices remain enabled so important access changes are never missed."
      />

      {!notificationPreferencesReady && (
        <div className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm leading-6 text-amber-200">
          Notification preferences will become available after database migration 005 is applied. Existing email delivery continues normally.
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="hidden grid-cols-[minmax(0,1fr)_140px_140px] border-b border-slate-800 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 md:grid">
          <span>Notification type</span><span>Email</span><span>In NovaLink</span>
        </div>
        <div className="divide-y divide-slate-800">
          {CATEGORIES.map(({ id, label, description, icon: Icon }) => {
            const preference = notificationPreferences[id] || { emailEnabled: true, inAppEnabled: true, required: id === 'account' };
            const required = Boolean(preference.required || id === 'account');
            const disabled = !notificationPreferencesReady || required || busyCategory === id;
            return (
              <div key={id} className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_140px_140px] md:items-center">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-blue-400"><Icon className="h-5 w-5" /></span>
                  <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-slate-100">{label}</h2>{required && <span className="rounded-full bg-blue-950 px-2 py-0.5 text-[11px] font-bold text-blue-300">Required</span>}</div><p className="mt-1 text-sm leading-5 text-slate-400">{description}</p></div>
                </div>
                <ChannelCheckbox label="Email" checked={Boolean(preference.emailEnabled)} disabled={disabled} onChange={(event) => update(id, 'email', event.target.checked)} />
                <ChannelCheckbox label="In app" checked={Boolean(preference.inAppEnabled)} disabled={disabled} onChange={(event) => update(id, 'inApp', event.target.checked)} />
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-5 text-slate-400">
        <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
        Changes apply to future notifications. Existing messages remain in your notification history.
      </div>
    </div>
  );
};
