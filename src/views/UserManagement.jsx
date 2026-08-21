import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Users, CheckCircle, XCircle, Search, UserPlus, X, Edit2, UserX, UserCheck } from 'lucide-react';

const statusBadge = (s) => {
  const m = { active: 'bg-emerald-900/60 text-emerald-400', pending: 'bg-amber-900/60 text-amber-400', rejected: 'bg-red-900/60 text-red-400', inactive: 'bg-slate-700 text-slate-400' };
  return <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${m[s] || 'bg-slate-700 text-slate-400'}`}>{s}</span>;
};

const roleBadge = (r) => {
  const m = { admin: 'bg-violet-900/60 text-violet-400', security: 'bg-sky-900/60 text-sky-400', resident: 'bg-blue-900/60 text-blue-400' };
  return <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold capitalize ${m[r] || 'bg-slate-700 text-slate-400'}`}>{r}</span>;
};

export const UserManagement = () => {
  const { users, createUserAccount, approveUser, rejectUser, deactivateUser, reactivateUser, editUser } = useApp();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [newUserData, setNewUserData] = useState({
    fullName: '',
    email: '',
    password: 'novalink2026',
    role: 'admin',
  });

  const [editData, setEditData] = useState({ fullName: '', email: '', role: 'resident' });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newUserData.fullName || !newUserData.email) return;
    createUserAccount(newUserData);
    setNewUserData({ fullName: '', email: '', password: 'novalink2026', role: 'admin' });
    setShowCreateModal(false);
  };

  const handleEditOpen = (user) => {
    setEditingUser(user);
    setEditData({ fullName: user.fullName, email: user.email, role: user.role });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    editUser(editingUser.id, editData);
    setEditingUser(null);
  };

  const filtered = users.filter(u => {
    const matchSearch = u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">User & Personnel Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">Create, edit, activate, deactivate, and approve system accounts</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition"
        >
          <UserPlus className="w-4 h-4" /> Create System Account
        </button>
      </div>

      {pendingCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-700/50 text-xs text-amber-300 flex items-center gap-2">
          <span className="font-bold text-amber-400">{pendingCount}</span> account(s) pending administrator approval
        </div>
      )}

      {}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3 flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'pending', 'active', 'inactive', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition capitalize ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead>
            <tr className="text-left text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-slate-700/30 transition">
                <td className="px-5 py-3 font-medium text-slate-200">{u.fullName}</td>
                <td className="px-5 py-3 text-slate-400">{u.email}</td>
                <td className="px-5 py-3">{roleBadge(u.role)}</td>
                <td className="px-5 py-3">{statusBadge(u.status)}</td>
                <td className="px-5 py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {}
                    {u.status === 'pending' && (
                      <>
                        <button onClick={() => approveUser(u.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/70 hover:bg-emerald-600 text-white text-[10px] font-bold transition">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button onClick={() => rejectUser(u.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600/70 hover:bg-red-600 text-white text-[10px] font-bold transition">
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                    {}
                    {u.status === 'active' && (
                      <>
                        <button onClick={() => handleEditOpen(u)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/70 hover:bg-blue-600 text-white text-[10px] font-bold transition">
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => deactivateUser(u.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-[10px] font-bold transition">
                          <UserX className="w-3 h-3" /> Deactivate
                        </button>
                      </>
                    )}
                    {}
                    {(u.status === 'inactive' || u.status === 'rejected') && (
                      <button onClick={() => reactivateUser(u.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/70 hover:bg-emerald-600 text-white text-[10px] font-bold transition">
                        <UserCheck className="w-3 h-3" /> Reactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-slate-500">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl relative">
            <button onClick={() => setShowCreateModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" /> Create System Account
              </h3>
              <p className="text-xs text-slate-400 mt-1">Add a new administrator, security guard, or resident account. Default password: novalink2026</p>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Role</label>
                <select
                  value={newUserData.role}
                  onChange={e => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="admin">NHAI Administrator (Admin)</option>
                  <option value="security">Security Personnel (Guard)</option>
                  <option value="resident">Resident Homeowner</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Officer Juan Dela Cruz"
                  value={newUserData.fullName}
                  onChange={e => setNewUserData({ ...newUserData, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. officer.juan@novaville.org"
                  value={newUserData.email}
                  onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Password</label>
                <input
                  type="text"
                  value={newUserData.password}
                  onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl relative">
            <button onClick={() => setEditingUser(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" /> Edit Account
              </h3>
              <p className="text-xs text-slate-400 mt-1">Update account details for {editingUser.fullName}</p>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
                <select
                  value={editData.role}
                  onChange={e => setEditData({ ...editData, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="admin">NHAI Administrator</option>
                  <option value="security">Security Personnel</option>
                  <option value="resident">Resident Homeowner</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editData.fullName}
                  onChange={e => setEditData({ ...editData, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editData.email}
                  onChange={e => setEditData({ ...editData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
