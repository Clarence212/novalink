// hey reader! dues summary charts for the admin — backlog #23
import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, Users, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react';

// simple css-based progress bar chart — no external library needed
const ProgressBar = ({ value, max, color = 'bg-blue-500', label, sublabel }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-slate-400">{value} <span className="text-slate-600">/ {max}</span></span>
      </div>
      <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {sublabel && <div className="text-[10px] text-slate-500">{sublabel}</div>}
    </div>
  );
};

// donut chart using SVG — pure CSS/SVG, no chart library
const DonutChart = ({ segments, size = 120, thickness = 24 }) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let offset = 0;
  const paths = segments.map((seg, i) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const path = (
      <circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={seg.color}
        strokeWidth={thickness}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    );
    offset += dash;
    return path;
  });

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {/* background circle */}
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={thickness} />
      {paths}
    </svg>
  );
};

export const DuesSummaryCharts = () => {
  const { homeowners, dues, payments } = useApp();

  const stats = useMemo(() => {
    const totalHomeowners = homeowners.length;
    const paidHomeowners = homeowners.filter(h => h.unpaidMonths === 0).length;
    const unpaidHomeowners = homeowners.filter(h => h.unpaidMonths > 0).length;
    const restrictedHomeowners = homeowners.filter(h => h.restricted).length;

    const totalDues = dues.length;
    const paidDues = dues.filter(d => d.status === 'paid').length;
    const unpaidDues = dues.filter(d => d.status === 'unpaid').length;

    const totalCollected = payments
      .filter(p => p.validationStatus === 'validated')
      .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    const totalPending = payments
      .filter(p => p.validationStatus === 'pending')
      .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    const totalPenalties = dues
      .filter(d => d.status === 'unpaid')
      .reduce((sum, d) => sum + (d.penaltyAmount || 0), 0);

    // monthly collection breakdown: group paid dues by billing month
    const monthlyCollection = {};
    dues
      .filter(d => d.status === 'paid')
      .forEach(d => {
        const month = d.billingMonth || 'Unknown';
        monthlyCollection[month] = (monthlyCollection[month] || 0) + (d.amountDue || 0);
      });

    return {
      totalHomeowners, paidHomeowners, unpaidHomeowners, restrictedHomeowners,
      totalDues, paidDues, unpaidDues,
      totalCollected, totalPending, totalPenalties,
      monthlyCollection
    };
  }, [homeowners, dues, payments]);

  const donutSegments = [
    { value: stats.paidHomeowners, color: '#10b981', label: 'Good Standing' },
    { value: stats.unpaidHomeowners - stats.restrictedHomeowners, color: '#f59e0b', label: 'With Unpaid Dues' },
    { value: stats.restrictedHomeowners, color: '#ef4444', label: 'Restricted' },
  ].filter(s => s.value > 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Dues & Collection Summary</h2>
        <p className="text-xs text-slate-500 mt-0.5">Overview of payment collection, overdue accounts, and pending balances</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Collected', value: `₱${stats.totalCollected.toLocaleString()}`, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-800/50' },
          { label: 'Pending Validation', value: `₱${stats.totalPending.toLocaleString()}`, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-900/30 border-amber-800/50' },
          { label: 'Total Penalties', value: `₱${stats.totalPenalties.toLocaleString()}`, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-900/30 border-red-800/50' },
          { label: 'Overdue Accounts', value: stats.unpaidHomeowners, icon: Users, color: 'text-slate-300', bg: 'bg-slate-800 border-slate-700' },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`p-4 rounded-2xl border ${kpi.bg} space-y-1`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${kpi.color}`} />
                <div className="text-[10px] text-slate-500">{kpi.label}</div>
              </div>
              <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
            </div>
          );
        })}
      </div>

      {/* Account Standing + Dues Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* donut: homeowner standing */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-200 mb-4">Homeowner Account Standing</h3>
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <DonutChart segments={donutSegments} size={120} thickness={22} />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <div className="text-xl font-bold text-slate-100">{stats.totalHomeowners}</div>
                <div className="text-[9px] text-slate-500">Total</div>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              {[
                { label: 'Good Standing', value: stats.paidHomeowners, color: 'bg-emerald-500' },
                { label: 'With Unpaid Dues', value: stats.unpaidHomeowners - stats.restrictedHomeowners, color: 'bg-amber-500' },
                { label: 'Restricted', value: stats.restrictedHomeowners, color: 'bg-red-500' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.color}`} />
                  <span className="text-slate-400 flex-1">{item.label}</span>
                  <span className="font-bold text-slate-200">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* bar chart: dues status */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-200 mb-5">Dues Payment Status</h3>
          <div className="space-y-4">
            <ProgressBar
              value={stats.paidDues}
              max={stats.totalDues}
              color="bg-emerald-500"
              label="Paid Months"
              sublabel={`${stats.totalDues > 0 ? Math.round((stats.paidDues / stats.totalDues) * 100) : 0}% collection rate`}
            />
            <ProgressBar
              value={stats.unpaidDues}
              max={stats.totalDues}
              color="bg-red-500"
              label="Unpaid Months"
              sublabel={`${stats.unpaidDues} month(s) still outstanding`}
            />
            <ProgressBar
              value={payments.filter(p => p.validationStatus === 'pending').length}
              max={payments.length || 1}
              color="bg-amber-500"
              label="Pending Proof Validation"
              sublabel={`${payments.filter(p => p.validationStatus === 'validated').length} already validated`}
            />
          </div>
        </div>
      </div>

      {/* Monthly Collection Breakdown */}
      {Object.keys(stats.monthlyCollection).length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-200 mb-4">Monthly Collection Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(stats.monthlyCollection)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, amount]) => {
                const maxAmount = Math.max(...Object.values(stats.monthlyCollection));
                const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                return (
                  <div key={month} className="flex items-center gap-3">
                    <div className="text-xs text-slate-400 w-32 shrink-0">{month}</div>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs font-semibold text-slate-300 w-24 text-right">₱{amount.toLocaleString()}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {Object.keys(stats.monthlyCollection).length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm bg-slate-800 border border-slate-700 rounded-2xl">
          No validated payment data to display yet.
        </div>
      )}
    </div>
  );
};
