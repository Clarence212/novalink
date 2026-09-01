import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, CheckCircle, ChevronLeft, ChevronRight, Edit2, List,
  Plus, SlidersHorizontal, X, XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, EmptyState, FieldError, HelpText, PageHeader } from '../components/ui/Primitives';

const TIME_SLOTS = ['8:00 AM - 12:00 PM', '12:00 PM - 4:00 PM', '4:00 PM - 8:00 PM'];
const STATUS_CLASS = {
  pending: 'border-amber-700/50 bg-amber-950/60 text-amber-300',
  approved: 'border-emerald-700/50 bg-emerald-950/60 text-emerald-300',
  rejected: 'border-red-700/50 bg-red-950/60 text-red-300',
  cancelled: 'border-slate-700 bg-slate-800 text-slate-400',
};
const statusBadge = (status) => <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_CLASS[status] || STATUS_CLASS.cancelled}`}>{status}</span>;
const dateKey = (date) => date.toISOString().slice(0, 10);
const manilaDateKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const monthTitle = (date) => new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
const formatDate = (value) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const reference = (id) => `RSV-${String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase() || 'PENDING'}`;

const calendarDays = (month) => {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { date, key: dateKey(date), currentMonth: date.getUTCMonth() === monthIndex };
  });
};

export const FacilityReservations = () => {
  const { currentUser, currentHomeowner, reservations, facilities, addReservation, updateReservationStatus, isRestricted, saveFacility } = useApp();
  const isAdmin = currentUser?.role === 'admin';
  const today = manilaDateKey();
  const [display, setDisplay] = useState('calendar');
  const [month, setMonth] = useState(() => new Date(`${today.slice(0, 7)}-01T00:00:00Z`));
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(today);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ facilityId: facilities.find((facility) => facility.isActive)?.id || '', date: '', timeSlot: '', purpose: '' });
  const [facilityForm, setFacilityForm] = useState(null);
  const [busyId, setBusyId] = useState('');

  const myReservations = isAdmin ? reservations : reservations.filter((reservation) => reservation.homeownerId === currentHomeowner?.id);
  const filteredReservations = useMemo(() => myReservations.filter((reservation) => facilityFilter === 'all' || String(reservation.facilityId) === facilityFilter), [facilityFilter, myReservations]);
  const selectedReservations = filteredReservations.filter((reservation) => reservation.date === selectedDate);
  const days = useMemo(() => calendarDays(month), [month]);

  useEffect(() => {
    const active = facilities.filter((facility) => facility.isActive);
    if (active.length && !active.some((facility) => String(facility.id) === String(form.facilityId))) {
      setForm((previous) => ({ ...previous, facilityId: active[0].id }));
    }
  }, [facilities, form.facilityId]);

  const conflict = reservations.find((reservation) => (
    String(reservation.facilityId) === String(form.facilityId)
    && reservation.date === form.date
    && reservation.timeSlot === form.timeSlot
    && ['pending', 'approved'].includes(reservation.status)
  ));

  const openReservation = (date = '') => {
    setForm({ facilityId: facilities.find((facility) => facility.isActive)?.id || '', date, timeSlot: '', purpose: '' });
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (conflict) return;
    const result = await addReservation(form);
    if (result.success) {
      setShowForm(false);
      setSelectedDate(form.date);
    }
  };

  const setStatus = async (id, status) => {
    setBusyId(`${status}-${id}`);
    await updateReservationStatus(id, status);
    setBusyId('');
  };

  const editFacility = (facility = null) => setFacilityForm(facility ? {
    id: facility.id, name: facility.name, description: facility.description || '', capacity: String(facility.capacity),
    rate: facility.rate, guestBookable: facility.guestBookable, isActive: facility.isActive,
  } : { name: '', description: '', capacity: '', rate: '', guestBookable: true, isActive: true });

  const handleFacilitySave = async (event) => {
    event.preventDefault();
    const result = await saveFacility({ ...facilityForm, capacity: Number(facilityForm.capacity) });
    if (result.success) setFacilityForm(null);
  };

  const moveMonth = (amount) => setMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1)));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
      <PageHeader
        eyebrow="Community facilities"
        title="Facility Reservations"
        description={isAdmin ? 'Review availability, approve requests, and keep facility information current.' : 'Check live availability before requesting a community facility.'}
        actions={<>
          {isAdmin && <Button variant="secondary" onClick={() => editFacility()}><Plus className="h-4 w-4" /> Add facility</Button>}
          {!isAdmin && !isRestricted && <Button onClick={() => openReservation(selectedDate >= today ? selectedDate : '')}><Plus className="h-4 w-4" /> New reservation</Button>}
        </>}
      />

      {isRestricted && !isAdmin && <div className="rounded-2xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-200"><strong>Reservations are temporarily restricted.</strong><p className="mt-1 text-xs text-amber-300/80">Settle overdue dues to restore access to facility booking.</p></div>}

      <section>
        <div className="mb-3 flex items-end justify-between"><div><p className="ui-eyebrow">Facilities</p><h2 className="mt-1 text-base font-bold text-slate-100">Capacity and rates</h2></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {facilities.filter((facility) => isAdmin || facility.isActive).map((facility) => <article key={facility.id} className={`ui-surface p-4 ${!facility.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-3"><span className="ui-icon-tile ui-icon-blue"><CalendarDays className="h-5 w-5" /></span>{isAdmin && <button type="button" onClick={() => editFacility(facility)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-blue-400" aria-label={`Edit ${facility.name}`}><Edit2 className="h-4 w-4" /></button>}</div>
            <h3 className="mt-3 text-sm font-bold text-slate-100">{facility.name}</h3><p className="mt-1 min-h-8 text-xs leading-4 text-slate-500">{facility.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]"><span className="rounded-lg bg-slate-800 px-2 py-1 text-slate-300">{facility.capacity} people</span><span className="rounded-lg bg-blue-950 px-2 py-1 font-bold text-blue-300">{facility.rate}</span></div>
            <p className="mt-3 text-[11px] font-semibold text-slate-500">{facility.guestBookable ? 'Guest booking allowed' : 'Residents only'}{!facility.isActive && ' · Inactive'}</p>
          </article>)}
        </div>
      </section>

      <section className="ui-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2"><Button variant="ghost" className="px-2.5" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></Button><h2 className="min-w-40 text-center text-base font-bold text-slate-100">{monthTitle(month)}</h2><Button variant="ghost" className="px-2.5" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight className="h-5 w-5" /></Button><button type="button" onClick={() => { setMonth(new Date(`${today.slice(0, 7)}-01T00:00:00Z`)); setSelectedDate(today); }} className="ml-1 text-xs font-bold text-blue-400 hover:text-blue-300">Today</button></div>
          <div className="flex flex-wrap gap-2"><label className="relative"><span className="sr-only">Filter by facility</span><SlidersHorizontal className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><select className="ui-input min-w-48 pl-9" value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)}><option value="all">All facilities</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label><div className="flex rounded-xl border border-slate-700 bg-slate-800 p-1"><button type="button" onClick={() => setDisplay('calendar')} className={`rounded-lg px-3 py-2 text-xs font-bold ${display === 'calendar' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><CalendarDays className="inline h-4 w-4 sm:mr-1" /><span className="hidden sm:inline"> Calendar</span></button><button type="button" onClick={() => setDisplay('list')} className={`rounded-lg px-3 py-2 text-xs font-bold ${display === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><List className="inline h-4 w-4 sm:mr-1" /><span className="hidden sm:inline"> List</span></button></div></div>
        </div>

        {display === 'calendar' ? <div className="grid gap-0 xl:grid-cols-[1fr_340px]">
          <div className="overflow-x-auto p-3 sm:p-5">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-7">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600">{day}</div>)}</div>
              <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-slate-800">{days.map((day) => {
                const entries = filteredReservations.filter((reservation) => reservation.date === day.key && reservation.status !== 'cancelled');
                const selected = selectedDate === day.key;
                return <button type="button" key={day.key} onClick={() => { setSelectedDate(day.key); if (!isAdmin && day.key >= today && !isRestricted) openReservation(day.key); }} className={`min-h-24 border-b border-r border-slate-800 p-2 text-left transition hover:bg-slate-800 ${day.currentMonth ? 'bg-slate-900/60' : 'bg-slate-950/60 text-slate-700'} ${selected ? 'ring-2 ring-inset ring-blue-500' : ''}`} aria-label={`${formatDate(day.key)}, ${entries.length} reservation(s)`}><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${day.key === today ? 'bg-blue-600 text-white' : day.currentMonth ? 'text-slate-300' : 'text-slate-700'}`}>{day.date.getUTCDate()}</span><div className="mt-1 space-y-1">{entries.slice(0, 2).map((entry) => <span key={entry.id} className={`block truncate rounded px-1.5 py-1 text-[9px] font-bold ${entry.status === 'approved' ? 'bg-emerald-950 text-emerald-300' : entry.status === 'pending' ? 'bg-amber-950 text-amber-300' : 'bg-red-950 text-red-300'}`}>{facilities.find((facility) => facility.id === entry.facilityId)?.name || 'Facility'}</span>)}{entries.length > 2 && <span className="block text-[9px] font-bold text-slate-500">+{entries.length - 2} more</span>}</div></button>;
              })}</div>
            </div>
            <p className="mobile-table-hint mt-3">Swipe horizontally to view the complete month.</p>
          </div>
          <aside className="border-t border-slate-800 p-4 xl:border-l xl:border-t-0">
            <p className="ui-eyebrow">Selected date</p><h3 className="mt-1 text-base font-bold text-slate-100">{formatDate(selectedDate)}</h3>
            <div className="mt-4 space-y-3">{selectedReservations.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} facilities={facilities} isAdmin={isAdmin} busyId={busyId} setStatus={setStatus} />)}{selectedReservations.length === 0 && <EmptyState icon={CalendarDays} title="No reservations" description="This date is currently clear for the selected facility filter." action={!isAdmin && !isRestricted && selectedDate >= today ? <Button onClick={() => openReservation(selectedDate)}>Request this date</Button> : null} />}</div>
          </aside>
        </div> : <ReservationTable reservations={filteredReservations} facilities={facilities} isAdmin={isAdmin} busyId={busyId} setStatus={setStatus} />}
      </section>

      {showForm && <div className="ui-modal-backdrop"><form onSubmit={handleSubmit} className="ui-modal max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="reservation-form-title">
        <div className="flex items-start justify-between gap-4"><div><p className="ui-eyebrow">Reservation request</p><h2 id="reservation-form-title" className="mt-1 text-xl font-bold text-slate-100">Choose an available schedule</h2><p className="mt-1 text-sm text-slate-400">Your request remains pending until an administrator approves it.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Close reservation form"><X className="h-5 w-5" /></button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label><span className="ui-label">Facility <span className="text-red-400">*</span></span><select required className="ui-input" value={form.facilityId} onChange={(event) => setForm({ ...form, facilityId: event.target.value })}>{facilities.filter((facility) => facility.isActive).map((facility) => <option key={facility.id} value={facility.id}>{facility.name} · {facility.rate}</option>)}</select></label>
          <label><span className="ui-label">Date <span className="text-red-400">*</span></span><input type="date" required min={today} className="ui-input" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
          <label><span className="ui-label">Time slot <span className="text-red-400">*</span></span><select required className="ui-input" value={form.timeSlot} onChange={(event) => setForm({ ...form, timeSlot: event.target.value })}><option value="">Select an available slot</option>{TIME_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select><FieldError>{conflict ? 'This facility and time slot already has an active request.' : ''}</FieldError></label>
          <label><span className="ui-label">Purpose <span className="text-red-400">*</span></span><input required maxLength="255" className="ui-input" value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} placeholder="Birthday, meeting, sports activity…" /></label>
        </div>
        <div className="mt-5 rounded-xl border border-slate-700 bg-slate-800/60 p-4"><p className="text-xs font-bold text-slate-300">Booking reminders</p><ul className="mt-2 space-y-1 text-xs leading-5 text-slate-500"><li>• Pending requests do not guarantee the facility until approved.</li><li>• Contact the office to cancel an approved reservation.</li><li>• The listed facility rate is confirmed during approval.</li></ul></div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Keep editing later</Button><Button type="submit" disabled={Boolean(conflict)}>Submit reservation</Button></div>
      </form></div>}

      {isAdmin && facilityForm && <div className="ui-modal-backdrop"><form onSubmit={handleFacilitySave} className="ui-modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="facility-form-title">
        <div className="flex items-start justify-between"><div><p className="ui-eyebrow">Facility settings</p><h2 id="facility-form-title" className="mt-1 text-xl font-bold text-slate-100">{facilityForm.id ? 'Edit facility' : 'Add facility'}</h2></div><button type="button" onClick={() => setFacilityForm(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Close facility form"><X className="h-5 w-5" /></button></div>
        <div className="mt-5 space-y-4">{[['name', 'Facility name', 'text'], ['capacity', 'Capacity', 'number'], ['rate', 'Rate label', 'text']].map(([key, label, type]) => <label key={key}><span className="ui-label">{label} <span className="text-red-400">*</span></span><input type={type} required min={type === 'number' ? 1 : undefined} className="ui-input" value={facilityForm[key]} onChange={(event) => setFacilityForm({ ...facilityForm, [key]: event.target.value })} /></label>)}<label><span className="ui-label">Description</span><textarea rows="3" className="ui-input resize-none" value={facilityForm.description} onChange={(event) => setFacilityForm({ ...facilityForm, description: event.target.value })} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300"><input type="checkbox" checked={facilityForm.guestBookable} onChange={(event) => setFacilityForm({ ...facilityForm, guestBookable: event.target.checked })} /> Guest bookable</label><label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300"><input type="checkbox" checked={facilityForm.isActive} onChange={(event) => setFacilityForm({ ...facilityForm, isActive: event.target.checked })} /> Active</label></div></div>
        <HelpText>Deactivating a facility hides it from new requests but preserves its reservation history.</HelpText>
        <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setFacilityForm(null)}>Cancel</Button><Button type="submit">Save facility</Button></div>
      </form></div>}
    </div>
  );
};

const ReservationCard = ({ reservation, facilities, isAdmin, busyId, setStatus }) => {
  const facility = facilities.find((item) => item.id === reservation.facilityId);
  return <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-slate-200">{facility?.name || 'Facility'}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{reference(reservation.id)}</p></div>{statusBadge(reservation.status)}</div><p className="mt-2 text-xs text-slate-400">{reservation.timeSlot}</p><p className="mt-1 text-xs text-slate-500">{reservation.requesterName} · {reservation.purpose}</p>{isAdmin && reservation.status === 'pending' && <div className="mt-3 grid grid-cols-2 gap-2"><Button disabled={busyId === `approved-${reservation.id}`} onClick={() => setStatus(reservation.id, 'approved')} className="px-2"><CheckCircle className="h-4 w-4" /> Approve</Button><Button variant="danger" disabled={busyId === `rejected-${reservation.id}`} onClick={() => setStatus(reservation.id, 'rejected')} className="px-2"><XCircle className="h-4 w-4" /> Reject</Button></div>}</article>;
};

const ReservationTable = ({ reservations, facilities, isAdmin, busyId, setStatus }) => <div className="overflow-x-auto"><table data-responsive-table="true" className="w-full min-w-[900px] text-xs"><thead><tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Reference / requester</th><th className="px-5 py-3">Facility</th><th className="px-5 py-3">Schedule</th><th className="px-5 py-3">Purpose</th><th className="px-5 py-3">Status</th>{isAdmin && <th className="px-5 py-3">Actions</th>}</tr></thead><tbody className="divide-y divide-slate-800">{reservations.map((reservation) => <tr key={reservation.id} className="hover:bg-slate-800/50"><td data-label="Requester" className="px-5 py-3"><div className="font-bold text-slate-200">{reservation.requesterName}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{reference(reservation.id)}</div></td><td data-label="Facility" className="px-5 py-3 text-slate-400">{facilities.find((facility) => facility.id === reservation.facilityId)?.name}</td><td data-label="Schedule" className="px-5 py-3 text-slate-400">{formatDate(reservation.date)}<div className="mt-1 text-[10px] text-slate-500">{reservation.timeSlot}</div></td><td data-label="Purpose" className="px-5 py-3 text-slate-400">{reservation.purpose}</td><td data-label="Status" className="px-5 py-3">{statusBadge(reservation.status)}</td>{isAdmin && <td data-label="Actions" className="px-5 py-3">{reservation.status === 'pending' && <div className="flex justify-end gap-2 md:justify-start"><Button disabled={busyId === `approved-${reservation.id}`} onClick={() => setStatus(reservation.id, 'approved')} className="px-3"><CheckCircle className="h-4 w-4" /> Approve</Button><Button variant="danger" disabled={busyId === `rejected-${reservation.id}`} onClick={() => setStatus(reservation.id, 'rejected')} className="px-3"><XCircle className="h-4 w-4" /> Reject</Button></div>}</td>}</tr>)}{reservations.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5}><EmptyState icon={CalendarDays} title="No reservations found" description="Change the facility filter or submit a new request." /></td></tr>}</tbody></table></div>;
