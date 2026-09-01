import React, { useMemo, useState } from 'react';
import {
  CheckCircle, Clock3, Edit2, History, KeyRound, LockOpen, MailCheck,
  Search, ShieldAlert, UserCheck, UserPlus, UserX, X, XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConfirmDialog, EmptyState } from '../components/ui/Primitives';

const statusBadge = (status) => {
  const styles = {
    active: 'bg-emerald-900/60 text-emerald-400',
    pending: 'bg-amber-900/60 text-amber-400',
    rejected: 'bg-red-900/60 text-red-400',
    inactive: 'bg-slate-700 text-slate-400',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold capitalize ${styles[status] || styles.inactive}`}>{status}</span>;
};

const roleBadge = (role) => {
  const styles = {
    admin: 'bg-violet-900/60 text-violet-400',
    security: 'bg-sky-900/60 text-sky-400',
    resident: 'bg-blue-900/60 text-blue-400',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold capitalize ${styles[role] || 'bg-slate-700 text-slate-400'}`}>{role}</span>;
};

const parseUtc = (value) => {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const parsed = parseUtc(value);
  return parsed ? parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';
};

const isLocked = (user) => {
  const lockedUntil = parseUtc(user.lockedUntil);
  return Boolean(lockedUntil && lockedUntil.getTime() > Date.now());
};

const HISTORY_LABELS = {
  'auth.login': 'Signed in successfully',
  'auth.password_change': 'Changed password',
  'auth.password_reset': 'Reset password',
  'user.create': 'Account created by an administrator',
  'user.register': 'Resident registration submitted',
  'user.status': 'Account approval/status changed',
  'user.update': 'Account details or role changed',
  'user.unlock': 'Account unlocked',
  'user.force_password_reset': 'Password change required by administrator',
  'user.verification_resent': 'Verification email resent',
  'user.email_verified': 'Account email verified',
  'user.homeowner_linked': 'Linked to a homeowner record',
};

const historyDetail = (entry) => {
  if (entry.action === 'user.status' && entry.after?.status) return `New status: ${entry.after.status}`;
  if (entry.action === 'user.update' && entry.after?.role) return `Role: ${entry.after.role}`;
  if (entry.action === 'auth.login' && entry.ipAddress) return `IP: ${entry.ipAddress}`;
  return '';
};

const ActionButton = ({ children, className = '', ...props }) => (
  <button
    type="button"
    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-[10px] font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const UserManagement = () => {
  const {
    users, homeowners, currentUser, createUserAccount, approveUser, rejectUser,
    deactivateUser, reactivateUser, editUser, unlockUser, forceUserPasswordReset,
    resendUserVerification,
  } = useApp();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [historyUser, setHistoryUser] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [roleChangeConfirmed, setRoleChangeConfirmed] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationReason, setConfirmationReason] = useState('');
  const [newUserData, setNewUserData] = useState({
    fullName: '', email: '', password: '', role: 'admin', homeownerId: '',
  });
  const [editData, setEditData] = useState({ fullName: '', email: '', role: 'resident', homeownerId: '' });

  const withBusy = async (key, operation) => {
    if (busyAction) return { success: false };
    setBusyAction(key);
    try {
      return await operation();
    } finally {
      setBusyAction('');
    }
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    if (!newUserData.fullName || !newUserData.email) return;
    const result = await withBusy('create', () => createUserAccount(newUserData));
    if (result.success) {
      setNewUserData({ fullName: '', email: '', password: '', role: 'admin', homeownerId: '' });
      setShowCreateModal(false);
    }
  };

  const handleEditOpen = (user) => {
    setEditingUser(user);
    setRoleChangeConfirmed(false);
    setEditData({ fullName: user.fullName, email: user.email, role: user.role, homeownerId: user.homeownerId || '' });
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    const changed = editData.role !== editingUser.role;
    const linkChanged = editData.role === 'resident' && (editData.homeownerId || '') !== (editingUser.homeownerId || '');
    if ((changed || linkChanged) && !roleChangeConfirmed) return;
    const result = await withBusy(`edit-${editingUser.id}`, () => editUser(editingUser.id, {
      ...editData,
      confirmRoleChange: changed && roleChangeConfirmed,
      confirmAccessChange: linkChanged && roleChangeConfirmed,
    }));
    if (result.success) setEditingUser(null);
  };

  const requestConfirmation = (config) => {
    setConfirmationReason('');
    setConfirmation(config);
  };

  const runConfirmedAction = async () => {
    if (!confirmation) return;
    const result = await withBusy(confirmation.key, () => confirmation.operation(confirmationReason.trim()));
    if (result?.success) setConfirmation(null);
  };

  const filtered = useMemo(() => users.filter((user) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle
      || (user.fullName || '').toLowerCase().includes(needle)
      || (user.email || '').toLowerCase().includes(needle)
      || (user.role || '').toLowerCase().includes(needle);
    const matchesStatus = filterStatus === 'all'
      || user.status === filterStatus
      || (filterStatus === 'locked' && isLocked(user));
    return matchesSearch && matchesStatus;
  }), [filterStatus, search, users]);

  const pendingCount = users.filter((user) => user.status === 'pending').length;
  const lockedCount = users.filter(isLocked).length;
  const unverifiedCount = users.filter((user) => !user.emailVerified).length;
  const roleChanged = Boolean(editingUser && editData.role !== editingUser.role);
  const homeownerChanged = Boolean(
    editingUser
    && editData.role === 'resident'
    && (editData.homeownerId || '') !== (editingUser.homeownerId || ''),
  );
  const accessChanged = roleChanged || homeownerChanged;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Account Administration</h2>
          <p className="text-xs text-slate-500 mt-0.5">Approvals, access, verification, password controls, roles, and account history</p>
        </div>
        <button type="button" onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition">
          <UserPlus className="w-4 h-4" /> Create System Account
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: 'Pending approval', value: pendingCount, icon: Clock3, color: 'text-amber-400' },
          { label: 'Currently locked', value: lockedCount, icon: ShieldAlert, color: 'text-red-400' },
          { label: 'Email unverified', value: unverifiedCount, icon: MailCheck, color: 'text-sky-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${color}`} />
            <div><p className="text-lg font-bold text-slate-100">{value}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3 flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700">
          <Search className="w-4 h-4 text-slate-500" />
          <input type="search" placeholder="Search by name, email, or role..." value={search} onChange={(event) => setSearch(event.target.value)} className="flex-1 bg-transparent text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'pending', 'active', 'inactive', 'rejected', 'locked'].map((status) => (
            <button type="button" key={status} onClick={() => setFilterStatus(status)} className={`px-3 py-2 rounded-xl text-xs font-medium transition capitalize ${filterStatus === status ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}>{status}</button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden overflow-x-auto">
        <table data-responsive-table="true" className="w-full text-xs min-w-[1080px]">
          <thead><tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700"><th className="px-5 py-3">Account</th><th className="px-5 py-3">Access</th><th className="px-5 py-3">Security</th><th className="px-5 py-3">Recent activity</th><th className="px-5 py-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map((user) => {
              const locked = isLocked(user);
              const rowBusy = busyAction.endsWith(user.id);
              return (
                <tr key={user.id} className="hover:bg-slate-700/30 transition align-top">
                  <td data-label="Account" className="px-5 py-4"><p className="font-medium text-slate-200">{user.fullName}</p><p className="text-slate-500 mt-1">{user.email}</p><div className="flex gap-1.5 mt-2">{roleBadge(user.role)}{statusBadge(user.status)}</div></td>
                  <td data-label="Access" className="px-5 py-4 text-slate-400 space-y-1.5"><p>{user.homeownerId ? 'Linked homeowner' : user.role === 'resident' ? 'Unlinked resident' : 'Personnel account'}</p><p>Approved: {formatDateTime(user.approvedAt)}</p>{user.approvedByName && <p className="text-slate-500">By {user.approvedByName}</p>}</td>
                  <td data-label="Security" className="px-5 py-4 space-y-1.5"><p className={user.emailVerified ? 'text-emerald-400' : 'text-amber-400'}>{user.emailVerified ? 'Email verified' : 'Email verification required'}</p>{locked ? <p className="text-red-400">Locked until {formatDateTime(user.lockedUntil)}</p> : <p className="text-slate-500">Failed attempts: {user.failedLoginAttempts || 0}</p>}{user.forcePasswordChange && <p className="text-amber-400">Password change required</p>}</td>
                  <td data-label="Recent activity" className="px-5 py-4 text-slate-400 space-y-1.5"><p>Last login: {formatDateTime(user.lastLoginAt)}</p><p>Created: {formatDateTime(user.createdAt)}</p></td>
                  <td data-label="Actions" className="px-5 py-4">
                    <div className="flex gap-1.5 flex-wrap max-w-[360px]">
                      {user.status === 'pending' && <><ActionButton disabled={rowBusy} onClick={() => withBusy(`approve-${user.id}`, () => approveUser(user.id))} className="bg-emerald-600/70 hover:bg-emerald-600"><CheckCircle className="w-3 h-3" /> Approve</ActionButton><ActionButton disabled={rowBusy} onClick={() => requestConfirmation({ key: `reject-${user.id}`, title: `Reject ${user.fullName}?`, description: 'This account will not be able to sign in or complete registration.', impact: 'The decision is reversible by reactivating the account, and the reason is recorded in its audit history.', confirmLabel: 'Reject account', requireReason: true, operation: (reason) => rejectUser(user.id, reason) })} className="bg-red-600/70 hover:bg-red-600"><XCircle className="w-3 h-3" /> Reject</ActionButton></>}
                      <ActionButton disabled={rowBusy} onClick={() => handleEditOpen(user)} className="bg-blue-600/70 hover:bg-blue-600"><Edit2 className="w-3 h-3" /> Edit</ActionButton>
                      {user.status === 'active' && user.id !== currentUser?.id && <ActionButton disabled={rowBusy} onClick={() => requestConfirmation({ key: `deactivate-${user.id}`, title: `Deactivate ${user.fullName}?`, description: 'The account will lose access immediately.', impact: 'Existing records remain intact. An administrator can reactivate the account later.', confirmLabel: 'Deactivate account', requireReason: true, operation: (reason) => deactivateUser(user.id, reason) })} className="bg-slate-600 hover:bg-slate-500"><UserX className="w-3 h-3" /> Deactivate</ActionButton>}
                      {(user.status === 'inactive' || user.status === 'rejected') && <ActionButton disabled={rowBusy} onClick={() => withBusy(`reactivate-${user.id}`, () => reactivateUser(user.id))} className="bg-emerald-600/70 hover:bg-emerald-600"><UserCheck className="w-3 h-3" /> Reactivate</ActionButton>}
                      {!user.emailVerified && <ActionButton disabled={rowBusy} onClick={() => withBusy(`verify-${user.id}`, () => resendUserVerification(user.id))} className="bg-sky-600/70 hover:bg-sky-600"><MailCheck className="w-3 h-3" /> Resend verification</ActionButton>}
                      {(locked || user.failedLoginAttempts > 0) && <ActionButton disabled={rowBusy} onClick={() => withBusy(`unlock-${user.id}`, () => unlockUser(user.id))} className="bg-emerald-700 hover:bg-emerald-600"><LockOpen className="w-3 h-3" /> Unlock</ActionButton>}
                      {user.id !== currentUser?.id && user.status !== 'rejected' && <ActionButton disabled={rowBusy || user.forcePasswordChange} onClick={() => requestConfirmation({ key: `reset-${user.id}`, title: `Require a password change for ${user.fullName}?`, description: 'The user can continue only after setting a new private password at their next sign-in.', impact: 'This does not reveal or replace the current password.', confirmLabel: 'Require password change', tone: 'warning', operation: () => forceUserPasswordReset(user.id) })} className="bg-amber-700 hover:bg-amber-600"><KeyRound className="w-3 h-3" /> Force reset</ActionButton>}
                      <ActionButton disabled={rowBusy} onClick={() => setHistoryUser(user)} className="bg-violet-700/80 hover:bg-violet-600"><History className="w-3 h-3" /> History</ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={5}><EmptyState title="No accounts match these filters" description="Try clearing the status filter or searching with a different name or email." /></td></tr>}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setShowCreateModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            <div><h3 className="text-lg font-bold text-slate-100 flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-400" /> Create System Account</h3><p className="text-xs text-slate-400 mt-1">The initial password must be shared privately and changed at first sign-in.</p></div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <label className="block text-xs font-semibold text-slate-300">Account Role<select value={newUserData.role} onChange={(event) => setNewUserData({ ...newUserData, role: event.target.value, homeownerId: event.target.value === 'resident' ? newUserData.homeownerId : '' })} className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"><option value="admin">NHAI Administrator</option><option value="security">Security Personnel</option><option value="resident">Resident Homeowner</option></select></label>
              {newUserData.role === 'resident' && <label className="block text-xs font-semibold text-slate-300">Homeowner Record<select required value={newUserData.homeownerId} onChange={(event) => setNewUserData({ ...newUserData, homeownerId: event.target.value })} className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"><option value="">Select an unlinked homeowner</option>{homeowners.filter((homeowner) => !homeowner.userId).map((homeowner) => <option key={homeowner.id} value={homeowner.id}>{homeowner.ownerName} — {homeowner.blockLot}</option>)}</select></label>}
              <label className="block text-xs font-semibold text-slate-300">Full Name<input type="text" required value={newUserData.fullName} onChange={(event) => setNewUserData({ ...newUserData, fullName: event.target.value })} className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500" /></label>
              <label className="block text-xs font-semibold text-slate-300">Email Address<input type="email" required value={newUserData.email} onChange={(event) => setNewUserData({ ...newUserData, email: event.target.value })} className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500" /></label>
              <label className="block text-xs font-semibold text-slate-300">Initial Password<input type="password" required minLength={12} maxLength={128} pattern="(?=.*[A-Za-z])(?=.*\d).{12,128}" autoComplete="new-password" value={newUserData.password} onChange={(event) => setNewUserData({ ...newUserData, password: event.target.value })} className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500" /></label>
              <div className="pt-2 flex gap-3"><button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700">Cancel</button><button type="submit" disabled={busyAction === 'create'} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold">Create Account</button></div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setEditingUser(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            <div><h3 className="text-lg font-bold text-slate-100 flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-400" /> Edit Account</h3><p className="text-xs text-slate-400 mt-1">Update {editingUser.fullName}</p></div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <label className="block text-xs font-semibold text-slate-300">Role<select value={editData.role} onChange={(event) => { setEditData({ ...editData, role: event.target.value, homeownerId: event.target.value === 'resident' ? editData.homeownerId : '' }); setRoleChangeConfirmed(false); }} className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"><option value="admin">NHAI Administrator</option><option value="security">Security Personnel</option><option value="resident">Resident Homeowner</option></select></label>
              {editData.role === 'resident' && <label className="block text-xs font-semibold text-slate-300">Homeowner Record<select required value={editData.homeownerId} onChange={(event) => { setEditData({ ...editData, homeownerId: event.target.value }); setRoleChangeConfirmed(false); }} className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"><option value="">Select a homeowner</option>{homeowners.filter((homeowner) => !homeowner.userId || homeowner.userId === editingUser.id).map((homeowner) => <option key={homeowner.id} value={homeowner.id}>{homeowner.ownerName} — {homeowner.blockLot}</option>)}</select></label>}
              <label className="block text-xs font-semibold text-slate-300">Full Name<input type="text" required value={editData.fullName} onChange={(event) => setEditData({ ...editData, fullName: event.target.value })} className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500" /></label>
              <label className="block text-xs font-semibold text-slate-300">Email Address<input type="email" required value={editData.email} onChange={(event) => setEditData({ ...editData, email: event.target.value })} className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500" /></label>
              {accessChanged && <label className="flex gap-3 p-3 rounded-xl border border-amber-700/60 bg-amber-950/30 text-xs text-amber-200"><input type="checkbox" checked={roleChangeConfirmed} onChange={(event) => setRoleChangeConfirmed(event.target.checked)} className="mt-0.5" /><span>I confirm this access change. {roleChanged && <>The role will change from <strong>{editingUser.role}</strong> to <strong>{editData.role}</strong>. </>}{homeownerChanged && <>The linked homeowner record will change. </>}Permissions and resident data access may change immediately.</span></label>}
              <div className="pt-2 flex gap-3"><button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700">Cancel</button><button type="submit" disabled={(accessChanged && !roleChangeConfirmed) || busyAction === `edit-${editingUser.id}`} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold">Save Changes</button></div>
            </form>
          </div>
        </div>
      )}

      {historyUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-2xl space-y-5 shadow-2xl relative max-h-[88vh] overflow-y-auto">
            <button type="button" onClick={() => setHistoryUser(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            <div><h3 className="text-lg font-bold text-slate-100 flex items-center gap-2"><History className="w-5 h-5 text-violet-400" /> Account History</h3><p className="text-xs text-slate-400 mt-1">{historyUser.fullName} · {historyUser.email}</p></div>
            <div className="grid sm:grid-cols-3 gap-3 text-xs"><div className="p-3 rounded-xl bg-slate-800 border border-slate-700"><p className="text-slate-500">Created</p><p className="text-slate-200 mt-1">{formatDateTime(historyUser.createdAt)}</p></div><div className="p-3 rounded-xl bg-slate-800 border border-slate-700"><p className="text-slate-500">Approved</p><p className="text-slate-200 mt-1">{formatDateTime(historyUser.approvedAt)}</p></div><div className="p-3 rounded-xl bg-slate-800 border border-slate-700"><p className="text-slate-500">Last login</p><p className="text-slate-200 mt-1">{formatDateTime(historyUser.lastLoginAt)}</p></div></div>
            <div className="space-y-2">
              {(historyUser.history || []).map((entry) => <div key={entry.id} className="p-3 rounded-xl bg-slate-800/70 border border-slate-700 flex gap-3"><div className="w-2 h-2 rounded-full bg-violet-400 mt-1.5 shrink-0" /><div className="min-w-0 flex-1"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1"><p className="text-xs font-semibold text-slate-200">{HISTORY_LABELS[entry.action] || entry.action}</p><p className="text-[10px] text-slate-500">{formatDateTime(entry.createdAt)}</p></div><p className="text-[10px] text-slate-500 mt-1">By {entry.actorName || 'System / self-service'}{historyDetail(entry) ? ` · ${historyDetail(entry)}` : ''}</p></div></div>)}
              {(historyUser.history || []).length === 0 && <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-700 rounded-xl">No audit events recorded for this account yet.</div>}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog open={Boolean(confirmation)} title={confirmation?.title} description={confirmation?.description} impact={confirmation?.impact} confirmLabel={confirmation?.confirmLabel} tone={confirmation?.tone || 'danger'} requireReason={confirmation?.requireReason} reason={confirmationReason} onReasonChange={setConfirmationReason} busy={busyAction === confirmation?.key} onCancel={() => !busyAction && setConfirmation(null)} onConfirm={runConfirmedAction} />
    </div>
  );
};
