import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileWarning,
  PhilippinePeso,
  Printer,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const MANILA_TIME_ZONE = 'Asia/Manila';
const DAY_MS = 24 * 60 * 60 * 1000;

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const integer = (value) => new Intl.NumberFormat('en-PH').format(Number(value) || 0);

const parseDatabaseTime = (value) => {
  if (!value) return null;
  const normalized = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const manilaDateKey = (value) => {
  const parsed = parseDatabaseTime(value);
  if (!parsed) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const todayInManila = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const shiftDate = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const isWithinRange = (dateKey, from, to) => Boolean(dateKey && (!from || dateKey >= from) && (!to || dateKey <= to));

const hoursBetween = (start, end) => {
  const startDate = parseDatabaseTime(start);
  const endDate = parseDatabaseTime(end);
  if (!startDate || !endDate || endDate < startDate) return null;
  return (endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000);
};

const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const durationLabel = (hours) => {
  if (hours === null || !Number.isFinite(hours)) return 'No completed records';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
};

const monthLabel = (key) => {
  const date = new Date(`${key}-01T00:00:00Z`);
  return new Intl.DateTimeFormat('en-PH', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
};

const csvValue = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadCsv = (filename, sections) => {
  const lines = [];
  sections.forEach((section, index) => {
    if (index > 0) lines.push('');
    lines.push(csvValue(section.title));
    lines.push(section.headers.map(csvValue).join(','));
    section.rows.forEach((row) => lines.push(row.map(csvValue).join(',')));
  });
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const MetricCard = ({ label, value, detail, icon: Icon, tone, definition }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm" title={definition}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-extrabold text-slate-100">{value}</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p>
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const BarRow = ({ label, value, max, display, color = 'bg-blue-500', secondary }) => {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3 text-xs">
        <div className="min-w-0">
          <span className="font-medium text-slate-300">{label}</span>
          {secondary && <span className="ml-2 text-[10px] text-slate-500">{secondary}</span>}
        </div>
        <span className="shrink-0 font-semibold text-slate-200">{display ?? integer(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

const Section = ({ title, description, action, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
      <div>
        <h2 className="text-sm font-bold text-slate-100">{title}</h2>
        {description && <p className="mt-1 text-[11px] text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

export const ReportingDashboard = ({ setActiveView }) => {
  const {
    homeowners,
    reservations,
    dues,
    payments,
    concerns,
    users,
    vehicles,
    stickerRenewals,
    visitorLogs,
    facilities,
    showToast,
  } = useApp();

  const today = todayInManila();
  const [fromDate, setFromDate] = useState(() => shiftDate(today, -89));
  const [toDate, setToDate] = useState(today);

  const report = useMemo(() => {
    const homeownerById = new Map(homeowners.map((homeowner) => [String(homeowner.id), homeowner]));
    const validatedPayments = payments.filter((payment) => (
      payment.validationStatus === 'validated'
      && isWithinRange(manilaDateKey(payment.validatedAt) || String(payment.paymentDate || '').slice(0, 10), fromDate, toDate)
    ));
    const collected = validatedPayments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0);
    const allocated = validatedPayments.reduce((sum, payment) => sum + Number(payment.amountAllocated || 0), 0);
    const outstanding = dues.reduce((sum, due) => sum + Number(due.balanceDue || 0), 0);

    const delinquencyByHomeowner = new Map();
    dues.filter((due) => Number(due.balanceDue) > 0 && Number(due.daysOverdue) > 0).forEach((due) => {
      const id = String(due.homeownerId);
      const homeowner = homeownerById.get(id);
      const current = delinquencyByHomeowner.get(id) || {
        id,
        ownerName: homeowner?.ownerName || 'Unknown homeowner',
        blockLot: homeowner?.blockLot || '—',
        email: homeowner?.email || '',
        balance: 0,
        overdueMonths: 0,
        oldestDueDate: due.dueDate,
        maxDaysOverdue: 0,
        restricted: Boolean(homeowner?.restricted),
      };
      current.balance += Number(due.balanceDue || 0);
      current.overdueMonths += 1;
      current.oldestDueDate = String(due.dueDate) < String(current.oldestDueDate) ? due.dueDate : current.oldestDueDate;
      current.maxDaysOverdue = Math.max(current.maxDaysOverdue, Number(due.daysOverdue || 0));
      delinquencyByHomeowner.set(id, current);
    });
    const delinquentHomeowners = [...delinquencyByHomeowner.values()].sort((left, right) => right.balance - left.balance);

    const agingOrder = ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'];
    const aging = agingOrder.map((bucket) => ({
      label: bucket,
      value: dues.filter((due) => Number(due.balanceDue) > 0 && due.agingBucket === bucket)
        .reduce((sum, due) => sum + Number(due.balanceDue || 0), 0),
    }));

    const collectionMonths = new Map();
    validatedPayments.forEach((payment) => {
      const date = manilaDateKey(payment.validatedAt) || String(payment.paymentDate || '').slice(0, 10);
      const key = date.slice(0, 7);
      if (key) collectionMonths.set(key, (collectionMonths.get(key) || 0) + Number(payment.amountPaid || 0));
    });
    const collectionTrend = [...collectionMonths.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => ({ key, label: monthLabel(key), value }));

    const filteredReservations = reservations.filter((reservation) => isWithinRange(String(reservation.date || '').slice(0, 10), fromDate, toDate));
    const facilityUsage = facilities.map((facility) => {
      const rows = filteredReservations.filter((reservation) => String(reservation.facilityId) === String(facility.id));
      return {
        id: facility.id,
        name: facility.name,
        total: rows.filter((row) => row.status !== 'cancelled').length,
        approved: rows.filter((row) => row.status === 'approved').length,
        pending: rows.filter((row) => row.status === 'pending').length,
        rejected: rows.filter((row) => row.status === 'rejected').length,
      };
    }).sort((left, right) => right.total - left.total);

    const filteredVisitors = visitorLogs.filter((log) => isWithinRange(log.entryDate || manilaDateKey(log.entryTime), fromDate, toDate));
    const visitorDays = new Map();
    filteredVisitors.forEach((log) => {
      const key = log.entryDate || manilaDateKey(log.entryTime);
      visitorDays.set(key, (visitorDays.get(key) || 0) + 1);
    });
    const visitorTrend = [...visitorDays.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-14)
      .map(([key, value]) => ({ key, label: key.slice(5), value }));
    const onSiteVisitors = visitorLogs.filter((log) => !log.exitTime).length;
    const residentPassEntries = filteredVisitors.filter((log) => log.entrySource === 'resident_pass').length;

    const paymentDurations = validatedPayments
      .map((payment) => hoursBetween(payment.createdAt, payment.validatedAt))
      .filter((value) => value !== null);
    const paymentTurnaround = average(paymentDurations);

    const filteredConcerns = concerns.filter((concern) => isWithinRange(manilaDateKey(concern.submittedAt), fromDate, toDate));
    const resolvedConcerns = filteredConcerns.filter((concern) => concern.status === 'resolved' && concern.respondedAt);
    const concernDurations = resolvedConcerns
      .map((concern) => hoursBetween(concern.submittedAt, concern.respondedAt))
      .filter((value) => value !== null);
    const concernTurnaround = average(concernDurations);
    const oldestOpenConcern = concerns
      .filter((concern) => concern.status !== 'resolved')
      .map((concern) => ({ ...concern, age: Math.max(0, (Date.now() - (parseDatabaseTime(concern.submittedAt)?.getTime() || Date.now())) / DAY_MS) }))
      .sort((left, right) => right.age - left.age)[0] || null;

    const pendingTasks = [
      { key: 'users', label: 'User approvals', value: users.filter((user) => user.status === 'pending').length, view: 'user-management' },
      { key: 'payments', label: 'Payment validation', value: payments.filter((payment) => payment.validationStatus === 'pending').length, view: 'dues' },
      { key: 'reservations', label: 'Reservation review', value: reservations.filter((reservation) => reservation.status === 'pending').length, view: 'reservations' },
      { key: 'concerns', label: 'Open concerns', value: concerns.filter((concern) => concern.status !== 'resolved').length, view: 'concerns' },
      { key: 'vehicles', label: 'Vehicle approval', value: vehicles.filter((vehicle) => vehicle.approvalStatus === 'pending').length, view: 'vehicles' },
      { key: 'stickers', label: 'Sticker renewals', value: stickerRenewals.filter((renewal) => renewal.status === 'pending').length, view: 'stickers' },
    ];

    return {
      homeownerById,
      validatedPayments,
      collected,
      allocated,
      outstanding,
      delinquentHomeowners,
      aging,
      collectionTrend,
      facilityUsage,
      filteredVisitors,
      visitorTrend,
      onSiteVisitors,
      residentPassEntries,
      paymentTurnaround,
      paymentDurations,
      filteredConcerns,
      concernTurnaround,
      concernDurations,
      oldestOpenConcern,
      pendingTasks,
      pendingTaskTotal: pendingTasks.reduce((sum, task) => sum + task.value, 0),
    };
  }, [concerns, dues, facilities, fromDate, homeowners, payments, reservations, stickerRenewals, toDate, users, vehicles, visitorLogs]);

  const applyRange = (days) => {
    setToDate(today);
    setFromDate(days ? shiftDate(today, -(days - 1)) : '');
  };

  const exportReport = () => {
    const rangeLabel = `${fromDate || 'all'}-to-${toDate || 'all'}`;
    downloadCsv(`novalink-reports-${rangeLabel}.csv`, [
      {
        title: 'Overview',
        headers: ['Metric', 'Value'],
        rows: [
          ['Date from', fromDate || 'All records'],
          ['Date to', toDate || 'Latest'],
          ['Validated collections', report.collected.toFixed(2)],
          ['Allocated to dues', report.allocated.toFixed(2)],
          ['Current outstanding balance', report.outstanding.toFixed(2)],
          ['Delinquent homeowners', report.delinquentHomeowners.length],
          ['Pending admin tasks', report.pendingTaskTotal],
          ['Visitor entries', report.filteredVisitors.length],
          ['Average payment validation hours', report.paymentTurnaround?.toFixed(2) || ''],
          ['Average concern resolution hours', report.concernTurnaround?.toFixed(2) || ''],
        ],
      },
      {
        title: 'Validated payments',
        headers: ['Homeowner', 'Block/Lot', 'Reference', 'Amount paid', 'Allocated', 'Unallocated', 'Payment date', 'Submitted at', 'Validated at', 'Turnaround hours', 'Validator'],
        rows: report.validatedPayments.map((payment) => [
          payment.homeownerName || report.homeownerById.get(String(payment.homeownerId))?.ownerName || '',
          payment.blockLot || report.homeownerById.get(String(payment.homeownerId))?.blockLot || '',
          payment.paymentReference,
          Number(payment.amountPaid || 0).toFixed(2),
          Number(payment.amountAllocated || 0).toFixed(2),
          Number(payment.unallocatedAmount || 0).toFixed(2),
          payment.paymentDate,
          payment.createdAt,
          payment.validatedAt,
          hoursBetween(payment.createdAt, payment.validatedAt)?.toFixed(2) || '',
          payment.validatorName || '',
        ]),
      },
      {
        title: 'Delinquent homeowners',
        headers: ['Homeowner', 'Block/Lot', 'Email', 'Overdue months', 'Outstanding balance', 'Oldest due date', 'Days overdue', 'Restricted'],
        rows: report.delinquentHomeowners.map((homeowner) => [
          homeowner.ownerName,
          homeowner.blockLot,
          homeowner.email,
          homeowner.overdueMonths,
          homeowner.balance.toFixed(2),
          homeowner.oldestDueDate,
          homeowner.maxDaysOverdue,
          homeowner.restricted ? 'Yes' : 'No',
        ]),
      },
      {
        title: 'Facility usage',
        headers: ['Facility', 'Total requests', 'Approved', 'Pending', 'Rejected'],
        rows: report.facilityUsage.map((facility) => [facility.name, facility.total, facility.approved, facility.pending, facility.rejected]),
      },
      {
        title: 'Visitor activity',
        headers: ['Visitor', 'Contact', 'Destination', 'Entry date', 'Entry time', 'Exit time', 'Source', 'Host'],
        rows: report.filteredVisitors.map((log) => [
          log.visitorName,
          log.contactNumber,
          log.destinationAddress,
          log.entryDate || manilaDateKey(log.entryTime),
          log.entryTimeDisplay || log.entryTime,
          log.exitTimeDisplay || '',
          log.entrySource === 'resident_pass' ? 'Resident pass' : 'Gate entry',
          log.hostName || '',
        ]),
      },
      {
        title: 'Concern resolution',
        headers: ['Type', 'Subject', 'Status', 'Submitted at', 'Responded at', 'Resolution hours'],
        rows: report.filteredConcerns.map((concern) => [
          concern.concernType,
          concern.subject,
          concern.status,
          concern.submittedAt,
          concern.respondedAt || '',
          hoursBetween(concern.submittedAt, concern.respondedAt)?.toFixed(2) || '',
        ]),
      },
    ]);
    showToast('Filtered report exported successfully.', 'success');
  };

  const maxCollection = Math.max(0, ...report.collectionTrend.map((item) => item.value));
  const maxAging = Math.max(0, ...report.aging.map((item) => item.value));
  const maxFacility = Math.max(0, ...report.facilityUsage.map((item) => item.total));
  const maxVisitorDay = Math.max(0, ...report.visitorTrend.map((item) => item.value));
  const maxPending = Math.max(0, ...report.pendingTasks.map((item) => item.value));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Reporting Dashboard</h1>
          <p className="mt-1 text-xs text-slate-500">Operational, collection, service, and security indicators for administrators</p>
        </div>
        <div className="no-print flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700"><Printer className="h-4 w-4" /> Print</button><button type="button" onClick={exportReport} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500"><Download className="h-4 w-4" /> Export filtered report</button></div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          From
          <input type="date" value={fromDate} max={toDate || today} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 outline-none focus:border-blue-500" />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          To
          <input type="date" value={toDate} min={fromDate || undefined} max={today} onChange={(event) => setToDate(event.target.value)} className="mt-1 block rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 outline-none focus:border-blue-500" />
        </label>
        <div className="flex flex-wrap gap-2">
          {[30, 90, 365].map((days) => (
            <button key={days} type="button" onClick={() => applyRange(days)} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-600 hover:text-white">
              {days === 365 ? '1 year' : `${days} days`}
            </button>
          ))}
          <button type="button" onClick={() => applyRange(null)} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-600 hover:text-white">All time</button>
          <button type="button" onClick={() => applyRange(90)} title="Reset to 90 days" className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-400 transition hover:text-white"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <p className="ml-auto text-[10px] text-slate-600">Balances and pending tasks are current snapshots; activity metrics follow the selected dates.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Validated collections" value={money(report.collected)} detail={`${report.validatedPayments.length} payment(s) in range · ${money(report.allocated)} allocated`} icon={PhilippinePeso} tone="bg-emerald-950 text-emerald-400" definition="Validated payments whose validation date falls inside the selected period." />
        <MetricCard label="Outstanding dues" value={money(report.outstanding)} detail={`${report.delinquentHomeowners.length} homeowner(s) currently overdue`} icon={FileWarning} tone="bg-red-950 text-red-400" definition="Current unpaid dues and penalties after validated payment allocations. This is a live snapshot, not date-filtered." />
        <MetricCard label="Pending admin tasks" value={integer(report.pendingTaskTotal)} detail="Approvals, validation, matching, and open concerns" icon={AlertTriangle} tone="bg-amber-950 text-amber-400" definition="Current work awaiting an administrator across all management modules." />
        <MetricCard label="Visitor entries" value={integer(report.filteredVisitors.length)} detail={`${report.onSiteVisitors} currently on site · ${report.residentPassEntries} via resident pass`} icon={Users} tone="bg-blue-950 text-blue-400" definition="Gate entries recorded inside the selected date period." />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Collections versus outstanding dues" description="Validated payments in the selected period compared with the current receivable balance">
          <div className="space-y-5 p-5">
            <BarRow label="Validated collections" value={report.collected} max={Math.max(report.collected, report.outstanding)} display={money(report.collected)} color="bg-emerald-500" />
            <BarRow label="Current outstanding" value={report.outstanding} max={Math.max(report.collected, report.outstanding)} display={money(report.outstanding)} color="bg-red-500" />
            <div className="border-t border-slate-800 pt-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Outstanding balance aging</p>
              <div className="space-y-3">
                {report.aging.map((item) => <BarRow key={item.label} label={item.label} value={item.value} max={maxAging} display={money(item.value)} color={item.label === '90+ days' ? 'bg-red-500' : item.label === 'Current' ? 'bg-blue-500' : 'bg-amber-500'} />)}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Collection trend" description="Validated payment totals grouped by validation month">
          <div className="space-y-3 p-5">
            {report.collectionTrend.map((item) => <BarRow key={item.key} label={item.label} value={item.value} max={maxCollection} display={money(item.value)} color="bg-emerald-500" />)}
            {report.collectionTrend.length === 0 && <p className="py-10 text-center text-xs text-slate-500">No validated payments in this date range.</p>}
          </div>
        </Section>
      </div>

      <Section
        title="Delinquent homeowners"
        description="Homeowners with a positive balance past its due date, ranked by outstanding amount"
        action={<button type="button" onClick={() => setActiveView('dues')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300">Open dues management <ArrowRight className="h-3.5 w-3.5" /></button>}
      >
        <div className="overflow-x-auto">
          <table data-responsive-table="true" className="w-full min-w-[850px] text-xs">
            <thead><tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Homeowner</th><th className="px-5 py-3">Block / Lot</th><th className="px-5 py-3 text-right">Overdue months</th><th className="px-5 py-3">Oldest due</th><th className="px-5 py-3">Aging</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3">Access</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {report.delinquentHomeowners.slice(0, 15).map((homeowner) => (
                <tr key={homeowner.id} className="hover:bg-slate-800/40"><td data-label="Homeowner" className="px-5 py-3 font-semibold text-slate-200">{homeowner.ownerName}<p className="mt-0.5 text-[11px] font-normal text-slate-500">{homeowner.email}</p></td><td data-label="Block / lot" className="px-5 py-3 text-slate-400">{homeowner.blockLot}</td><td data-label="Overdue months" className="px-5 py-3 text-right text-slate-300">{homeowner.overdueMonths}</td><td data-label="Oldest due" className="px-5 py-3 text-slate-400">{homeowner.oldestDueDate}</td><td data-label="Aging" className="px-5 py-3 text-slate-400">{homeowner.maxDaysOverdue} days</td><td data-label="Balance" className="px-5 py-3 text-right font-bold text-red-300">{money(homeowner.balance)}</td><td data-label="Access" className="px-5 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${homeowner.restricted ? 'bg-red-950 text-red-300' : 'bg-slate-800 text-slate-400'}`}>{homeowner.restricted ? 'Restricted' : 'Active'}</span></td></tr>
              ))}
              {report.delinquentHomeowners.length === 0 && <tr><td colSpan="7" className="py-10 text-center text-slate-500">No delinquent homeowners. All overdue balances are clear.</td></tr>}
            </tbody>
          </table>
        </div>
        {report.delinquentHomeowners.length > 15 && <p className="border-t border-slate-800 px-5 py-3 text-[10px] text-slate-500">Showing the 15 highest balances. The CSV export includes all {report.delinquentHomeowners.length} records.</p>}
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Section title="Facility usage" description="Non-cancelled reservation requests in the selected period">
          <div className="space-y-4 p-5">
            {report.facilityUsage.map((facility) => <BarRow key={facility.id} label={facility.name} value={facility.total} max={maxFacility} secondary={`${facility.approved} approved · ${facility.pending} pending`} color="bg-violet-500" />)}
            {report.facilityUsage.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No facilities configured.</p>}
          </div>
        </Section>

        <Section title="Visitor activity" description="Latest 14 active days within the selected period">
          <div className="space-y-3 p-5">
            {report.visitorTrend.map((item) => <BarRow key={item.key} label={item.label} value={item.value} max={maxVisitorDay} color="bg-blue-500" />)}
            {report.visitorTrend.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No visitor entries in this date range.</p>}
            <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 text-center"><div className="rounded-xl bg-slate-800 p-3"><p className="text-lg font-bold text-slate-100">{report.residentPassEntries}</p><p className="text-[10px] text-slate-500">Resident passes</p></div><div className="rounded-xl bg-slate-800 p-3"><p className="text-lg font-bold text-slate-100">{report.filteredVisitors.length - report.residentPassEntries}</p><p className="text-[10px] text-slate-500">Gate entries</p></div></div>
          </div>
        </Section>

        <Section title="Pending admin tasks" description="Current queue across administrative modules">
          <div className="space-y-3 p-5">
            {report.pendingTasks.map((task) => (
              <button key={task.key} type="button" onClick={() => setActiveView(task.view)} className="block w-full text-left">
                <BarRow label={task.label} value={task.value} max={maxPending} color={task.value > 0 ? 'bg-amber-500' : 'bg-slate-600'} />
              </button>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Payment validation turnaround" description="Time from payment submission to administrator validation">
          <div className="flex items-center gap-5 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-950 text-emerald-400"><CreditCard className="h-7 w-7" /></div>
            <div><p className="text-3xl font-extrabold text-slate-100">{durationLabel(report.paymentTurnaround)}</p><p className="mt-1 text-xs text-slate-500">Average across {report.paymentDurations.length} validated payment(s) in range</p></div>
          </div>
        </Section>
        <Section title="Concern-resolution time" description="Time from resident submission to the recorded official response">
          <div className="flex items-center gap-5 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-950 text-cyan-400"><Clock3 className="h-7 w-7" /></div>
            <div className="min-w-0"><p className="text-3xl font-extrabold text-slate-100">{durationLabel(report.concernTurnaround)}</p><p className="mt-1 text-xs text-slate-500">Average across {report.concernDurations.length} resolved concern(s) in range</p>{report.oldestOpenConcern && <p className="mt-2 truncate text-[10px] text-amber-400">Oldest open: {report.oldestOpenConcern.subject} · {Math.floor(report.oldestOpenConcern.age)} days</p>}</div>
          </div>
        </Section>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-blue-900/60 bg-blue-950/30 p-4 text-xs text-blue-200">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <p>Reports use the same administrator-authorized state as the management screens. Exported CSV files include the full filtered detail while this dashboard limits long tables for readability.</p>
      </div>
    </div>
  );
};
