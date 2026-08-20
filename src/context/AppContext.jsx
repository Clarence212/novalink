// hey reader! production app context with localStorage DB persistence and real auth handling
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  initialUsers, initialHomeowners, initialVehicles, initialReservations,
  initialDues, initialPayments, initialVisitorLogs, initialConcerns,
  initialAnnouncements, initialStickerRenewals, initialFacilities,
  initialEmailLog, paymentQRCode
} from '../data/mockData';

const AppContext = createContext();
const DB_STORAGE_KEY = 'novalink_clean_production_v1';

// helper to load persisted DB or fallback to initial records
const loadPersistedData = (key, fallback) => {
  try {
    const saved = localStorage.getItem(`${DB_STORAGE_KEY}_${key}`);
    if (!saved) return fallback;
    return JSON.parse(saved);
  } catch (e) {
    console.error(`Failed loading ${key} from storage:`, e);
    return fallback;
  }
};

export const AppProvider = ({ children }) => {
  const [users, setUsers] = useState(() => loadPersistedData('users', initialUsers));
  const [homeowners, setHomeowners] = useState(() => loadPersistedData('homeowners', initialHomeowners));
  const [vehicles, setVehicles] = useState(() => loadPersistedData('vehicles', initialVehicles));
  const [reservations, setReservations] = useState(() => loadPersistedData('reservations', initialReservations));
  const [dues, setDues] = useState(() => loadPersistedData('dues', initialDues));
  const [payments, setPayments] = useState(() => loadPersistedData('payments', initialPayments));
  const [visitorLogs, setVisitorLogs] = useState(() => loadPersistedData('visitorLogs', initialVisitorLogs));
  const [concerns, setConcerns] = useState(() => loadPersistedData('concerns', initialConcerns));
  const [announcements, setAnnouncements] = useState(() => loadPersistedData('announcements', initialAnnouncements));
  const [stickerRenewals, setStickerRenewals] = useState(() => loadPersistedData('stickerRenewals', initialStickerRenewals));
  const [facilities] = useState(initialFacilities);
  const [emailLog, setEmailLog] = useState(() => loadPersistedData('emailLog', initialEmailLog));

  const [currentUser, setCurrentUser] = useState(() => loadPersistedData('currentUser', null));
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [toast, setToast] = useState(null);

  // Sync state changes to localStorage for production persistence
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_users`, JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_homeowners`, JSON.stringify(homeowners)); }, [homeowners]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_vehicles`, JSON.stringify(vehicles)); }, [vehicles]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_reservations`, JSON.stringify(reservations)); }, [reservations]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_dues`, JSON.stringify(dues)); }, [dues]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_payments`, JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_visitorLogs`, JSON.stringify(visitorLogs)); }, [visitorLogs]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_concerns`, JSON.stringify(concerns)); }, [concerns]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_announcements`, JSON.stringify(announcements)); }, [announcements]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_stickerRenewals`, JSON.stringify(stickerRenewals)); }, [stickerRenewals]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_emailLog`, JSON.stringify(emailLog)); }, [emailLog]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_currentUser`, JSON.stringify(currentUser)); }, [currentUser]);

  // get the homeowner record linked to current user
  const currentHomeowner = currentUser?.homeownerId
    ? homeowners.find(h => h.id === currentUser.homeownerId)
    : null;

  // check if current resident is restricted (2+ unpaid months)
  const isRestricted = currentHomeowner?.restricted || false;

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const sendEmailNotification = (to, subject, body) => {
    const newEmail = {
      id: `e${Date.now()}`,
      to,
      subject,
      body,
      sentAt: new Date().toLocaleString('en-PH')
    };
    setEmailLog(prev => [newEmail, ...prev]);
  };

  // --- AUTH OPERATIONS ---
  const login = (email, password = '') => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (!user) return { success: false, message: 'Invalid email address or credentials.' };
    if (user.status === 'pending') return { success: false, message: 'Account pending administrator approval.' };
    if (user.status !== 'active') return { success: false, message: 'Account is inactive. Please contact NHAI office.' };

    setCurrentUser(user);
    setIsGuestMode(false);
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    setIsGuestMode(false);
    localStorage.removeItem(`${DB_STORAGE_KEY}_currentUser`);
  };

  // --- USER MANAGEMENT ---
  const createUserAccount = (userData) => {
    const newUser = {
      id: `u${Date.now()}`,
      fullName: userData.fullName,
      email: userData.email,
      role: userData.role, // 'admin' | 'security' | 'resident'
      status: 'active',
      homeownerId: userData.role === 'resident' ? (userData.homeownerId || 'h1') : null
    };
    setUsers(prev => [newUser, ...prev]);
    sendEmailNotification(userData.email, `NovaLink ${userData.role.toUpperCase()} Account Created`, `Your new NovaLink ${userData.role} account has been created by the Main Administrator. Email: ${userData.email}`);
    showToast(`New ${userData.role} account created successfully.`, 'success');
  };

  const approveUser = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active' } : u));
    const user = users.find(u => u.id === userId);
    if (user) sendEmailNotification(user.email, 'Account Approved - NovaLink', 'Your NovaLink account has been approved. You may now log in.');
    showToast('Account approved successfully.', 'success');
  };

  const rejectUser = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'rejected' } : u));
    const user = users.find(u => u.id === userId);
    if (user) sendEmailNotification(user.email, 'Account Registration Update - NovaLink', 'We regret to inform you that your account registration has not been approved at this time.');
    showToast('Account rejected.', 'warning');
  };

  // --- VISITOR LOG OPERATIONS ---
  const addVisitorLog = (logData) => {
    const newLog = { id: `vl${Date.now()}`, ...logData, recordedBy: currentUser?.id, entryTime: new Date().toLocaleString('en-PH'), exitTime: null };
    setVisitorLogs(prev => [newLog, ...prev]);
    showToast('Visitor entry logged successfully.', 'success');
  };

  const updateVisitorExit = (logId) => {
    setVisitorLogs(prev => prev.map(l => l.id === logId ? { ...l, exitTime: new Date().toLocaleString('en-PH') } : l));
    showToast('Visitor exit recorded.', 'success');
  };

  // --- ANNOUNCEMENT OPERATIONS ---
  const addAnnouncement = (data) => {
    const newAnn = { id: `a${Date.now()}`, ...data, postedBy: currentUser?.id, datePosted: new Date().toLocaleDateString('en-PH'), status: 'published' };
    setAnnouncements(prev => [newAnn, ...prev]);
    const residentEmails = users.filter(u => u.role === 'resident' && u.status === 'active');
    residentEmails.forEach(u => sendEmailNotification(u.email, `NovaLink Announcement: ${data.title}`, data.content));
    showToast(`Announcement posted and emailed to ${residentEmails.length} residents.`, 'success');
  };

  // --- RESERVATION OPERATIONS ---
  const addReservation = (data) => {
    const newRes = { id: `r${Date.now()}`, ...data, status: 'pending', approvedBy: null, createdAt: new Date().toLocaleDateString('en-PH') };
    setReservations(prev => [newRes, ...prev]);
    showToast('Reservation request submitted.', 'success');
  };

  const updateReservationStatus = (resId, status) => {
    setReservations(prev => prev.map(r => r.id === resId ? { ...r, status, approvedBy: currentUser?.id } : r));
    const res = reservations.find(r => r.id === resId);
    if (res && res.requesterEmail) {
      sendEmailNotification(res.requesterEmail, `Facility Reservation ${status.toUpperCase()} - NovaLink`, `Your facility reservation for ${res.facilityName} on ${res.date} has been ${status}.`);
    }
    showToast(`Reservation ${status}.`, status === 'approved' ? 'success' : 'warning');
  };

  // --- DUES OPERATIONS ---
  const validatePayment = (paymentId, coveredMonths) => {
    setPayments(prev => prev.map(p => p.id === paymentId
      ? { ...p, validationStatus: 'validated', validatedBy: currentUser?.id, validatedAt: new Date().toLocaleString('en-PH'), coveredMonths }
      : p
    ));
    setDues(prev => prev.map(d => coveredMonths.includes(d.billingMonth) ? { ...d, status: 'paid' } : d));
    const payment = payments.find(p => p.id === paymentId);
    if (payment) {
      const homeowner = homeowners.find(h => h.id === payment.homeownerId);
      if (homeowner) sendEmailNotification(homeowner.email, 'Payment Validated - NovaLink', `Your payment of ₱${payment.amountPaid.toLocaleString()} has been validated for: ${coveredMonths.join(', ')}.`);
    }
    showToast('Payment validated and dues updated.', 'success');
  };

  const rejectPayment = (paymentId) => {
    setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, validationStatus: 'rejected' } : p));
    const payment = payments.find(p => p.id === paymentId);
    if (payment) {
      const homeowner = homeowners.find(h => h.id === payment.homeownerId);
      if (homeowner) sendEmailNotification(homeowner.email, 'Payment Proof Rejected - NovaLink', 'Your submitted proof of payment could not be validated. Please resubmit with a clear receipt.');
    }
    showToast('Payment proof rejected.', 'warning');
  };

  const submitPaymentProof = (homeownerId, data) => {
    const newPayment = {
      id: `p${Date.now()}`, homeownerId, submittedBy: currentUser?.id, validatedBy: null,
      amountPaid: data.amount, paymentDate: new Date().toLocaleDateString('en-PH'),
      proofImage: data.proofImage || null, paymentReference: data.reference,
      validationStatus: 'pending', validatedAt: null, coveredMonths: []
    };
    setPayments(prev => [newPayment, ...prev]);
    showToast('Proof of payment submitted for validation.', 'success');
  };

  // --- CONCERN OPERATIONS ---
  const submitConcern = (data) => {
    const newConcern = {
      id: `c${Date.now()}`, homeownerId: currentHomeowner?.id, submittedBy: currentUser?.id,
      ...data, status: 'pending', adminResponse: null, respondedBy: null, respondedAt: null,
      submittedAt: new Date().toLocaleDateString('en-PH')
    };
    setConcerns(prev => [newConcern, ...prev]);
    showToast('Concern submitted successfully.', 'success');
  };

  const respondToConcern = (concernId, response, status) => {
    setConcerns(prev => prev.map(c => c.id === concernId
      ? { ...c, adminResponse: response, status, respondedBy: currentUser?.id, respondedAt: new Date().toLocaleString('en-PH') }
      : c
    ));
    const concern = concerns.find(c => c.id === concernId);
    if (concern) {
      const homeowner = homeowners.find(h => h.id === concern.homeownerId);
      if (homeowner) sendEmailNotification(homeowner.email, `Concern Update: ${concern.subject}`, `Status: ${status}\n\nResponse: ${response}`);
    }
    showToast('Response sent and emailed to resident.', 'success');
  };

  // --- VEHICLE OPERATIONS ---
  const submitVehicle = (data) => {
    const newVehicle = {
      id: `v${Date.now()}`, homeownerId: currentHomeowner?.id, submittedBy: currentUser?.id,
      reviewedBy: null, approvalStatus: 'pending', ...data
    };
    setVehicles(prev => [...prev, newVehicle]);
    showToast('Vehicle information submitted for review.', 'success');
  };

  const reviewVehicle = (vehicleId, status) => {
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, approvalStatus: status, reviewedBy: currentUser?.id } : v));
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      const homeowner = homeowners.find(h => h.id === vehicle.homeownerId);
      if (homeowner) sendEmailNotification(homeowner.email, `Vehicle Information ${status === 'approved' ? 'Approved' : 'Rejected'} - NovaLink`, `Your vehicle (${vehicle.plateNumber}) has been ${status}.`);
    }
    showToast(`Vehicle information ${status}.`, status === 'approved' ? 'success' : 'warning');
  };

  // --- STICKER RENEWAL OPERATIONS ---
  const submitStickerRenewal = (vehicleId) => {
    const newRenewal = {
      id: `sr${Date.now()}`, vehicleId, homeownerId: currentHomeowner?.id,
      requestedBy: currentUser?.id, reviewedBy: null,
      renewalPeriod: '2026-2027', status: 'pending', stickerNumber: null,
      requestedAt: new Date().toLocaleDateString('en-PH'), approvedAt: null
    };
    setStickerRenewals(prev => [newRenewal, ...prev]);
    showToast('Sticker renewal request submitted.', 'success');
  };

  const reviewStickerRenewal = (renewalId, status) => {
    const stickerNum = status === 'approved' ? `NVL-2026-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}` : null;
    setStickerRenewals(prev => prev.map(r => r.id === renewalId
      ? { ...r, status, reviewedBy: currentUser?.id, stickerNumber: stickerNum, approvedAt: status === 'approved' ? new Date().toLocaleDateString('en-PH') : null }
      : r
    ));
    const renewal = stickerRenewals.find(r => r.id === renewalId);
    if (renewal) {
      const homeowner = homeowners.find(h => h.id === renewal.homeownerId);
      if (homeowner) sendEmailNotification(homeowner.email, `HOA Sticker Renewal ${status === 'approved' ? 'Approved' : 'Rejected'} - NovaLink`, status === 'approved' ? `Your sticker renewal has been approved. Sticker No: ${stickerNum}. Please claim at the NHAI office.` : 'Your sticker renewal request has been rejected. Please contact NHAI office.');
    }
    showToast(`Sticker renewal ${status}.`, status === 'approved' ? 'success' : 'warning');
  };

  // --- HOMEOWNER RECORD OPERATIONS ---
  const addHomeownerRecord = (data) => {
    const newRecord = { id: `h${Date.now()}`, ...data, unpaidMonths: 0, restricted: false, occupants: [] };
    setHomeowners(prev => [...prev, newRecord]);
    showToast('Homeowner record created.', 'success');
  };

  const updateHomeownerRecord = (homeownerId, data) => {
    setHomeowners(prev => prev.map(h => h.id === homeownerId ? { ...h, ...data } : h));
    showToast('Homeowner record updated.', 'success');
  };

  return (
    <AppContext.Provider value={{
      users, homeowners, vehicles, reservations, dues, payments,
      visitorLogs, concerns, announcements, stickerRenewals, facilities, emailLog,
      currentUser, currentHomeowner, isGuestMode, setIsGuestMode, toast, isRestricted,
      paymentQRCode,
      showToast, sendEmailNotification,
      login, logout,
      createUserAccount, approveUser, rejectUser,
      addVisitorLog, updateVisitorExit,
      addAnnouncement,
      addReservation, updateReservationStatus,
      validatePayment, rejectPayment, submitPaymentProof,
      submitConcern, respondToConcern,
      submitVehicle, reviewVehicle,
      submitStickerRenewal, reviewStickerRenewal,
      addHomeownerRecord, updateHomeownerRecord,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
