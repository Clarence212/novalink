import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock3, Home, Link2, MailCheck, Search, ShieldCheck, UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeBlockLot = (value) => normalize(value).replace(/[^a-z0-9]/g, '');

const formatDate = (value) => {
  if (!value) return 'Not available';
  const normalized = String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const candidateScore = (request, homeowner) => {
  let score = 0;
  const requestEmail = normalize(request.email);
  const requestName = normalize(request.fullName);
  const requestContact = normalize(request.contactNumber).replace(/\D/g, '');
  const homeownerName = normalize(homeowner.ownerName);
  const homeownerContact = normalize(homeowner.contactNumber).replace(/\D/g, '');
  const requestBlockLot = normalizeBlockLot(request.blockLot);

  if (requestEmail && requestEmail === normalize(homeowner.email)) score += 100;
  if (requestBlockLot && requestBlockLot === normalizeBlockLot(homeowner.blockLot)) score += 90;
  if (requestName && requestName === homeownerName) score += 70;
  else if (requestName && homeownerName && (requestName.includes(homeownerName) || homeownerName.includes(requestName))) score += 30;
  if (requestContact && requestContact === homeownerContact) score += 50;
  return score;
};

const accountCandidateScore = (user, homeowner) => candidateScore(
  { email: user.email, fullName: user.fullName },
  homeowner,
);

const duplicateGroups = (homeowners) => {
  const groups = [];
  [
    { kind: 'Email', field: 'email' },
    { kind: 'Block/Lot', field: 'blockLot' },
  ].forEach(({ kind, field }) => {
    const values = new Map();
    homeowners.forEach((homeowner) => {
      const key = field === 'blockLot' ? normalizeBlockLot(homeowner[field]) : normalize(homeowner[field]);
      if (!key) return;
      values.set(key, [...(values.get(key) || []), homeowner]);
    });
    values.forEach((records, value) => {
      if (records.length > 1) groups.push({ kind, value, displayValue: records[0][field], records });
    });
  });
  return groups.sort((a, b) => a.kind.localeCompare(b.kind) || a.value.localeCompare(b.value));
};

const SectionHeader = ({ icon: Icon, title, description, count, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-950/60 border-blue-800/60 text-blue-300',
    amber: 'bg-amber-950/60 border-amber-800/60 text-amber-300',
    red: 'bg-red-950/60 border-red-800/60 text-red-300',
  };
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-100">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{count}</span>
    </div>
  );
};

export const AccountReconciliation = ({ onOpenHomeowners }) => {
  const {
    homeowners,
    registrationRequests,
    users,
    resolveRegistrationMatch,
    linkResidentAccount,
    showToast,
  } = useApp();
  const [search, setSearch] = useState('');
  const [registrationDrafts, setRegistrationDrafts] = useState({});
  const [accountDrafts, setAccountDrafts] = useState({});
  const [workingKey, setWorkingKey] = useState('');

  const unlinkedHomeowners = useMemo(
    () => homeowners.filter((homeowner) => !homeowner.userId),
    [homeowners],
  );
  const unlinkedResidents = useMemo(
    () => users.filter((user) => user.role === 'resident' && !user.homeownerId),
    [users],
  );
  const duplicates = useMemo(() => duplicateGroups(homeowners), [homeowners]);
  const searchTerm = normalize(search);

  const visibleRequests = registrationRequests.filter((request) => (
    !searchTerm
    || normalize(request.fullName).includes(searchTerm)
    || normalize(request.email).includes(searchTerm)
    || normalize(request.contactNumber).includes(searchTerm)
    || normalize(request.blockLot).includes(searchTerm)
  ));
  const visibleResidents = unlinkedResidents.filter((user) => (
    !searchTerm
    || normalize(user.fullName).includes(searchTerm)
    || normalize(user.email).includes(searchTerm)
  ));
  const visibleDuplicates = duplicates.filter((group) => (
    !searchTerm
    || group.value.includes(searchTerm)
    || group.records.some((record) => normalize(record.ownerName).includes(searchTerm))
  ));

  const candidatesForRequest = (request) => [...unlinkedHomeowners].sort((left, right) => (
    candidateScore(request, right) - candidateScore(request, left)
    || left.ownerName.localeCompare(right.ownerName)
  ));

  const selectRegistrationCandidate = (request, homeownerId) => {
    const homeowner = homeowners.find((record) => record.id === homeownerId);
    setRegistrationDrafts((previous) => ({
      ...previous,
      [request.tokenId]: homeowner ? {
        homeownerId,
        ownerName: homeowner.ownerName,
        blockLot: request.blockLot || homeowner.blockLot,
        contactNumber: request.contactNumber || homeowner.contactNumber,
        identityConfirmed: false,
      } : {},
    }));
  };

  const submitRegistrationResolution = async (event, request) => {
    event.preventDefault();
    const draft = registrationDrafts[request.tokenId] || {};
    if (!draft.homeownerId || !draft.identityConfirmed) return;
    setWorkingKey(`request:${request.tokenId}`);
    const result = await resolveRegistrationMatch({
      tokenId: request.tokenId,
      homeownerId: draft.homeownerId,
      ownerName: draft.ownerName,
      blockLot: draft.blockLot,
      contactNumber: draft.contactNumber,
      identityConfirmed: draft.identityConfirmed,
    });
    if (result.success) {
      setRegistrationDrafts((previous) => {
        const next = { ...previous };
        delete next[request.tokenId];
        return next;
      });
      showToast(
        result.tokenActive
          ? 'Master record aligned. The resident can retry the open registration without requesting another code.'
          : 'Master record aligned. The old verification expired, so the resident must restart registration and request a new code.',
        'info',
      );
    }
    setWorkingKey('');
  };

  const selectAccountCandidate = (userId, homeownerId) => {
    const user = users.find((record) => record.id === userId);
    const homeowner = homeowners.find((record) => record.id === homeownerId);
    const emailMatches = user && homeowner && normalize(user.email) === normalize(homeowner.email);
    setAccountDrafts((previous) => ({
      ...previous,
      [userId]: homeowner ? {
        homeownerId,
        emailResolution: emailMatches ? 'match' : 'update-homeowner',
        identityConfirmed: false,
      } : {},
    }));
  };

  const submitAccountLink = async (event, user) => {
    event.preventDefault();
    const draft = accountDrafts[user.id] || {};
    const homeowner = homeowners.find((record) => record.id === draft.homeownerId);
    if (!homeowner) return;
    const emailMismatch = normalize(user.email) !== normalize(homeowner.email);
    if (!user.emailVerified || user.status === 'rejected' || !draft.identityConfirmed) return;
    if (emailMismatch && !['update-homeowner', 'keep-different'].includes(draft.emailResolution)) return;

    setWorkingKey(`user:${user.id}`);
    const result = await linkResidentAccount({
      userId: user.id,
      homeownerId: homeowner.id,
      emailResolution: emailMismatch ? draft.emailResolution : 'match',
      identityConfirmed: draft.identityConfirmed,
    });
    if (result.success) {
      setAccountDrafts((previous) => {
        const next = { ...previous };
        delete next[user.id];
        return next;
      });
    }
    setWorkingKey('');
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Account & Homeowner Reconciliation</h2>
        <p className="text-xs text-slate-500 mt-0.5">Resolve failed resident matches, link legacy accounts, and identify duplicate master records.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-blue-800/50 bg-blue-950/20 p-4">
          <div className="text-2xl font-bold text-blue-400">{registrationRequests.length}</div>
          <div className="text-xs text-slate-400 mt-1">Verified requests awaiting alignment</div>
        </div>
        <div className="rounded-2xl border border-amber-800/50 bg-amber-950/20 p-4">
          <div className="text-2xl font-bold text-amber-400">{unlinkedResidents.length}</div>
          <div className="text-xs text-slate-400 mt-1">Resident accounts without a homeowner</div>
        </div>
        <div className="rounded-2xl border border-red-800/50 bg-red-950/20 p-4">
          <div className="text-2xl font-bold text-red-400">{duplicates.length}</div>
          <div className="text-xs text-slate-400 mt-1">Possible duplicate record groups</div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by resident name, email, contact number, or block/lot..."
          className="flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
        />
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <SectionHeader
          icon={MailCheck}
          title="Verified registration requests"
          description="Align an unlinked master record with the resident's verified email, then ask the resident to retry registration."
          count={visibleRequests.length}
        />

        {visibleRequests.map((request) => {
          const draft = registrationDrafts[request.tokenId] || {};
          const selected = homeowners.find((homeowner) => homeowner.id === draft.homeownerId);
          const candidates = candidatesForRequest(request);
          const isWorking = workingKey === `request:${request.tokenId}`;
          return (
            <form key={request.tokenId} onSubmit={(event) => submitRegistrationResolution(event, request)} className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-100">{request.fullName || 'Verified resident'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${request.tokenActive ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      {request.tokenActive ? 'Verification active' : 'Verification expired'}
                    </span>
                  </div>
                  <div className="text-xs text-blue-300 mt-1">{request.email}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {request.blockLot ? `Requested address: ${request.blockLot} · ` : ''}{request.contactNumber || 'No contact supplied'} · verified {formatDate(request.verifiedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Clock3 className="w-3.5 h-3.5" /> Requested {formatDate(request.requestedAt)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select the verified master record</label>
                <select
                  value={draft.homeownerId || ''}
                  onChange={(event) => selectRegistrationCandidate(request, event.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Choose an active, unlinked homeowner</option>
                  {candidates.map((homeowner) => {
                    const score = candidateScore(request, homeowner);
                    return (
                      <option key={homeowner.id} value={homeowner.id}>
                        {score >= 150 ? 'Strong match · ' : score > 0 ? 'Possible match · ' : ''}{homeowner.ownerName} — {homeowner.blockLot} — {homeowner.email}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selected && (
                <div className="rounded-xl border border-blue-800/50 bg-blue-950/20 p-4 space-y-3">
                  <div className="text-xs text-slate-300">
                    <span className="font-semibold">Selected:</span> {selected.ownerName}, {selected.blockLot}, {selected.street}
                  </div>
                  {!request.tokenActive && (
                    <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-300">
                      This verification has expired. You can correct the master record, but the resident must restart registration and request a new code.
                    </div>
                  )}
                  <label>
                    <span className="block text-[11px] font-semibold text-slate-400 mb-1">Confirmed Homeowner Name</span>
                    <input
                      required
                      value={draft.ownerName || ''}
                      onChange={(event) => setRegistrationDrafts((previous) => ({
                        ...previous,
                        [request.tokenId]: { ...draft, ownerName: event.target.value, identityConfirmed: false },
                      }))}
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label>
                      <span className="block text-[11px] font-semibold text-slate-400 mb-1">Confirmed Block & Lot</span>
                      <input
                        required
                        value={draft.blockLot || ''}
                        onChange={(event) => setRegistrationDrafts((previous) => ({
                          ...previous,
                          [request.tokenId]: { ...draft, blockLot: event.target.value, identityConfirmed: false },
                        }))}
                        className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </label>
                    <label>
                      <span className="block text-[11px] font-semibold text-slate-400 mb-1">Confirmed Contact Number</span>
                      <input
                        required
                        value={draft.contactNumber || ''}
                        onChange={(event) => setRegistrationDrafts((previous) => ({
                          ...previous,
                          [request.tokenId]: { ...draft, contactNumber: event.target.value, identityConfirmed: false },
                        }))}
                        className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </label>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Master email will change from <span className="text-slate-200">{selected.email}</span> to the verified address <span className="text-blue-300">{request.email}</span>.
                  </div>
                  <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.identityConfirmed)}
                      onChange={(event) => setRegistrationDrafts((previous) => ({
                        ...previous,
                        [request.tokenId]: { ...draft, identityConfirmed: event.target.checked },
                      }))}
                      className="mt-0.5 accent-blue-600"
                    />
                    I verified this resident against the official NHAI master record.
                  </label>
                  <button
                    type="submit"
                    disabled={!draft.identityConfirmed || isWorking}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold transition"
                  >
                    <ShieldCheck className="w-4 h-4" /> {isWorking ? 'Saving…' : 'Align Master Record'}
                  </button>
                </div>
              )}
            </form>
          );
        })}
        {visibleRequests.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500"><CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />No verified registration requests need reconciliation.</div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <SectionHeader
          icon={UserCheck}
          title="Unlinked resident accounts"
          description="Connect existing resident accounts to active master records. Email mismatches require explicit confirmation."
          count={visibleResidents.length}
          tone="amber"
        />

        {visibleResidents.map((user) => {
          const draft = accountDrafts[user.id] || {};
          const selected = homeowners.find((homeowner) => homeowner.id === draft.homeownerId);
          const emailMismatch = selected && normalize(user.email) !== normalize(selected.email);
          const linkBlocked = !user.emailVerified || user.status === 'rejected';
          const isWorking = workingKey === `user:${user.id}`;
          return (
            <form key={user.id} onSubmit={(event) => submitAccountLink(event, user)} className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3">
              <div>
                <div className="text-sm font-bold text-slate-100">{user.fullName}</div>
                <div className="text-xs text-amber-300 mt-1">{user.email}</div>
                <div className="text-[11px] text-slate-500 mt-1">Status: {user.status} · {user.emailVerified ? 'email verified' : 'email unverified'} · created {formatDate(user.createdAt)}</div>
              </div>
              {!user.emailVerified && <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-300">Verify this account’s email in Account Administration before linking it.</div>}
              {user.status === 'rejected' && <div className="rounded-lg border border-red-800/60 bg-red-950/30 px-3 py-2 text-[11px] text-red-300">Reactivate this rejected account in Account Administration before linking it.</div>}
              <select
                value={draft.homeownerId || ''}
                onChange={(event) => selectAccountCandidate(user.id, event.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Choose an active, unlinked homeowner</option>
                {[...unlinkedHomeowners].sort((left, right) => (
                  accountCandidateScore(user, right) - accountCandidateScore(user, left)
                  || left.ownerName.localeCompare(right.ownerName)
                )).map((homeowner) => {
                  const score = accountCandidateScore(user, homeowner);
                  return <option key={homeowner.id} value={homeowner.id}>{score >= 100 ? 'Strong match · ' : score > 0 ? 'Possible match · ' : ''}{homeowner.ownerName} — {homeowner.blockLot} — {homeowner.email}</option>;
                })}
              </select>
              {selected && (
                <div className={`rounded-xl border p-3 text-xs ${emailMismatch ? 'border-amber-700/60 bg-amber-950/30' : 'border-emerald-800/50 bg-emerald-950/20'}`}>
                  <div className="font-semibold text-slate-200">{selected.ownerName} · {selected.blockLot}</div>
                  <div className="text-slate-400 mt-1">Master email: {selected.email}</div>
                  {emailMismatch ? (
                    <div className="mt-3 space-y-2 text-[11px] text-amber-300">
                      <p className="font-semibold">The account and master-record emails differ. Choose how to resolve them:</p>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="radio" name={`email-resolution-${user.id}`} value="update-homeowner" checked={draft.emailResolution === 'update-homeowner'} onChange={(event) => setAccountDrafts((previous) => ({ ...previous, [user.id]: { ...draft, emailResolution: event.target.value, identityConfirmed: false } }))} className="mt-0.5 accent-amber-600" />
                        <span>Update the homeowner master email to <strong>{user.email}</strong> (recommended for a verified account).</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="radio" name={`email-resolution-${user.id}`} value="keep-different" checked={draft.emailResolution === 'keep-different'} onChange={(event) => setAccountDrafts((previous) => ({ ...previous, [user.id]: { ...draft, emailResolution: event.target.value, identityConfirmed: false } }))} className="mt-0.5 accent-amber-600" />
                        <span>Keep the different emails as a documented exception.</span>
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Email addresses match.</div>
                  )}
                  <label className="flex items-start gap-2 mt-3 text-[11px] text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={Boolean(draft.identityConfirmed)} onChange={(event) => setAccountDrafts((previous) => ({ ...previous, [user.id]: { ...draft, identityConfirmed: event.target.checked } }))} className="mt-0.5 accent-amber-600" />
                    I verified this account owner and homeowner record using official NHAI records.
                  </label>
                </div>
              )}
              <button
                type="submit"
                disabled={!selected || linkBlocked || !draft.identityConfirmed || (emailMismatch && !draft.emailResolution) || isWorking}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold transition"
              >
                <Link2 className="w-4 h-4" /> {isWorking ? 'Linking…' : 'Link Resident Account'}
              </button>
            </form>
          );
        })}
        {visibleResidents.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500"><CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />No resident accounts are missing a homeowner link.</div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <SectionHeader
          icon={AlertTriangle}
          title="Possible duplicate master records"
          description="Review records sharing the same normalized email or block/lot before aligning registrations."
          count={visibleDuplicates.length}
          tone="red"
        />

        {visibleDuplicates.map((group) => (
          <div key={`${group.kind}:${group.value}`} className="rounded-2xl border border-red-900/60 bg-red-950/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-red-300">Duplicate {group.kind}</div>
                <div className="text-xs text-slate-300 mt-1">{group.displayValue}</div>
              </div>
              <button type="button" onClick={onOpenHomeowners} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200">
                <Home className="w-3.5 h-3.5" /> Open Records
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.records.map((record) => (
                <div key={record.id} className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-[11px]">
                  <div className="font-semibold text-slate-200">{record.ownerName}</div>
                  <div className="text-slate-500 mt-0.5">{record.blockLot} · {record.email}</div>
                  <div className="text-slate-600 mt-0.5">{record.userId ? 'Linked account' : 'Unlinked record'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {visibleDuplicates.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500"><CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />No duplicate email or block/lot groups detected.</div>
        )}
      </section>
    </div>
  );
};
